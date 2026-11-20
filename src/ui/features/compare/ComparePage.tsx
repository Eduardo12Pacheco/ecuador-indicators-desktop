import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";

import type { ChartRendererFactory } from "../../charts/renderer";
import { Tabs } from "../../design/primitives/Tabs/Tabs";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import styles from "./ComparePage.module.css";
import { CompareError, CompareSkeleton } from "./CompareStates";
import { RankingTab } from "./RankingTab";
import { TrajectoriesTab } from "./TrajectoriesTab";

/** Compare page shell with the two hash routes as tabs (S4, D7). */
export function ComparePage({
  chartRendererFactory,
}: {
  readonly chartRendererFactory?: ChartRendererFactory;
} = {}) {
  const ports = usePorts();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.endsWith("/ranking") ? "ranking" : "trajectories";

  const catalogQuery = useQuery({
    queryKey: ["dataset", "catalog"],
    queryFn: () => ports.dataset.getCatalog(),
  });
  const catalogResult = catalogQuery.data;
  const catalog = catalogResult?.ok === true ? catalogResult.value : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("page.compare.title")}</h1>
        <p className={styles.description}>{t("page.compare.description")}</p>
      </header>

      {catalogQuery.isPending ? <CompareSkeleton /> : null}

      {catalogResult !== undefined && !catalogResult.ok ? (
        <CompareError
          message={catalogResult.error.message}
          details={`${catalogResult.error.code}: ${catalogResult.error.message}`}
          onRetry={() => {
            void catalogQuery.refetch();
          }}
        />
      ) : null}

      {catalog !== null ? (
        <Tabs
          label={t("compare.tabs")}
          value={active}
          defaultValue="trajectories"
          onValueChange={(value) => navigate(`/compare/${value}`)}
          items={[
            {
              value: "trajectories",
              label: t("compare.tab.trajectories"),
              content: (
                <TrajectoriesTab
                  catalog={catalog}
                  {...(chartRendererFactory === undefined ? {} : { chartRendererFactory })}
                />
              ),
            },
            {
              value: "ranking",
              label: t("compare.tab.ranking"),
              content: (
                <RankingTab
                  catalog={catalog}
                  {...(chartRendererFactory === undefined ? {} : { chartRendererFactory })}
                />
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
