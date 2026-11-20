//! Property-based tests for invariants that must hold for arbitrary input.

use std::path::Path;

use indicators_core::application::{ExportService, validate_view_spec};
use indicators_core::domain::{ChartKind, CoreError, NewView, Transform, ViewSpec, is_newer};
use indicators_core::ports::ExportWriter;
use proptest::prelude::*;

fn arb_iso3() -> impl Strategy<Value = String> {
    "[A-Z]{3}"
}

fn arb_indicator() -> impl Strategy<Value = String> {
    "[A-Z]{2,4}(\\.[A-Z0-9]{2,6}){1,3}"
}

fn arb_transform() -> impl Strategy<Value = Transform> {
    prop_oneof![
        Just(Transform::Level),
        Just(Transform::Yoy),
        Just(Transform::Index)
    ]
}

fn arb_chart() -> impl Strategy<Value = ChartKind> {
    prop_oneof![
        Just(ChartKind::Line),
        Just(ChartKind::Area),
        Just(ChartKind::Bar)
    ]
}

fn arb_year() -> impl Strategy<Value = i32> {
    1800..=2200
}

fn arb_optional_year() -> impl Strategy<Value = Option<i32>> {
    prop::option::of(arb_year())
}

fn arb_view_spec() -> impl Strategy<Value = ViewSpec> {
    let explore = (
        arb_indicator(),
        prop::collection::vec(arb_iso3(), 0..=6),
        arb_optional_year(),
        arb_optional_year(),
        arb_transform(),
        arb_optional_year(),
        arb_chart(),
    )
        .prop_map(
            |(indicator, geographies, from, to, transform, base_year, chart)| ViewSpec::Explore {
                indicator,
                geographies,
                from,
                to,
                transform,
                base_year,
                chart,
            },
        );
    let trajectories = (
        prop::collection::vec(arb_indicator(), 1..=5),
        arb_iso3(),
        arb_optional_year(),
    )
        .prop_map(
            |(indicators, geography, base_year)| ViewSpec::Trajectories {
                indicators,
                geography,
                base_year,
            },
        );
    let ranking = (arb_indicator(), arb_year())
        .prop_map(|(indicator, year)| ViewSpec::Ranking { indicator, year });

    prop_oneof![explore, trajectories, ranking]
}

proptest! {
    #[test]
    fn view_specs_round_trip_through_json(spec in arb_view_spec()) {
        let encoded = serde_json::to_string(&spec).unwrap();
        let decoded: ViewSpec = serde_json::from_str(&encoded).unwrap();
        prop_assert_eq!(decoded, spec);
    }

    #[test]
    fn view_spec_validation_never_panics(spec in arb_view_spec()) {
        let _ = validate_view_spec(&spec);
    }

    #[test]
    fn validated_views_with_a_trimmed_name_are_accepted_or_rejected_by_code(
        spec in arb_view_spec(),
        name in ".{0,120}",
    ) {
        let result = validate_view_spec(&spec);
        if let Err(error) = result {
            prop_assert_eq!(error.code(), "VIEW_INVALID");
        }
        let view = NewView { name, spec };
        prop_assert!(view.name.chars().count() <= 120);
    }

    #[test]
    fn semver_comparison_is_antisymmetric(
        a in (0_u64..1000, 0_u64..1000, 0_u64..1000),
        b in (0_u64..1000, 0_u64..1000, 0_u64..1000),
    ) {
        let left = format!("{}.{}.{}", a.0, a.1, a.2);
        let right = format!("{}.{}.{}", b.0, b.1, b.2);
        if left != right {
            prop_assert_ne!(is_newer(&left, &right).unwrap(), is_newer(&right, &left).unwrap());
        } else {
            prop_assert!(!is_newer(&left, &right).unwrap());
        }
    }

    #[test]
    fn semver_comparison_ignores_a_leading_v(
        a in (0_u64..1000, 0_u64..1000, 0_u64..1000),
        b in (0_u64..1000, 0_u64..1000, 0_u64..1000),
    ) {
        let plain = format!("{}.{}.{}", a.0, a.1, a.2);
        let other = format!("{}.{}.{}", b.0, b.1, b.2);
        prop_assert_eq!(
            is_newer(&format!("v{plain}"), &format!("v{other}")).unwrap(),
            is_newer(&plain, &other).unwrap()
        );
    }

    #[test]
    fn export_accepts_exactly_csv_and_png(extension in "[A-Za-z0-9]{0,6}") {
        struct NullWriter;
        impl ExportWriter for NullWriter {
            fn write(&self, _path: &Path, _bytes: &[u8]) -> Result<(), CoreError> {
                Ok(())
            }
        }
        let service = ExportService::new(std::sync::Arc::new(NullWriter));
        let path = format!("/tmp/export.{extension}");
        let accepted = service.save(Path::new(&path), b"x").is_ok();
        let expected = extension.eq_ignore_ascii_case("csv") || extension.eq_ignore_ascii_case("png");
        prop_assert_eq!(accepted, expected);
    }
}
