"use client";

import { useTranslations } from "next-intl";

import { ExperienceBlockShell } from "./ExperienceBlockShell";
import { RegistrationGatewayEvidence } from "./RegistrationGatewayEvidence";

export function RegistrationGatewaySection() {
  const t = useTranslations("publicGeo.shared.registration");

  return (
    <ExperienceBlockShell
      id="registration-gateway"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction")}
      visitorConclusion={t("visitorConclusion")}
    >
      <RegistrationGatewayEvidence />
    </ExperienceBlockShell>
  );
}
