import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { listViews } from "../../core/application/use-cases/views";
import { useTheme } from "../../ui/design/ThemeProvider";
import { SnapshotProblemScreen } from "../../ui/features/about/SnapshotProblemScreen";
import { useExportActions } from "../../ui/features/export/export-context";
import {
  CommandPalette,
  type PaletteActions,
  type PaletteCommand,
} from "../../ui/features/palette/CommandPalette";
import { viewSpecPath } from "../../ui/features/palette/commands";
import { type ShortcutEntry, ShortcutsDialog } from "../../ui/features/palette/ShortcutsDialog";
import { useAutoUpdateCheck } from "../../ui/features/settings/use-auto-update-check";
import { SaveViewDialog } from "../../ui/features/views/SaveViewDialog";
import { locationToViewSpec } from "../../ui/features/views/view-location";
import { useT } from "../../ui/i18n/useT";
import { usePorts } from "../../ui/ports-context";
import {
  availableCommands,
  COMMANDS,
  type CommandContext,
  commandById,
  detectPlatform,
  formatShortcut,
  parseShortcut,
} from "../shortcuts/registry";
import { useShortcuts } from "../shortcuts/use-shortcuts";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { useNarrowViewport } from "./use-narrow-viewport";

const FALLBACK_INDICATOR = "NY.GDP.MKTP.CD";

/** Landmark skeleton plus the global command palette and shortcut registry. */
export function AppShell() {
  const narrow = useNarrowViewport();
  const [manualCollapse, setManualCollapse] = useState<boolean | null>(null);
  const collapsed = manualCollapse ?? narrow;

  const ports = usePorts();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, setLang } = useT();
  const { toggle } = useTheme();
  const exportActions = useExportActions();
  useAutoUpdateCheck();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const platform = useMemo(
    () => detectPlatform(typeof navigator === "undefined" ? "" : navigator.userAgent),
    [],
  );

  const goExplore = useCallback(() => {
    if (location.pathname.startsWith("/explore")) {
      navigate(`${location.pathname}${location.search}`);
    } else {
      navigate("/explore");
    }
  }, [location.pathname, location.search, navigate]);

  const stepIndicator = useCallback(
    (delta: 1 | -1) => {
      if (!location.pathname.startsWith("/explore/")) {
        return;
      }
      const current = decodeURIComponent(location.pathname.slice("/explore/".length));
      void ports.dataset.getCatalog().then((result) => {
        if (!result.ok) {
          return;
        }
        const ordered = [...result.value.indicators].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        );
        const index = ordered.findIndex((indicator) => indicator.code === current);
        if (index === -1) {
          return;
        }
        const next = ordered[(index + delta + ordered.length) % ordered.length];
        if (next === undefined) {
          return;
        }
        const params = new URLSearchParams(location.search);
        params.delete("i");
        const query = params.toString();
        navigate(`/explore/${next.code}${query === "" ? "" : `?${query}`}`, { replace: true });
      });
    },
    [location.pathname, location.search, navigate, ports.dataset],
  );

  const currentSpec = useMemo(
    () => locationToViewSpec({ pathname: location.pathname, search: location.search }),
    [location.pathname, location.search],
  );
  const requestedViewId = useMemo(
    () => new URLSearchParams(location.search).get("view"),
    [location.search],
  );
  const datasetInfoQuery = useQuery({
    queryKey: ["dataset", "info"],
    queryFn: () => ports.dataset.getInfo(),
  });
  const fatalDatasetError =
    datasetInfoQuery.data?.ok === false &&
    (datasetInfoQuery.data.error.code === "SNAPSHOT_INVALID" ||
      datasetInfoQuery.data.error.code === "SNAPSHOT_NOT_FOUND")
      ? datasetInfoQuery.data.error
      : null;
  const viewsQuery = useQuery({
    queryKey: ["views", "list"],
    queryFn: () => listViews(ports.views),
    enabled: saveViewOpen || requestedViewId !== null,
  });
  const existingView = useMemo(() => {
    if (requestedViewId === null || viewsQuery.data?.ok !== true) {
      return null;
    }
    return viewsQuery.data.value.find((view) => view.id === requestedViewId) ?? null;
  }, [requestedViewId, viewsQuery.data]);

  const context = useMemo<CommandContext>(
    () => ({
      platform,
      pathname: location.pathname,
      navigate: (path) => navigate(path),
      goExplore,
      openPalette: () => setPaletteOpen(true),
      openShortcuts: () => setShortcutsOpen(true),
      toggleTheme: toggle,
      setLanguage: setLang,
      stepIndicator,
      canSaveView: currentSpec !== null,
      openSaveView: () => setSaveViewOpen(true),
      canExportCsv: exportActions.available.csv,
      canExportPng: exportActions.available.png,
      exportFile: exportActions.run,
    }),
    [
      currentSpec,
      exportActions,
      goExplore,
      location.pathname,
      navigate,
      platform,
      setLang,
      stepIndicator,
      toggle,
    ],
  );

  useShortcuts({ context });

  const paletteCommands = useMemo<PaletteCommand[]>(
    () =>
      availableCommands(context)
        .filter((command) => command.paletteGroup !== undefined)
        .map((command) => ({
          id: command.id,
          title: t(command.titleKey),
          keywords: command.keywords,
          ...(command.shortcut === undefined
            ? {}
            : { detail: formatShortcut(command.shortcut, platform) }),
        })),
    [context, platform, t],
  );

  const shortcutEntries = useMemo<ShortcutEntry[]>(
    () =>
      COMMANDS.filter((command) => command.shortcut !== undefined).map((command) => ({
        id: command.id,
        title: t(command.titleKey),
        keys: parseShortcut(command.shortcut ?? "").map((stroke) =>
          formatShortcut(stroke, platform),
        ),
      })),
    [platform, t],
  );

  const paletteActions = useMemo<PaletteActions>(
    () => ({
      openIndicator: (code) => {
        const params = new URLSearchParams(
          location.pathname.startsWith("/explore") ? location.search : "",
        );
        params.delete("i");
        const query = params.toString();
        navigate(`/explore/${code}${query === "" ? "" : `?${query}`}`);
      },
      openGeography: (code) => {
        if (location.pathname.startsWith("/compare/trajectories")) {
          const params = new URLSearchParams(location.search);
          params.set("g", code);
          navigate(`/compare/trajectories?${params.toString()}`);
          return;
        }
        const onExplore = location.pathname.startsWith("/explore/");
        const params = new URLSearchParams(onExplore ? location.search : "");
        params.delete("i");
        const existing = (params.get("g") ?? "").split(",").filter((value) => value !== "");
        const geographies = [...new Set(["ECU", ...existing, code])].slice(0, 5);
        params.set("g", geographies.join(","));
        const indicator = onExplore
          ? location.pathname.slice("/explore/".length)
          : FALLBACK_INDICATOR;
        navigate(`/explore/${indicator}?${params.toString()}`);
      },
      openView: (view) => navigate(viewSpecPath(view.spec)),
      runCommand: (id) => {
        const command = commandById(id);
        if (command !== undefined) {
          command.run(context);
        }
      },
    }),
    [context, location.pathname, location.search, navigate],
  );

  if (fatalDatasetError !== null) {
    return <SnapshotProblemScreen error={fatalDatasetError} />;
  }

  return (
    <div className={styles.app}>
      <SkipLink />
      <Sidebar collapsed={collapsed} onToggle={() => setManualCollapse(!collapsed)} />
      <div className={styles.body}>
        <TopBar />
        <main id="main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={paletteCommands}
        actions={paletteActions}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        entries={shortcutEntries}
      />
      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        spec={currentSpec}
        existing={existingView}
      />
    </div>
  );
}
