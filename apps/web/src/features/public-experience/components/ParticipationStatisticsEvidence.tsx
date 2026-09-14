"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ParticipationPublicStatisticsProjection } from "@hu/types";

interface ParticipationStatisticsEvidenceProps {
  projection: ParticipationPublicStatisticsProjection;
}

export function ParticipationStatisticsEvidence({
  projection,
}: ParticipationStatisticsEvidenceProps) {
  const locale = useLocale();
  const t = useTranslations("publicStatistics");

  function localizeIndicatorLabel(id: string, fallback: string): string {
    const key = `geoIndicators.${id}.label` as const;
    if (t.has(key)) {
      return t(key);
    }
    return fallback;
  }

  return (
    <div className="global-statistics">
      <p className="global-statistics__scope">
        {t("shared.scopePrefix", { scope: projection.scopeLabel })}
        {projection.source === "bootstrap" ? (
          <span className="global-statistics__source">
            {" "}
            · {t("shared.bootstrapSource")}
          </span>
        ) : null}
      </p>

      <dl
        className="global-statistics__list"
        aria-label={t("shared.indicatorsAria", { scope: projection.scopeLabel })}
      >
        {projection.indicators.map((indicator) => (
          <div key={indicator.id} className="global-statistics__item">
            <dt className="global-statistics__label">
              {localizeIndicatorLabel(indicator.id, indicator.label)}
              {indicator.derived ? (
                <span className="global-statistics__derived">
                  {" "}
                  {t("shared.derivedSuffix")}
                </span>
              ) : null}
            </dt>
            <dd className="global-statistics__value">
              {indicator.value.toLocaleString(locale)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
