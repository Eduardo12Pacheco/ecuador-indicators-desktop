//! Shared in-memory fakes for the service-level unit tests.
//!
//! The fakes live in the test crate on purpose: production adapters must not
//! depend on test-only behaviour, and the services are exercised exactly as the
//! Tauri composition root will use them.

#![allow(dead_code)]

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard};

use indicators_core::domain::{
    Catalog, CoreError, DatasetCounts, DatasetInfo, Geography, Indicator, Observation, ReleaseInfo,
    SavedView, Settings, Topic, ValueKind, ViewSpec,
};
use indicators_core::ports::{
    Clock, ExportWriter, IdGenerator, ReleaseFeed, SnapshotOpener, SnapshotReader, UserStore,
};

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().expect("test mutex poisoned")
}

pub fn sample_info() -> DatasetInfo {
    DatasetInfo {
        schema_version: 1,
        origin: "worldbank".to_string(),
        dataset_id: "ecuador-indicators".to_string(),
        dataset_version: "2026-11-20".to_string(),
        source_name: "World Development Indicators".to_string(),
        source_publisher: "The World Bank".to_string(),
        source_last_updated: "2026-11-11".to_string(),
        retrieved_at: "2026-11-20T07:17:18+00:00".to_string(),
        license: "CC-BY-4.0".to_string(),
        license_url: "https://creativecommons.org/licenses/by/4.0/".to_string(),
        attribution_en: "Source: The World Bank.".to_string(),
        attribution_es: "Fuente: Banco Mundial.".to_string(),
        counts: DatasetCounts {
            topics: 1,
            geographies: 2,
            indicators: 1,
            observations: 3,
        },
    }
}

pub fn sample_catalog() -> Catalog {
    Catalog {
        topics: vec![Topic {
            id: "economy".to_string(),
            name_en: "Economy & prices".to_string(),
            name_es: "Economía y precios".to_string(),
            sort_order: 1,
        }],
        geographies: vec![
            Geography {
                iso3: "ECU".to_string(),
                iso2: "EC".to_string(),
                name_en: "Ecuador".to_string(),
                name_es: "Ecuador".to_string(),
                is_aggregate: false,
                sort_order: 1,
            },
            Geography {
                iso3: "COL".to_string(),
                iso2: "CO".to_string(),
                name_en: "Colombia".to_string(),
                name_es: "Colombia".to_string(),
                is_aggregate: false,
                sort_order: 2,
            },
        ],
        indicators: vec![Indicator {
            code: "NY.GDP.MKTP.CD".to_string(),
            topic_id: "economy".to_string(),
            name_en: "GDP (current US$)".to_string(),
            name_es: "PIB (US$ a precios actuales)".to_string(),
            description_en: "GDP at purchasers' prices.".to_string(),
            description_es: "PIB a precios de comprador.".to_string(),
            unit_en: "current US$".to_string(),
            unit_es: "US$ corrientes".to_string(),
            value_kind: ValueKind::Currency,
            decimals: 0,
            higher_is: indicators_core::domain::HigherIs::Better,
            source_org_en: "World Bank".to_string(),
            source_org_es: "Banco Mundial".to_string(),
            sort_order: 1,
        }],
    }
}

pub fn sample_observations() -> Vec<Observation> {
    vec![
        Observation {
            indicator_code: "NY.GDP.MKTP.CD".to_string(),
            iso3: "ECU".to_string(),
            year: 2023,
            value: 118_845_000_000.0,
        },
        Observation {
            indicator_code: "NY.GDP.MKTP.CD".to_string(),
            iso3: "ECU".to_string(),
            year: 2024,
            value: 120_000_000_000.0,
        },
    ]
}

#[derive(Clone)]
pub struct FakeReader {
    pub info: DatasetInfo,
    pub catalog: Catalog,
    pub observations: Vec<Observation>,
}

impl FakeReader {
    pub fn new() -> Self {
        Self {
            info: sample_info(),
            catalog: sample_catalog(),
            observations: sample_observations(),
        }
    }
}

impl Default for FakeReader {
    fn default() -> Self {
        Self::new()
    }
}

impl SnapshotReader for FakeReader {
    fn info(&self) -> Result<DatasetInfo, CoreError> {
        Ok(self.info.clone())
    }

    fn catalog(&self) -> Result<Catalog, CoreError> {
        Ok(self.catalog.clone())
    }

    fn observations(
        &self,
        codes: &[String],
        iso3s: &[String],
    ) -> Result<Vec<Observation>, CoreError> {
        Ok(self
            .observations
            .iter()
            .filter(|o| codes.contains(&o.indicator_code) && iso3s.contains(&o.iso3))
            .cloned()
            .collect())
    }
}

pub struct FakeOpener {
    result: Mutex<Result<FakeReader, CoreError>>,
}

impl FakeOpener {
    pub fn ok(reader: FakeReader) -> Self {
        Self {
            result: Mutex::new(Ok(reader)),
        }
    }

    pub fn failing(error: CoreError) -> Self {
        Self {
            result: Mutex::new(Err(error)),
        }
    }
}

impl SnapshotOpener for FakeOpener {
    fn open(&self, _path: &Path) -> Result<Box<dyn SnapshotReader>, CoreError> {
        match &*lock(&self.result) {
            Ok(reader) => Ok(Box::new(reader.clone())),
            Err(error) => Err(error.clone()),
        }
    }
}

#[derive(Default)]
pub struct MemoryUserStore {
    pub views: Mutex<Vec<SavedView>>,
    pub settings: Mutex<HashMap<String, String>>,
    pub failing: AtomicBool,
}

impl MemoryUserStore {
    pub fn fail(&self) {
        self.failing.store(true, Ordering::SeqCst);
    }

    fn guard(&self) -> Result<(), CoreError> {
        if self.failing.load(Ordering::SeqCst) {
            Err(CoreError::storage("injected storage failure"))
        } else {
            Ok(())
        }
    }
}

impl UserStore for MemoryUserStore {
    fn list_views(&self) -> Result<Vec<SavedView>, CoreError> {
        self.guard()?;
        let mut views = lock(&self.views).clone();
        views.sort_by(|a, b| {
            b.updated_at
                .cmp(&a.updated_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(views)
    }

    fn get_view(&self, id: &str) -> Result<Option<SavedView>, CoreError> {
        self.guard()?;
        Ok(lock(&self.views).iter().find(|v| v.id == id).cloned())
    }

    fn insert_view(&self, view: &SavedView) -> Result<(), CoreError> {
        self.guard()?;
        lock(&self.views).push(view.clone());
        Ok(())
    }

    fn update_view(&self, view: &SavedView) -> Result<(), CoreError> {
        self.guard()?;
        let mut views = lock(&self.views);
        let Some(existing) = views.iter_mut().find(|v| v.id == view.id) else {
            return Err(CoreError::view_not_found(view.id.clone()));
        };
        *existing = view.clone();
        Ok(())
    }

    fn delete_view(&self, id: &str) -> Result<bool, CoreError> {
        self.guard()?;
        let mut views = lock(&self.views);
        let before = views.len();
        views.retain(|v| v.id != id);
        Ok(views.len() != before)
    }

    fn count_views(&self) -> Result<usize, CoreError> {
        self.guard()?;
        Ok(lock(&self.views).len())
    }

    fn get_setting(&self, key: &str) -> Result<Option<String>, CoreError> {
        self.guard()?;
        Ok(lock(&self.settings).get(key).cloned())
    }

    fn set_setting(&self, key: &str, value: &str) -> Result<(), CoreError> {
        self.guard()?;
        lock(&self.settings).insert(key.to_string(), value.to_string());
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeClock {
    now: AtomicI64,
}

impl FakeClock {
    pub fn at(now: i64) -> Self {
        Self {
            now: AtomicI64::new(now),
        }
    }

    pub fn set(&self, now: i64) {
        self.now.store(now, Ordering::SeqCst);
    }
}

impl Clock for FakeClock {
    fn now_unix(&self) -> i64 {
        self.now.load(Ordering::SeqCst)
    }
}

#[derive(Default)]
pub struct SeqIdGenerator {
    next: AtomicUsize,
}

impl IdGenerator for SeqIdGenerator {
    fn new_id(&self) -> String {
        let value = self.next.fetch_add(1, Ordering::SeqCst);
        format!("id-{value}")
    }
}

#[derive(Default)]
pub struct RecordingWriter {
    pub writes: Mutex<Vec<(PathBuf, Vec<u8>)>>,
    pub failing: AtomicBool,
}

impl ExportWriter for RecordingWriter {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), CoreError> {
        if self.failing.load(Ordering::SeqCst) {
            return Err(CoreError::storage("injected export failure"));
        }
        lock(&self.writes).push((path.to_path_buf(), bytes.to_vec()));
        Ok(())
    }
}

pub struct FakeReleaseFeed {
    release: Mutex<Result<ReleaseInfo, CoreError>>,
    pub calls: AtomicUsize,
}

impl FakeReleaseFeed {
    pub fn returning(release: ReleaseInfo) -> Self {
        Self {
            release: Mutex::new(Ok(release)),
            calls: AtomicUsize::new(0),
        }
    }

    pub fn failing(error: CoreError) -> Self {
        Self {
            release: Mutex::new(Err(error)),
            calls: AtomicUsize::new(0),
        }
    }

    pub fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl ReleaseFeed for FakeReleaseFeed {
    fn latest(&self) -> Result<ReleaseInfo, CoreError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        lock(&self.release).clone()
    }
}

pub fn released(tag: &str) -> ReleaseInfo {
    ReleaseInfo {
        tag_name: tag.to_string(),
        html_url: format!("https://example.test/releases/tag/{tag}"),
        published_at: Some("2026-12-01T10:00:00Z".to_string()),
        draft: false,
        prerelease: false,
    }
}

pub fn explore_spec() -> ViewSpec {
    ViewSpec::Explore {
        indicator: "NY.GDP.MKTP.CD".to_string(),
        geographies: vec!["ECU".to_string(), "COL".to_string()],
        from: Some(2000),
        to: Some(2024),
        transform: indicators_core::domain::Transform::Level,
        base_year: None,
        chart: indicators_core::domain::ChartKind::Line,
    }
}

pub fn trajectories_spec() -> ViewSpec {
    ViewSpec::Trajectories {
        indicators: vec!["NY.GDP.MKTP.CD".to_string(), "SP.POP.TOTL".to_string()],
        geography: "ECU".to_string(),
        base_year: Some(2000),
    }
}

pub fn ranking_spec() -> ViewSpec {
    ViewSpec::Ranking {
        indicator: "NY.GDP.MKTP.CD".to_string(),
        year: 2024,
    }
}

pub fn saved_view(id: &str, updated_at: i64) -> SavedView {
    SavedView {
        id: id.to_string(),
        name: format!("View {id}"),
        spec: explore_spec(),
        created_at: updated_at,
        updated_at,
    }
}

pub fn default_settings() -> Settings {
    Settings::default()
}
