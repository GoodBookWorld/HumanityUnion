"use client";

import { useTranslations } from "next-intl";

import type { CommunityCatalogPublicProjection } from "@hu/types";

import { ExperienceBlockShell } from "../../public-experience";
import { CommunityDiscoveryEvidence } from "./CommunityDiscoveryEvidence";

interface CommunityDiscoverySectionProps {
  catalog: CommunityCatalogPublicProjection;
  regionName: string;
}

export function CommunityDiscoverySection({ catalog, regionName }: CommunityDiscoverySectionProps) {
  const t = useTranslations("publicGeo.region.discovery");

  return (
    <ExperienceBlockShell
      id="community-discovery"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction")}
      visitorConclusion={t("visitorConclusion")}
    >
      <CommunityDiscoveryEvidence catalog={catalog} regionName={regionName} />
    </ExperienceBlockShell>
  );
}
