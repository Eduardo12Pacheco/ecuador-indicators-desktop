import { useState } from "react";

import { type Geography, geographyName, type Iso3 } from "../../../core/domain/model";
import { Button } from "../../design/primitives/Button/Button";
import { Chip } from "../../design/primitives/Chip/Chip";
import { LiveRegion } from "../../design/primitives/LiveRegion/LiveRegion";
import { useT } from "../../i18n/useT";
import styles from "./PeersControl.module.css";

/** Maximum peers besides Ecuador (five series total). */
export const MAX_PEERS = 4;

export interface PeersControlProps {
  readonly geographies: readonly Geography[];
  readonly selected: readonly Iso3[];
  readonly onChange: (geographies: readonly Iso3[]) => void;
}

/** Peer chips with Ecuador fixed and a hard limit of four peers (S3). */
export function PeersControl({ geographies, selected, onChange }: PeersControlProps) {
  const { t, lang } = useT();
  const [message, setMessage] = useState("");
  const peers = selected.filter((code) => code !== "ECU");
  const atMax = peers.length >= MAX_PEERS;
  const available = geographies
    .filter((geography) => geography.iso3 !== "ECU" && !selected.includes(geography.iso3))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const add = (geography: Geography) => {
    if (atMax) {
      setMessage(t("explore.peers.max"));
      return;
    }
    setMessage(t("explore.peers.added", { name: geographyName(geography, lang) }));
    onChange([...selected, geography.iso3]);
  };

  return (
    <section className={styles.control} aria-labelledby="peers-title">
      <h3 id="peers-title" className={styles.title}>
        {t("explore.peers.title")}
      </h3>
      <div className={styles.chips}>
        <Chip>{t("explore.peers.ecuadorFixed")}</Chip>
        {peers.map((code) => {
          const geography = geographies.find((candidate) => candidate.iso3 === code);
          if (geography === undefined) {
            return null;
          }
          return (
            <Chip
              key={code}
              label={geographyName(geography, lang)}
              onRemove={() => {
                setMessage("");
                onChange(selected.filter((candidate) => candidate !== code));
              }}
            >
              {geographyName(geography, lang)}
            </Chip>
          );
        })}
      </div>
      {available.length > 0 ? (
        <div className={styles.available}>
          {available.map((geography) => (
            <Button
              key={geography.iso3}
              size="sm"
              variant="ghost"
              aria-disabled={atMax}
              onClick={() => add(geography)}
            >
              {atMax
                ? geographyName(geography, lang)
                : t("explore.peers.add", { name: geographyName(geography, lang) })}
            </Button>
          ))}
        </div>
      ) : null}
      <LiveRegion>{message}</LiveRegion>
    </section>
  );
}
