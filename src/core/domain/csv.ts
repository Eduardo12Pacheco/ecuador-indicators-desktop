/**
 * CSV export in long format (S7): RFC 4180 with CRLF line endings, no BOM and a
 * fixed header, one row per observation.
 */

import {
  type Geography,
  geographyName,
  type Indicator,
  indicatorName,
  indicatorUnit,
  type Lang,
  type Series,
} from "./model";

/** One export row before serialization. */
export interface ExportRow {
  readonly indicatorCode: string;
  readonly indicatorName: string;
  readonly iso3: string;
  readonly geography: string;
  readonly year: number;
  readonly value: number;
  readonly unit: string;
}

/** The visible data needed to build an export. */
export interface ExportModel {
  readonly indicator: Indicator;
  readonly geographies: readonly Geography[];
  readonly series: readonly Series[];
  readonly lang: Lang;
}

/** The exact CSV header required by S7. */
export const CSV_HEADER = "indicator_code,indicator_name,iso3,geography,year,value,unit" as const;

/**
 * Flattens the visible series into long-format rows, ordered by the geography
 * order and then ascending by year.
 */
export function buildExportRows(model: ExportModel): ExportRow[] {
  const indicatorNameValue = indicatorName(model.indicator, model.lang);
  const unit = indicatorUnit(model.indicator, model.lang);
  const rows: ExportRow[] = [];
  for (const geography of model.geographies) {
    const series = model.series.find((candidate) => candidate.geography.iso3 === geography.iso3);
    if (series === undefined) {
      continue;
    }
    for (const point of series.points) {
      rows.push({
        indicatorCode: model.indicator.code,
        indicatorName: indicatorNameValue,
        iso3: geography.iso3,
        geography: geographyName(geography, model.lang),
        year: point.year,
        value: point.value,
        unit,
      });
    }
  }
  return rows;
}

/** Quotes a field only when RFC 4180 requires it, doubling inner quotes. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializes rows to an RFC 4180 CSV document with a trailing CRLF. */
export function toCsv(rows: readonly ExportRow[]): string {
  const lines: string[] = [CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        csvField(row.indicatorCode),
        csvField(row.indicatorName),
        csvField(row.iso3),
        csvField(row.geography),
        String(row.year),
        String(row.value),
        csvField(row.unit),
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
