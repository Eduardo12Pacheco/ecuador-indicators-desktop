import { useQuery } from "@tanstack/react-query";
import { useT } from "../../ui/i18n/useT";
import { usePorts } from "../../ui/ports-context";
import { APP_VERSION } from "../meta";
import styles from "./StatusBar.module.css";

/** Status bar: active dataset label and app version, read-only. */
export function StatusBar() {
  const { t } = useT();
  const { dataset } = usePorts();
  const { data, isPending } = useQuery({
    queryKey: ["dataset", "info"],
    queryFn: () => dataset.getInfo(),
  });

  const label = isPending
    ? t("status.loadingDataset")
    : data?.ok === true
      ? data.value.sourceName
      : t("status.bundled");

  return (
    <footer className={styles.statusbar}>
      <span className={styles.item}>
        {t("status.dataset")}: <span className={styles.value}>{label}</span>
      </span>
      <span className={styles.item}>
        {t("status.version")} <span className={styles.mono}>{APP_VERSION}</span>
      </span>
    </footer>
  );
}
