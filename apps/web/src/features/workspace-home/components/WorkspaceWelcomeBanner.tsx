"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { isFirstWorkspaceVisit, markWorkspaceVisited } from "../workspace-first-visit";
import { resolveWorkspaceReadinessMissingLabel } from "../workspace-home-i18n";

import "./workspace-welcome-banner.css";

interface WorkspaceWelcomeBannerProps {
  workspaceReadiness: {
    status: "ready" | "missing";
    missing: string[];
  };
}

export function WorkspaceWelcomeBanner({ workspaceReadiness }: WorkspaceWelcomeBannerProps) {
  const t = useTranslations("workspace");
  const brand = useLocalizedBrand();
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    setFirstVisit(isFirstWorkspaceVisit());
    markWorkspaceVisited();
  }, []);

  if (firstVisit === null) {
    return null;
  }

  const missingLabels = workspaceReadiness.missing.map((code) =>
    resolveWorkspaceReadinessMissingLabel(t, code),
  );

  return (
    <div className="workspace-welcome-banner">
      <div className="workspace-welcome-banner__accent" aria-hidden="true" />
      <div className="workspace-welcome-banner__body">
        {firstVisit ? (
          <>
            <h2 className="workspace-welcome-banner__title">
              {t("home.welcomeTitle", { siteName: brand.siteName })}
            </h2>
            <p className="workspace-welcome-banner__text">{t("home.welcomeBody")}</p>
            <p className="workspace-welcome-banner__lead">{t("home.welcomeLead")}</p>
            <ul className="workspace-welcome-banner__list">
              <li>{t("home.welcomeChecklistProfile")}</li>
              <li>{t("home.welcomeChecklistPreferences")}</li>
              <li>{t("home.welcomeChecklistParticipation")}</li>
            </ul>
            <p className="workspace-welcome-banner__text">{t("home.welcomeClosing")}</p>
          </>
        ) : (
          <>
            <h2 className="workspace-welcome-banner__title">{t("home.welcomeBackTitle")}</h2>
            <p className="workspace-welcome-banner__text">{t("home.welcomeBackBody")}</p>
          </>
        )}
        {workspaceReadiness.status === "missing" && missingLabels.length > 0 ? (
          <p className="workspace-welcome-banner__still-needed">
            {t("home.stillNeeded", { items: missingLabels.join(", ") })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
