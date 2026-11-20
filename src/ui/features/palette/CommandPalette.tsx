import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SavedView } from "../../../core/domain/model";
import { IconButton } from "../../design/primitives/IconButton/IconButton";
import { LiveRegion } from "../../design/primitives/LiveRegion/LiveRegion";
import { useT } from "../../i18n/useT";
import styles from "./CommandPalette.module.css";
import type { PaletteCommand } from "./commands";
import { type PaletteItem, usePaletteItems } from "./use-palette-items";

export type { PaletteCommand } from "./commands";

/** Side effects the palette can trigger; injected by the composition root. */
export interface PaletteActions {
  readonly openIndicator: (code: string) => void;
  readonly openGeography: (iso3: string) => void;
  readonly openView: (view: SavedView) => void;
  readonly runCommand: (id: string) => void;
}

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly commands: readonly PaletteCommand[];
  readonly actions: PaletteActions;
}

/**
 * Command palette (S5): cmdk supplies the listbox semantics and roving focus;
 * search ranking comes from the shared use case so the palette and the catalog
 * panel cannot disagree. Focus returns to the opener when it closes.
 */
export function CommandPalette({ open, onOpenChange, commands, actions }: CommandPaletteProps) {
  const { t, tp, lang } = useT();
  const [query, setQuery] = useState("");
  const previousFocus = useRef<HTMLElement | null>(null);
  const lastOpen = useRef(open);

  if (open && !lastOpen.current && typeof document !== "undefined") {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  lastOpen.current = open;

  useEffect(() => {
    if (open) {
      setQuery("");
      return;
    }
    const target = previousFocus.current;
    previousFocus.current = null;
    target?.focus();
  }, [open]);

  const { groups, count, isPending, error } = usePaletteItems({ query, commands, lang });

  const select = (item: PaletteItem) => {
    switch (item.kind) {
      case "indicator":
        actions.openIndicator(item.code);
        break;
      case "geography":
        actions.openGeography(item.iso3);
        break;
      case "view":
        actions.openView(item.view);
        break;
      case "action":
        actions.runCommand(item.commandId);
        break;
    }
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content}>
          <div className={styles.header}>
            <DialogPrimitive.Title className={styles.title}>
              {t("palette.title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={t("common.close")}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className={styles.description}>
            {t("palette.description")}
          </DialogPrimitive.Description>
          <Command shouldFilter={false} loop label={t("palette.title")}>
            <div className={styles.search}>
              <Search aria-hidden="true" size={16} />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t("palette.placeholder")}
                aria-label={t("palette.placeholder")}
                className={styles.input}
              />
            </div>
            {isPending ? <p className={styles.status}>{t("common.loading")}</p> : null}
            {error !== null ? (
              <p role="alert" className={styles.status}>
                {error}
              </p>
            ) : null}
            {!isPending && error === null && count === 0 ? (
              <p className={styles.status}>{t("palette.noResults", { query })}</p>
            ) : null}
            {groups.length === 0 ? null : (
              <Command.List className={styles.list}>
                {groups.map((group) => (
                  // biome-ignore lint/a11y/useSemanticElements: command groups are ARIA groups, not fieldsets.
                  <div
                    key={group.id}
                    role="group"
                    aria-label={group.title}
                    className={styles.group}
                  >
                    <p aria-hidden="true" className={styles.groupTitle}>
                      {group.title}
                    </p>
                    {group.items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        className={styles.item}
                        onSelect={() => select(item)}
                      >
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.detail === "" ? null : (
                          <span className={styles.itemDetail}>{item.detail}</span>
                        )}
                      </Command.Item>
                    ))}
                  </div>
                ))}
              </Command.List>
            )}
          </Command>
          <LiveRegion>{tp("palette.results", count)}</LiveRegion>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
