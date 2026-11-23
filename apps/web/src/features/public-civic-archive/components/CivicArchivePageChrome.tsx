"use client";

import { useTranslations } from "next-intl";

import { useBrandSiteName } from "../../brand-localization/useLocalizedBrand";

interface CivicArchivePageChromeProps {
  /** When true, show filtersLoading as the intro (route loading shell). */
  loading?: boolean;
}

export function CivicArchivePageChrome({ loading = false }: CivicArchivePageChromeProps) {
  const t = useTranslations("initiativeExperience.civicArchivePublic");
  const siteName = useBrandSiteName();

  return (
    <header className="civic-archive-page__header">
      <h1>{t("pageTitle", { siteName })}</h1>
      <p className="civic-archive-page__intro">{loading ? t("filtersLoading") : t("pageIntro")}</p>
    </header>
  );
}
