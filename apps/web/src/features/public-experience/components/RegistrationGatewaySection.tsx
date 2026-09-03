"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { ExperienceBlockShell } from "./ExperienceBlockShell";
import { RegistrationGatewayEvidence } from "./RegistrationGatewayEvidence";

export function RegistrationGatewaySection() {
  const t = useTranslations("publicGeo.shared.registration");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="registration-gateway"
      title={t("title", siteName)}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction")}
      visitorConclusion={t("visitorConclusion")}
    >
      <RegistrationGatewayEvidence />
    </ExperienceBlockShell>
  );
}
