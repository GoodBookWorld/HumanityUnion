"use client";

import { useTranslations } from "next-intl";

export function CivicArchiveFiltersLoading() {
  const t = useTranslations("initiativeExperience.civicArchivePublic");
  return <p className="civic-archive-page__filters-loading">{t("filtersLoading")}</p>;
}
