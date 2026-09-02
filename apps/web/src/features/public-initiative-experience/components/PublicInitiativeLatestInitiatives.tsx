"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
} from "../initiative-experience-i18n";

export function PublicInitiativeLatestInitiatives({
  initiatives,
}: {
  initiatives: WorldInitiativeCardProjection[];
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  if (initiatives.length === 0) {
    return null;
  }

  return (
    <section className="pie-latest" aria-labelledby="pie-latest-title">
      <h2 id="pie-latest-title">{t("sidebar.latest.title")}</h2>
      <ul className="pie-latest__list">
        {initiatives.map((initiative) => (
          <li key={initiative.initiativeId}>
            <Link href={initiative.publicInitiativeHref} className="pie-latest__card">
              <div className="pie-latest__thumb">
                <InitiativeImage title={initiative.title} imageUrl={initiative.imageUrl} />
              </div>
              <div className="pie-latest__body">
                <h3>{initiative.title}</h3>
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
        ))}
      </ul>
    </section>
  );
}
