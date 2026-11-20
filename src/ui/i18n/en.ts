/**
 * English UI dictionary — the source of truth for every translated string
 * (D11). `es.ts` is typed as the same object shape and a parity test fails if
 * a key is missing, empty or interpolates different parameters.
 */

export const en = {
  "app.name": "Ecuador Indicators",

  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.details": "Technical details",
  "common.dismiss": "Dismiss",
  "common.loading": "Loading…",
  "common.reset": "Reset",
  "common.retry": "Retry",
  "common.save": "Save",
  "common.search": "Search",

  "shell.skipToContent": "Skip to main content",
  "shell.primaryNavigation": "Primary navigation",
  "shell.collapseSidebar": "Collapse sidebar",
  "shell.expandSidebar": "Expand sidebar",
  "shell.theme": "Theme",
  "shell.themeSystem": "System",
  "shell.themeLight": "Light",
  "shell.themeDark": "Dark",
  "shell.language": "Language",
  "shell.langSystem": "System",
  "shell.langEnglish": "English",
  "shell.langSpanish": "Español",
  "shell.toggleTheme": "Toggle light and dark theme",
  "shell.switchLanguage": "Change language",

  "nav.explore": "Explore",
  "nav.compare": "Compare",
  "nav.views": "Saved views",
  "nav.settings": "Settings",
  "nav.about": "Data & About",
  "nav.design": "Design system",

  "status.dataset": "Dataset",
  "status.version": "Version",
  "status.loadingDataset": "Loading dataset…",
  "status.bundled": "Bundled snapshot",

  "page.explore.title": "Explore an indicator",
  "page.explore.description":
    "Read one World Bank indicator over time, with optional peers and transforms.",
  "page.compare.title": "Compare",
  "page.compare.description":
    "Index trajectories to a base year or rank every geography for one year.",
  "page.views.title": "Saved views",
  "page.views.description": "Reopen a saved Explore, Trajectories or Ranking view.",
  "page.settings.title": "Settings",
  "page.settings.description": "Appearance, updates, dataset and storage.",
  "page.about.title": "Data & About",
  "page.about.description": "Provenance, licences and how this app is built.",
  "page.design.title": "Design system",
  "page.design.description": "Tokens and primitives, shown in both themes.",
  "page.design.gallery.description":
    "This gallery is available in development and end-to-end builds only.",

  "state.loading": "Loading data…",
  "state.empty.title": "Nothing here yet",
  "state.empty.defaultDescription": "Adjust the filters or choose another indicator.",
  "state.error.title": "Something went wrong",
  "state.error.defaultDescription": "The dataset could not be read. Try again.",

  "primitive.dialog.close": "Close dialog",
  "primitive.toast.region": "Notifications",
  "primitive.toast.dismiss": "Dismiss notification",
  "primitive.switch": "Toggle {label}",
  "primitive.slider": "{label} range",
  "primitive.sliderMin": "Minimum {label}",
  "primitive.sliderMax": "Maximum {label}",
  "primitive.chip.remove": "Remove {label}",
  "primitive.tabs": "Tabs",
  "primitive.tooltip": "More information",
  "primitive.spinner": "Loading",
  "primitive.liveRegion": "Status updates",
  "primitive.visuallyHidden": "Additional information",
  "primitive.iconButton.missingLabel": "Icon buttons need an accessible label",

  "items.count_one": "{count} item",
  "items.count_other": "{count} items",
  "views.count_one": "{count} saved view",
  "views.count_other": "{count} saved views",
} as const;

/** Every message key, derived from the English dictionary. */
export type MessageKey = keyof typeof en;

/** The shape both dictionaries must satisfy. */
export type Messages = { readonly [K in MessageKey]: string };

/** Plural bases supported by `tp`. */
export type PluralKey = "items.count" | "views.count";
