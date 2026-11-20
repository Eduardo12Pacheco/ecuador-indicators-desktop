import { Download, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { useT } from "../../../i18n/useT";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Chip } from "../Chip/Chip";
import { Dialog } from "../Dialog/Dialog";
import { EmptyState } from "../EmptyState/EmptyState";
import { ErrorState } from "../ErrorState/ErrorState";
import { IconButton } from "../IconButton/IconButton";
import { Kbd } from "../Kbd/Kbd";
import { LiveRegion } from "../LiveRegion/LiveRegion";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { Skeleton } from "../Skeleton/Skeleton";
import { Slider } from "../Slider/Slider";
import { Spinner } from "../Spinner/Spinner";
import { Switch } from "../Switch/Switch";
import { Tabs } from "../Tabs/Tabs";
import { ToastProvider, useToast } from "../Toast/Toast";
import { Tooltip } from "../Tooltip/Tooltip";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";
import styles from "./DesignGallery.module.css";

const SWATCHES = [
  "color-bg",
  "color-surface",
  "color-surface-2",
  "color-border",
  "color-border-strong",
  "color-text",
  "color-text-muted",
  "color-primary",
  "color-danger",
  "color-success",
  "color-warning",
  "color-accent",
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "series-5",
  "series-6",
] as const;

function GalleryBody() {
  const { t, lang, setLang } = useT();
  const { showToast } = useToast();
  const [checked, setChecked] = useState(false);
  const [slider, setSlider] = useState<readonly [number, number]>([1980, 2020]);
  const [segment, setSegment] = useState("level");

  return (
    <div className={styles.gallery}>
      <header className={styles.intro}>
        <h1>{t("page.design.title")}</h1>
        <p>{t("page.design.description")}</p>
        <p className={styles.note}>{t("page.design.gallery.description")}</p>
      </header>

      <section aria-labelledby="gallery-tokens">
        <h2 id="gallery-tokens">Tokens</h2>
        <ul className={styles.swatches}>
          {SWATCHES.map((token) => (
            <li key={token} className={styles.swatch}>
              <span
                className={styles.chipColor}
                style={{ background: `var(--${token})` }}
                aria-hidden="true"
              />
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gallery-buttons">
        <h2 id="gallery-buttons">Buttons</h2>
        <div className={styles.row}>
          <Button variant="primary">
            <Download size={16} aria-hidden="true" /> Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 size={16} aria-hidden="true" /> Danger
          </Button>
          <Button loading>Loading</Button>
          <Button size="sm">Small</Button>
          <Tooltip label="Export the visible CSV">
            <IconButton label="Export CSV">
              <Download size={18} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <IconButton label="Add a peer">
            <Plus size={18} aria-hidden="true" />
          </IconButton>
          <IconButton label="Remove" variant="danger" size="sm">
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>
        <p className={styles.row}>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
          <span>opens the command palette</span>
        </p>
      </section>

      <section aria-labelledby="gallery-form">
        <h2 id="gallery-form">Form controls</h2>
        <Card as="div" className={styles.stack}>
          <Switch
            label="Check for updates"
            description="Introduce yourself only when the user opts in."
            checked={checked}
            onCheckedChange={setChecked}
          />
          <Slider
            label="Year range"
            min={1960}
            max={2025}
            value={slider}
            onValueChange={setSlider}
          />
          <SegmentedControl
            label="Transform"
            value={segment}
            onValueChange={setSegment}
            options={[
              { value: "level", label: "Level" },
              { value: "yoy", label: "YoY %" },
              { value: "index", label: "Index" },
            ]}
          />
          <div className={styles.row}>
            <Chip label="Colombia">Colombia</Chip>
            <Chip label="Peru" onRemove={() => undefined}>
              Peru
            </Chip>
          </div>
        </Card>
      </section>

      <section aria-labelledby="gallery-navigation">
        <h2 id="gallery-navigation">Navigation</h2>
        <Tabs
          label="Compare modes"
          defaultValue="trajectories"
          items={[
            {
              value: "trajectories",
              label: "Trajectories",
              content: <p>Indexed to a base year.</p>,
            },
            { value: "ranking", label: "Ranking", content: <p>One year, every geography.</p> },
          ]}
        />
      </section>

      <section aria-labelledby="gallery-feedback">
        <h2 id="gallery-feedback">Feedback</h2>
        <div className={styles.stack}>
          <div className={styles.row}>
            <Skeleton width={160} height={16} />
            <Skeleton width={80} height={16} />
            <Spinner label="Loading indicators" />
          </div>
          <EmptyState
            title="No saved views yet"
            description="Save an Explore view to reopen it later."
            action={<Button variant="primary">Go to Explore</Button>}
          />
          <ErrorState
            title="Catalog unavailable"
            message="STORAGE: the database is busy."
            details="at SqliteSnapshotReader::catalog (open.rs:42)"
            onRetry={() => undefined}
          />
          <div className={styles.row}>
            <Button
              onClick={() => showToast({ title: "View saved", description: "GDP in Ecuador" })}
            >
              Show a toast
            </Button>
            <VisuallyHidden>Screen-reader-only helper text</VisuallyHidden>
            <LiveRegion>Ecuador, 2024: 1,234</LiveRegion>
          </div>
        </div>
      </section>

      <section aria-labelledby="gallery-overlays">
        <h2 id="gallery-overlays">Overlays</h2>
        <Dialog
          trigger={<Button variant="primary">Open dialog</Button>}
          title="Save this view"
          description="Name the view so you can reopen it later."
        >
          <label className={styles.field}>
            View name
            <input defaultValue="GDP in Ecuador" />
          </label>
        </Dialog>
      </section>

      <section aria-labelledby="gallery-language">
        <h2 id="gallery-language">Language</h2>
        <SegmentedControl
          label="Language"
          value={lang}
          onValueChange={(value) => setLang(value === "es" ? "es" : "en")}
          options={[
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
        />
      </section>
    </div>
  );
}

/** Development-only gallery of tokens and primitives in both themes. */
export function DesignGallery() {
  return (
    <ToastProvider>
      <GalleryBody />
    </ToastProvider>
  );
}
