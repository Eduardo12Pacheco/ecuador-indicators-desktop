import re

import ecuador_data


def test_version_is_semver() -> None:
    assert re.fullmatch(r"\d+\.\d+\.\d+", ecuador_data.__version__)
