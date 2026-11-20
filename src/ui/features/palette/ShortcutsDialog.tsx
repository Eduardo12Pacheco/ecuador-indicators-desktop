import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Button } from "../../design/primitives/Button/Button";
import { Kbd } from "../../design/primitives/Kbd/Kbd";
import { useT } from "../../i18n/useT";
import styles from "./ShortcutsDialog.module.css";

/** One row of the shortcut help table. */
export interface ShortcutEntry {
  readonly id: string;
  readonly title: string;
  /** One item per stroke, already formatted for the current platform. */
  readonly keys: readonly string[];
}

/** A modal table of every registered shortcut (D26, opened with `?`). */
export function ShortcutsDialog({
  open,
  onOpenChange,
  entries,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entries: readonly ShortcutEntry[];
}) {
  const { t } = useT();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content}>
          <DialogPrimitive.Title className={styles.title}>
            {t("shortcuts.title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className={styles.description}>
            {t("shortcuts.description")}
          </DialogPrimitive.Description>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("shortcuts.action")}</th>
                <th scope="col">{t("shortcuts.keys")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">{entry.title}</th>
                  <td>
                    {entry.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.footer}>
            <DialogPrimitive.Close asChild>
              <Button variant="primary">{t("shortcuts.close")}</Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
