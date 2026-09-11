"use client";

import type { Initiative } from "@hu/types";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { ApiUnavailableState } from "../../../design-system";
import { isApiUnavailableError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { INITIATIVE_WORKSPACE_SECTION_IDS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { listMyInitiatives } from "../api";

import { InitiativesUnavailableWorkspace } from "./InitiativesUnavailableWorkspace";
import { InitiativeWorkspace } from "./InitiativeWorkspace";
import { PublicInitiativesLanding } from "./PublicInitiativesLanding";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

type GateState = "loading" | "public" | "workspace" | "unavailable";

export function InitiativesPageGate() {
  const t = useTranslations("workspace.initiativesPage");
  const [state, setState] = useState<GateState>("loading");
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const navItems = useMemo(
    () => [
      { id: INITIATIVE_WORKSPACE_SECTION_IDS[0], label: t("myInitiatives") },
      { id: INITIATIVE_WORKSPACE_SECTION_IDS[1], label: t("startNew") },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    void listMyInitiatives()
      .then((loaded) => {
        if (!cancelled) {
          setInitiatives(loaded);
          setState("workspace");
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(error)) {
          setState("public");
          return;
        }

        if (isApiUnavailableError(error)) {
          setState("unavailable");
          return;
        }

        setState("public");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle")}
        navItems={navItems}
        sectionsLabel={t("sectionsNavLabel")}
        sectionsAriaLabel={t("sectionsNavAria")}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <InitiativesUnavailableWorkspace>
          <p role="status">{t("loading")}</p>
        </InitiativesUnavailableWorkspace>
      </MemberWorkspace>
    );
  }

  if (state === "public") {
    return <PublicInitiativesLanding />;
  }

  if (state === "unavailable") {
    return (
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle")}
        navItems={navItems}
        sectionsLabel={t("sectionsNavLabel")}
        sectionsAriaLabel={t("sectionsNavAria")}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <InitiativesUnavailableWorkspace>
          <ApiUnavailableState
            title={t("unavailableTitle")}
            explanation={t("unavailableExplanation")}
            retryHref="/workspace/initiatives"
            retryLabel={t("retry")}
            homeLabel={t("returnHome")}
          />
        </InitiativesUnavailableWorkspace>
      </MemberWorkspace>
    );
  }

  return (
    <MemberWorkspace
      title={t("title")}
      subtitle={t("subtitle")}
      navItems={navItems}
      sectionsLabel={t("sectionsNavLabel")}
      sectionsAriaLabel={t("sectionsNavAria")}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      <InitiativeWorkspace initialInitiatives={initiatives} />
    </MemberWorkspace>
  );
}
