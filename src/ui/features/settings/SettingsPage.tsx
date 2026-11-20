/**
 * Settings page (S8): appearance, updates, dataset and storage.
 *
 * Every change is applied to the live providers immediately and persisted to
 * the authoritative settings document. Dataset failures leave the previous
 * snapshot active and explain what happened inline.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSettings, updateSettings } from "../../../core/application/use-cases/settings";
import { openSnapshot, resetSnapshot } from "../../../core/application/use-cases/snapshot";
import { checkForUpdates } from "../../../core/application/use-cases/updates";
import type { LangPref, Settings, ThemePref, UpdateStatus } from "../../../core/domain/model";
import { Button } from "../../design/primitives/Button/Button";
import { ErrorState } from "../../design/primitives/ErrorState/ErrorState";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { Skeleton } from "../../design/primitives/Skeleton/Skeleton";
import { Switch } from "../../design/primitives/Switch/Switch";
import { useToast } from "../../design/primitives/Toast/Toast";
import { useTheme } from "../../design/ThemeProvider";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import styles from "./SettingsPage.module.css";

type CheckState = "idle" | "checking" | "upToDate" | "available" | "disabled" | "error";

/** Settings sections wired to the ports. */
export function SettingsPage() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const { t, setPref: setLanguage } = useT();
  const { setPref: setTheme } = useTheme();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [datasetBusy, setDatasetBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(ports.settings),
  });
  const datasetQuery = useQuery({
    queryKey: ["dataset", "info"],
    queryFn: () => ports.dataset.getInfo(),
  });
  const appInfoQuery = useQuery({
    queryKey: ["appInfo"],
    queryFn: () => ports.appInfo.get(),
  });

  if (settingsQuery.isPending) {
    return (
      <section className={styles.page} aria-labelledby="settings-title">
        <h1 id="settings-title">{t("page.settings.title")}</h1>
        <p role="status">{t("settings.loading")}</p>
        <Skeleton height={240} />
      </section>
    );
  }

  if (settingsQuery.data?.ok !== true) {
    const failure = settingsQuery.data?.ok === false ? settingsQuery.data.error : null;
    return (
      <section className={styles.page} aria-labelledby="settings-title">
        <h1 id="settings-title">{t("page.settings.title")}</h1>
        <ErrorState
          message={failure?.message ?? t("settings.saveError")}
          {...(failure === null ? {} : { details: `${failure.code}: ${failure.message}` })}
          onRetry={() => {
            void settingsQuery.refetch();
          }}
        />
      </section>
    );
  }

  const settings = settingsQuery.data.value;
  const dataset = datasetQuery.data?.ok === true ? datasetQuery.data.value : null;
  const appInfo = appInfoQuery.data?.ok === true ? appInfoQuery.data.value : null;

  async function persist(patch: Partial<Settings>): Promise<void> {
    const next: Settings = { ...settings, ...patch };
    queryClient.setQueryData(["settings"], { ok: true as const, value: next });
    const result = await updateSettings(ports.settings, next);
    if (!result.ok) {
      showToast({
        title: t("settings.saveError"),
        description: `${result.error.code}: ${result.error.message}`,
        variant: "danger",
      });
    }
  }

  async function runCheck(): Promise<void> {
    setChecking(true);
    setCheckState("checking");
    const result = await checkForUpdates(ports.updates, true);
    setChecking(false);
    if (!result.ok) {
      setUpdateStatus(null);
      setCheckState("error");
      return;
    }
    setUpdateStatus(result.value);
    switch (result.value.kind) {
      case "up_to_date":
        setCheckState("upToDate");
        break;
      case "available":
        setCheckState("available");
        break;
      case "disabled":
        setCheckState("disabled");
        break;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  async function openDataset(): Promise<void> {
    setDatasetError(null);
    const picked = await ports.snapshotPicker.pickSnapshot();
    if (!picked.ok) {
      setDatasetError(picked.error.message);
      return;
    }
    if (picked.value === null) {
      return;
    }
    setDatasetBusy(true);
    const opened = await openSnapshot(ports.dataset, picked.value);
    setDatasetBusy(false);
    if (!opened.ok) {
      setDatasetError(`${t("settings.dataset.openError")} ${opened.error.message}`);
      return;
    }
    showToast({ title: t("settings.dataset.opened"), variant: "success" });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dataset"] }),
      queryClient.invalidateQueries({ queryKey: ["explore"] }),
      queryClient.invalidateQueries({ queryKey: ["views"] }),
    ]);
  }

  async function resetDataset(): Promise<void> {
    setDatasetError(null);
    setDatasetBusy(true);
    const restored = await resetSnapshot(ports.dataset);
    setDatasetBusy(false);
    if (!restored.ok) {
      setDatasetError(`${t("snapshotProblem.resetError")} ${restored.error.message}`);
      return;
    }
    showToast({ title: t("settings.dataset.resetDone"), variant: "success" });
    await queryClient.invalidateQueries({ queryKey: ["dataset"] });
  }

  async function copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied(null);
    }
  }

  const themeOptions = [
    { value: "system", label: t("shell.themeSystem") },
    { value: "light", label: t("shell.themeLight") },
    { value: "dark", label: t("shell.themeDark") },
  ];
  const languageOptions = [
    { value: "system", label: t("shell.langSystem") },
    { value: "en", label: t("shell.langEnglish") },
    { value: "es", label: t("shell.langSpanish") },
  ];

  return (
    <section className={styles.page} aria-labelledby="settings-title">
      <header>
        <h1 id="settings-title">{t("page.settings.title")}</h1>
        <p className={styles.description}>{t("page.settings.description")}</p>
      </header>

      <section className={styles.section} aria-labelledby="settings-appearance">
        <h2 id="settings-appearance">{t("settings.appearance.title")}</h2>
        <p className={styles.description}>{t("settings.appearance.description")}</p>
        <div className={styles.row}>
          <span className={styles.label}>{t("settings.theme.label")}</span>
          <SegmentedControl
            label={t("settings.theme.label")}
            options={themeOptions}
            value={settings.theme}
            testId="theme-segmented"
            onValueChange={(value) => {
              const theme = value as ThemePref;
              setTheme(theme);
              void persist({ theme });
            }}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t("settings.language.label")}</span>
          <SegmentedControl
            label={t("settings.language.label")}
            options={languageOptions}
            value={settings.language}
            testId="language-segmented"
            onValueChange={(value) => {
              const language = value as LangPref;
              setLanguage(language);
              void persist({ language });
            }}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-updates">
        <h2 id="settings-updates">{t("settings.updates.title")}</h2>
        <p className={styles.description}>{t("settings.updates.description")}</p>
        <Switch
          label={t("settings.updates.enable")}
          checked={settings.updateCheckEnabled}
          onCheckedChange={(enabled) => {
            void persist({ updateCheckEnabled: enabled });
          }}
        />
        <div className={styles.actions}>
          <Button loading={checking} onClick={() => void runCheck()}>
            {t("settings.updates.checkNow")}
          </Button>
        </div>
        <div className={styles.status} role="status" aria-live="polite">
          {checkState === "upToDate" && updateStatus?.kind === "up_to_date" ? (
            <p>{t("settings.updates.upToDate", { version: updateStatus.current })}</p>
          ) : null}
          {checkState === "available" && updateStatus?.kind === "available" ? (
            <p>
              {t("settings.updates.available", { version: updateStatus.latest })}{" "}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (updateStatus.kind === "available") {
                    void ports.externalLinks.open(updateStatus.url);
                  }
                }}
              >
                {t("settings.updates.openRelease")}
              </Button>
            </p>
          ) : null}
          {checkState === "disabled" ? <p>{t("settings.updates.disabled")}</p> : null}
          {checkState === "error" ? (
            <p className={styles.error}>{t("settings.updates.error")}</p>
          ) : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-dataset">
        <h2 id="settings-dataset">{t("settings.dataset.title")}</h2>
        <p className={styles.description}>{t("settings.dataset.description")}</p>
        {dataset === null ? null : (
          <dl className={styles.meta}>
            <div>
              <dt>{t("settings.dataset.source")}</dt>
              <dd>
                {dataset.sourceName} · {dataset.sourcePublisher}
              </dd>
            </div>
            <div>
              <dt>{t("about.license")}</dt>
              <dd>{dataset.license}</dd>
            </div>
            <div>
              <dt>{t("about.counts")}</dt>
              <dd>
                {t("settings.dataset.counts", {
                  indicators: dataset.counts.indicators,
                  geographies: dataset.counts.geographies,
                  observations: dataset.counts.observations,
                })}
              </dd>
            </div>
          </dl>
        )}
        {datasetError === null ? null : (
          <p className={styles.error} role="alert">
            {datasetError}
          </p>
        )}
        <div className={styles.actions}>
          <Button loading={datasetBusy} onClick={() => void openDataset()}>
            {t("settings.dataset.open")}
          </Button>
          <Button variant="ghost" onClick={() => void resetDataset()}>
            {t("settings.dataset.reset")}
          </Button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-storage">
        <h2 id="settings-storage">{t("settings.storage.title")}</h2>
        <p className={styles.description}>{t("settings.storage.description")}</p>
        <div className={styles.storageRow}>
          <span className={styles.label}>{t("settings.storage.dataDir")}</span>
          <code className={styles.path}>{appInfo?.dataDir ?? "—"}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void copy(appInfo?.dataDir ?? "")}
            disabled={appInfo === null}
          >
            {copied === appInfo?.dataDir
              ? t("settings.storage.copied")
              : t("settings.storage.copy")}
          </Button>
        </div>
        <div className={styles.storageRow}>
          <span className={styles.label}>{t("settings.storage.logDir")}</span>
          <code className={styles.path}>{appInfo?.logDir ?? "—"}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void copy(appInfo?.logDir ?? "")}
            disabled={appInfo === null}
          >
            {copied === appInfo?.logDir ? t("settings.storage.copied") : t("settings.storage.copy")}
          </Button>
        </div>
      </section>
    </section>
  );
}
