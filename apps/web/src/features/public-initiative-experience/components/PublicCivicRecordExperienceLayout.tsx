"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

interface PublicCivicRecordExperienceLayoutProps {
  hero: ReactNode;
  lifecycle: ReactNode;
  center: ReactNode;
  sidebar: ReactNode;
}

/**
 * Canonical Initiative Experience shell (Lifecycle Staging Fix 05 / 05B).
 */
export function PublicCivicRecordExperienceLayout({
  hero,
  lifecycle,
  center,
  sidebar,
}: PublicCivicRecordExperienceLayoutProps) {
  const t = useTranslations("initiativeExperience");
  return (
    <main className="pie-page">
      <div className="pie-layout__hero">{hero}</div>

      <div className="pie-layout pie-layout__columns">
        <aside className="pie-layout__lifecycle" aria-label={t("common.lifecycleStagesAria")}>
          {lifecycle}
        </aside>
        <div className="pie-layout__center">
          <div className="pie-layout__center-body">{center}</div>
        </div>
        <aside className="pie-layout__sidebar" aria-label={t("common.initiativeSidebarAria")}>
          {sidebar}
        </aside>
      </div>
    </main>
  );
}
