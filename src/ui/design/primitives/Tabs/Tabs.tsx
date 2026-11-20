import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import styles from "./Tabs.module.css";

export interface TabItem {
  readonly value: string;
  readonly label: string;
  readonly content: ReactNode;
}

/** Radix tabs with our styling; arrow-key behaviour comes from Radix. */
export function Tabs({
  items,
  defaultValue,
  label,
  onValueChange,
}: {
  readonly items: readonly TabItem[];
  readonly defaultValue: string;
  readonly label: string;
  readonly onValueChange?: (value: string) => void;
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} onValueChange={onValueChange}>
      <TabsPrimitive.List className={styles.list} aria-label={label}>
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className={styles.trigger}>
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className={styles.content}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
