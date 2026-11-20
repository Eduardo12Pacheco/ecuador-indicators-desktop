import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId } from "react";

import styles from "./Switch.module.css";

/** A labelled on/off control with Radix's tested semantics. */
export function Switch({
  label,
  checked,
  onCheckedChange,
  description,
  disabled = false,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly description?: string;
  readonly disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.row}>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={styles.root}
      >
        <SwitchPrimitive.Thumb className={styles.thumb} />
      </SwitchPrimitive.Root>
      <div>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
    </div>
  );
}
