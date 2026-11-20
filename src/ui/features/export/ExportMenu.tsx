/** CSV and PNG export buttons for the active page (S7). */

import { Button } from "../../design/primitives/Button/Button";
import { useT } from "../../i18n/useT";
import styles from "./ExportMenu.module.css";
import type { FileExportKind } from "./export-context";

/** Props of {@link ExportMenu}. */
export interface ExportMenuProps {
  readonly available: Readonly<Record<FileExportKind, boolean>>;
  readonly busy: FileExportKind | null;
  readonly onExport: (kind: FileExportKind) => void;
}

/** Renders both export actions, disabled when the page cannot export. */
export function ExportMenu({ available, busy, onExport }: ExportMenuProps) {
  const { t } = useT();
  const blocked = busy !== null;
  return (
    <div className={styles.menu}>
      <Button
        size="sm"
        disabled={!available.csv || blocked}
        title={available.csv ? undefined : t("export.unavailable")}
        onClick={() => onExport("csv")}
      >
        {t("export.csv")}
      </Button>
      <Button
        size="sm"
        disabled={!available.png || blocked}
        title={available.png ? undefined : t("export.unavailable")}
        onClick={() => onExport("png")}
      >
        {t("export.png")}
      </Button>
    </div>
  );
}
