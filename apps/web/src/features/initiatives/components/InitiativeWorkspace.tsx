"use client";

import type { Initiative } from "@hu/types";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { HuFeedbackMessage } from "../../../design-system/components/HuFeedbackMessage";
import { MyInitiativesDashboard } from "./MyInitiativesDashboard";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";
import { buildInitiativeExperienceManageHref } from "../../initiative-owner-studio/initiative-experience-routes";

import "./initiative-workspace-layout.css";
import "../../initiative-workspace-ux/initiative-workspace-ux.css";

/**
 * Initiative UX Pack 01.1 Part 7 — reads the `draftDeleted` query param set
 * by `InitiativeDraftEditor` after a successful delete-and-redirect, and
 * shows the required "Draft Initiative deleted." confirmation once. Kept
 * as its own component (rather than inline in `InitiativeWorkspace`)
 * purely so `useSearchParams()` can sit behind its own `<Suspense>`
 * boundary, matching the convention already used for
 * `StartNewInitiativeButton` just below it.
 */
function DraftDeletedNotice() {
  const searchParams = useSearchParams();

  if (searchParams.get("draftDeleted") !== "1") {
    return null;
  }

  return (
    <HuFeedbackMessage variant="success">Draft Initiative deleted.</HuFeedbackMessage>
  );
}

interface InitiativeWorkspaceProps {
  initialInitiatives: Initiative[];
}

export function InitiativeWorkspace({ initialInitiatives }: InitiativeWorkspaceProps) {
  const router = useRouter();

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
        <Suspense fallback={null}>
          <DraftDeletedNotice />
        </Suspense>

        <ProfileSection title="My Initiatives">
          <MyInitiativesDashboard initiatives={initialInitiatives} />
        </ProfileSection>

        <ProfileSection title="Start New Initiative">
          <Suspense fallback={<p role="status">Loading initiative form…</p>}>
            <StartNewInitiativeButton onCreated={handleCreated} />
          </Suspense>
        </ProfileSection>
      </div>

      <HumanityUnionAssistantWidget
        surfaceId="initiatives"
        description="I can help you create, review and advance your Initiatives."
      />
    </div>
  );
}
