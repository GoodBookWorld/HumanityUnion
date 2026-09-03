"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { WORKSPACE_ROUTE } from "../constants";
import { ExperienceBlockShell, REGISTRATION_ROUTE } from "../../public-experience";

interface RegistrationGatewayWorkspaceSectionProps {
  communityName: string;
  isAuthenticated?: boolean;
}

export function RegistrationGatewayWorkspaceSection({
  communityName,
  isAuthenticated = false,
}: RegistrationGatewayWorkspaceSectionProps) {
  const t = useTranslations("publicGeo");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="registration-gateway-workspace"
      title={
        isAuthenticated
          ? t("shared.registration.workspaceActionLabel")
          : t("community.registration.title", siteName)
      }
      architecturalName={t("community.registration.architecturalName")}
      stage={t("community.registration.stage")}
      contextIntroduction={
        isAuthenticated
          ? t("shared.registration.workspaceContinuationContext", { communityName })
          : t("shared.registration.contextIntroductionNamed", { communityName, ...siteName })
      }
      visitorConclusion={t("shared.registration.visitorConclusion")}
    >
      <div className="registration-gateway">
        <p className="registration-gateway__invitation">
          {isAuthenticated
            ? t("shared.registration.authenticatedNote")
            : t("shared.registration.invitation")}
        </p>
        <p className="registration-gateway__exploration-note">
          {t("shared.registration.explorationNoteWorkspace")}
        </p>

        <div className="registration-gateway__actions">
          {isAuthenticated ? (
            <Link className="registration-gateway__action" href={WORKSPACE_ROUTE}>
              {t("shared.registration.workspaceActionLabel")}
            </Link>
          ) : (
            <Link className="registration-gateway__action" href={REGISTRATION_ROUTE}>
              {t("shared.registration.actionLabel")}
            </Link>
          )}
        </div>

        <p className="registration-gateway__boundary" role="note">
          {t("shared.registration.boundaryNote")}
        </p>
      </div>
    </ExperienceBlockShell>
  );
}
