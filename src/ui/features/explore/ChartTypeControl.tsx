import type { ChartKind } from "../../../core/domain/model";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { useT } from "../../i18n/useT";

export interface ChartTypeControlProps {
  readonly chart: ChartKind;
  readonly onChange: (chart: ChartKind) => void;
}

/** Line / area / bar selector; the data is identical in all three. */
export function ChartTypeControl({ chart, onChange }: ChartTypeControlProps) {
  const { t } = useT();
  return (
    <SegmentedControl
      label={t("explore.chart.type")}
      value={chart}
      options={[
        { value: "line", label: t("explore.chart.line") },
        { value: "area", label: t("explore.chart.area") },
        { value: "bar", label: t("explore.chart.bar") },
      ]}
      onValueChange={(value) => onChange(value as ChartKind)}
    />
  );
}
