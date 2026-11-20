//! Saved-view contracts shared by the Rust core and the TypeScript UI (D25).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Transform applied to a series before charting or tabulating.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum Transform {
    Level,
    Yoy,
    Index,
}

/// Chart type selected in the Explore page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum ChartKind {
    Line,
    Area,
    Bar,
}

/// A persistable page state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum ViewSpec {
    Explore {
        indicator: String,
        /// One to five ISO3 codes; the first entry is always `ECU` (D25).
        geographies: Vec<String>,
        from: Option<i32>,
        to: Option<i32>,
        transform: Transform,
        base_year: Option<i32>,
        chart: ChartKind,
    },
    Trajectories {
        /// Two to four unique indicator codes (D25).
        indicators: Vec<String>,
        geography: String,
        base_year: Option<i32>,
    },
    Ranking {
        indicator: String,
        year: i32,
    },
}

/// A persisted saved view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SavedView {
    pub id: String,
    pub name: String,
    pub spec: ViewSpec,
    pub created_at: i64,
    pub updated_at: i64,
}

/// The payload accepted when creating or updating a view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct NewView {
    pub name: String,
    pub spec: ViewSpec,
}
