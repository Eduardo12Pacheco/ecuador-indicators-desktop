//! Wire and domain models for the snapshot catalog and observations.
//!
//! These types are the single source of truth for the IPC contract: they derive
//! `serde` for the Tauri wire format and `ts_rs::TS` for the generated
//! TypeScript bindings consumed by the desktop shell adapter.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Per-table row counts exposed by the bundled snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DatasetCounts {
    pub topics: usize,
    pub geographies: usize,
    pub indicators: usize,
    pub observations: usize,
}

/// Provenance and shape of the active snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DatasetInfo {
    pub schema_version: u32,
    pub origin: String,
    pub dataset_id: String,
    pub dataset_version: String,
    pub source_name: String,
    pub source_publisher: String,
    pub source_last_updated: String,
    pub retrieved_at: String,
    pub license: String,
    pub license_url: String,
    pub attribution_en: String,
    pub attribution_es: String,
    pub counts: DatasetCounts,
}

/// A catalog topic (for example `economy`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Topic {
    pub id: String,
    pub name_en: String,
    pub name_es: String,
    pub sort_order: i32,
}

/// A geography included in the snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Geography {
    pub iso3: String,
    pub iso2: String,
    pub name_en: String,
    pub name_es: String,
    pub is_aggregate: bool,
    pub sort_order: i32,
}

/// Unit family used for formatting and chart labels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum ValueKind {
    Currency,
    Percent,
    Number,
    Years,
    Rate,
    Index,
}

/// Whether a higher value is desirable, used for KPI delta semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum HigherIs {
    Better,
    Worse,
    Neutral,
}

/// A curated indicator with bilingual metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Indicator {
    pub code: String,
    pub topic_id: String,
    pub name_en: String,
    pub name_es: String,
    pub description_en: String,
    pub description_es: String,
    pub unit_en: String,
    pub unit_es: String,
    pub value_kind: ValueKind,
    pub decimals: i32,
    pub higher_is: HigherIs,
    pub source_org_en: String,
    pub source_org_es: String,
    pub sort_order: i32,
}

/// The complete catalog in curated sort order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Catalog {
    pub topics: Vec<Topic>,
    pub geographies: Vec<Geography>,
    pub indicators: Vec<Indicator>,
}

/// One annual observation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Observation {
    pub indicator_code: String,
    pub iso3: String,
    pub year: i32,
    pub value: f64,
}
