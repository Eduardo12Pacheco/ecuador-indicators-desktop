"""File-system raw cache and data manifest adapter."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path, PurePosixPath

from pydantic import ValidationError

from ecuador_data.domain.errors import IntegrityError, ManifestError
from ecuador_data.domain.integrity import canonical_json_bytes, sha256_bytes, sha256_file
from ecuador_data.domain.models import RawFileRecord, RawManifest

MANIFEST_NAME = "MANIFEST.json"


class FileRawStore:
    """Stores canonical JSON raw files under a data directory."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = Path(data_dir)

    @property
    def data_dir(self) -> Path:
        return self._data_dir

    @property
    def manifest_path(self) -> Path:
        return self._data_dir / MANIFEST_NAME

    @staticmethod
    def _safe_relative(relative_path: str) -> PurePosixPath:
        candidate = PurePosixPath(relative_path)
        if candidate.is_absolute() or ".." in candidate.parts or not candidate.parts:
            raise ManifestError(f"unsafe raw cache path: {relative_path!r}")
        return candidate

    def path_for(self, relative_path: str) -> Path:
        return self._data_dir.joinpath(*self._safe_relative(relative_path).parts)

    @staticmethod
    def _atomic_write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        temp_path = Path(temp_name)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            temp_path.replace(path)
        except BaseException:
            temp_path.unlink(missing_ok=True)
            raise

    def write_json(self, relative_path: str, payload: object, *, url: str) -> RawFileRecord:
        target = self.path_for(relative_path)
        data = canonical_json_bytes(payload)
        self._atomic_write(target, data)
        return RawFileRecord(
            path=str(self._safe_relative(relative_path)),
            url=url,
            bytes=len(data),
            sha256=sha256_bytes(data),
        )

    def read_json(self, relative_path: str) -> object:
        target = self.path_for(relative_path)
        try:
            with target.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError as exc:
            raise IntegrityError(f"raw file not found: {relative_path}") from exc
        except json.JSONDecodeError as exc:
            raise IntegrityError(f"raw file is not valid JSON: {relative_path}: {exc}") from exc

    def exists(self, relative_path: str) -> bool:
        return self.path_for(relative_path).is_file()

    def write_manifest(self, manifest: RawManifest) -> Path:
        data = canonical_json_bytes(manifest.model_dump(mode="json", exclude_none=True))
        self._atomic_write(self.manifest_path, data)
        return self.manifest_path

    def read_manifest(self) -> RawManifest:
        try:
            with self.manifest_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except FileNotFoundError as exc:
            raise ManifestError(f"data manifest not found: {self.manifest_path}") from exc
        except json.JSONDecodeError as exc:
            raise ManifestError(f"data manifest is not valid JSON: {exc}") from exc
        try:
            return RawManifest.model_validate(payload)
        except ValidationError as exc:
            raise ManifestError(f"data manifest is invalid: {exc}") from exc

    def verify_raw_files(self, manifest: RawManifest) -> None:
        for record in manifest.raw_files:
            target = self.path_for(record.path)
            if not target.is_file():
                raise IntegrityError(f"raw file missing: {record.path}")
            actual_size = target.stat().st_size
            if actual_size != record.bytes:
                raise IntegrityError(
                    f"checksum mismatch: {record.path} expected={record.sha256} "
                    f"actual=size {actual_size} (expected {record.bytes})"
                )
            actual = sha256_file(target)
            if actual != record.sha256:
                raise IntegrityError(
                    f"checksum mismatch: {record.path} expected={record.sha256} actual={actual}"
                )
