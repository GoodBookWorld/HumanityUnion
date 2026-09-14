"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { useCivicInitiativeLocalizedTitle } from "../../language/use-civic-initiative-localized-title";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
} from "../initiative-experience-i18n";

function LatestInitiativeRow({ initiative }: { initiative: WorldInitiativeCardProjection }) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const displayTitle = useCivicInitiativeLocalizedTitle({
    initiativeId: initiative.initiativeId,
    canonicalTitle: initiative.title,
    canonicalSummary: initiative.summary,
  });

  return (
    <li>
      <Link href={initiative.publicInitiativeHref} className="pie-latest__card">
        <div className="pie-latest__thumb">
          <InitiativeImage title={displayTitle} imageUrl={initiative.imageUrl} />
        </div>
        <div className="pie-latest__body">
          <h3>{displayTitle}</h3>
          <p>
            {initiative.activityArea
              ? resolveActivityAreaDisplayLabel(initiative.activityArea, t)
              : null}
          </p>
          <p className="pie-latest__date">
            {formatInitiativeExperienceDate(locale, initiative.publishedAt, {
              month: "short",
            })}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function PublicInitiativeLatestInitiatives({
  initiatives,
}: {
  initiatives: WorldInitiativeCardProjection[];
}) {
  const t = useTranslations("initiativeExperience");

  if (initiatives.length === 0) {
    return null;
  }

  return (
    <section className="pie-latest" aria-labelledby="pie-latest-title">
      <h2 id="pie-latest-title">{t("sidebar.latest.title")}</h2>
      <ul className="pie-latest__list">
        {initiatives.map((initiative) => (
          <LatestInitiativeRow key={initiative.initiativeId} initiative={initiative} />
        ))}
      </ul>
    </section>
  );
}
