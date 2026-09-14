"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { CommunityCatalogPublicProjection } from "@hu/types";

import { ExperienceBlockShell } from "../../public-experience";
import { FindYourCommunityEvidence } from "./FindYourCommunityEvidence";

interface FindYourCommunitySectionProps {
  catalog: CommunityCatalogPublicProjection;
  currentCommunitySlug: string;
}

export function FindYourCommunitySection({
  catalog,
  currentCommunitySlug,
}: FindYourCommunitySectionProps) {
  const t = useTranslations("publicGeo.community.find");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="find-your-community"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", siteName)}
      visitorConclusion={t("visitorConclusion")}
    >
      <FindYourCommunityEvidence catalog={catalog} currentCommunitySlug={currentCommunitySlug} />
    </ExperienceBlockShell>
  );
}
