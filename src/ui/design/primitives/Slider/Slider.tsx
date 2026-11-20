import * as SliderPrimitive from "@radix-ui/react-slider";

import { useT } from "../../../i18n/useT";
import styles from "./Slider.module.css";

/** A two-thumb range slider with labelled thumbs and a value readout. */
export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onValueChange,
}: {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly value: readonly [number, number];
  readonly onValueChange: (value: readonly [number, number]) => void;
}) {
  const { t } = useT();
  const values = [...value];
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.values}>
          {value[0]} – {value[1]}
        </span>
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={values}
        onValueChange={(next) => {
          const first = next[0] ?? min;
          const second = next[1] ?? first;
          onValueChange([first, second]);
        }}
        className={styles.root}
      >
        <SliderPrimitive.Track className={styles.track}>
          <SliderPrimitive.Range className={styles.range} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={styles.thumb}
          aria-label={t("primitive.sliderMin", { label })}
        />
        <SliderPrimitive.Thumb
          className={styles.thumb}
          aria-label={t("primitive.sliderMax", { label })}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
