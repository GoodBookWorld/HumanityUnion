"use client";

import { useTranslations } from "next-intl";

interface CivicArchivePageChromeProps {
  /** When true, show filtersLoading as the intro (route loading shell). */
  loading?: boolean;
}

export function CivicArchivePageChrome({ loading = false }: CivicArchivePageChromeProps) {
  const t = useTranslations("initiativeExperience.civicArchivePublic");

  return (
    <header className="civic-archive-page__header">
      <h1>{t("pageTitle")}</h1>
      <p className="civic-archive-page__intro">{loading ? t("filtersLoading") : t("pageIntro")}</p>
    </header>
  );
}
