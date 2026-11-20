import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactElement, ReactNode } from "react";

import { useT } from "../../../i18n/useT";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Dialog.module.css";

/** A modal dialog with a title, optional description and a close control. */
export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: {
  readonly trigger?: ReactElement;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  /** Controlled mode; omit to keep Radix's uncontrolled trigger behavior. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useT();
  const controlled = open === undefined ? {} : { open, onOpenChange };
  return (
    <DialogPrimitive.Root {...controlled}>
      {trigger === undefined ? null : (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content}>
          <div className={styles.header}>
            <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={t("primitive.dialog.close")}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className={styles.description}>
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type DialogChild = ReactNode;
