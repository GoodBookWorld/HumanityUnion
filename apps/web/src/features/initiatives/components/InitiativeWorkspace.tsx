"use client";

import type { Initiative } from "@hu/types";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { MyInitiativesDashboard } from "./MyInitiativesDashboard";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { WorkspaceCivicAssistant } from "../../workspace-civic-assistant/components/WorkspaceCivicAssistant";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { useWorkspaceSectionTracker } from "../../workspace-civic-assistant/use-workspace-section-tracker";
import { buildInitiativeExperienceManageHref } from "../../initiative-owner-studio/initiative-experience-routes";

import "./initiative-workspace-layout.css";
import "../../initiative-workspace-ux/initiative-workspace-ux.css";

interface InitiativeWorkspaceProps {
  initialInitiatives: Initiative[];
}

export function InitiativeWorkspace({ initialInitiatives }: InitiativeWorkspaceProps) {
  const router = useRouter();
  const currentSection = useWorkspaceSectionTracker(INITIATIVE_WORKSPACE_SECTIONS);

  useEffect(() => {
    function focusCreateSection(): void {
      if (window.location.hash !== "#create") {
        return;
      }

      const section = document.getElementById("create");

      if (!section) {
        return;
      }

      section.scrollIntoView({ behavior: "smooth", block: "start" });

      const focusTarget = section.querySelector("input");

      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus({ preventScroll: true });
      }
    }

    focusCreateSection();
    window.addEventListener("hashchange", focusCreateSection);

    return () => {
      window.removeEventListener("hashchange", focusCreateSection);
    };
  }, []);

  function handleCreated(initiative: Initiative) {
    router.push(buildInitiativeExperienceManageHref(initiative.initiativeId));
  }

  return (
    <div className="initiative-workspace-layout">
      <div className="initiative-workspace-layout__content">
        <ProfileSection title="My Initiatives">
          <MyInitiativesDashboard initiatives={initialInitiatives} />
        </ProfileSection>

        <ProfileSection title="Start New Initiative">
          <Suspense fallback={<p role="status">Loading initiative form…</p>}>
            <StartNewInitiativeButton onCreated={handleCreated} />
          </Suspense>
        </ProfileSection>
      </div>

      <WorkspaceCivicAssistant initiative={null} currentSection={currentSection} />
    </div>
  );
}
