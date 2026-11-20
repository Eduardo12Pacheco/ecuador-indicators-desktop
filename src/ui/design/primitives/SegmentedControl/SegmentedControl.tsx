import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import styles from "./SegmentedControl.module.css";

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

/** A single-choice segmented control with roving focus (Radix ToggleGroup). */
export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
}: {
  readonly label: string;
  readonly options: readonly SegmentedOption[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next !== "") onValueChange(next);
      }}
      aria-label={label}
      className={styles.root}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item key={option.value} value={option.value} className={styles.item}>
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
