"use client";

import type { Initiative } from "@hu/types";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { ApiUnavailableState } from "../../../design-system";
import { isApiUnavailableError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { listMyInitiatives } from "../api";

import { InitiativesUnavailableWorkspace } from "./InitiativesUnavailableWorkspace";
import { InitiativeWorkspace } from "./InitiativeWorkspace";
import { PublicInitiativesLanding } from "./PublicInitiativesLanding";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

const NAV_ITEMS = [...INITIATIVE_WORKSPACE_SECTIONS];

type GateState = "loading" | "public" | "workspace" | "unavailable";

export function InitiativesPageGate() {
  const [state, setState] = useState<GateState>("loading");
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

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
        title="Initiatives"
        subtitle="Participation initiatives in Humanity Union"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <InitiativesUnavailableWorkspace>
          <p role="status">Loading initiatives workspace…</p>
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
        title="Initiatives"
        subtitle="Participation initiatives in Humanity Union"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <InitiativesUnavailableWorkspace>
          <ApiUnavailableState
            title="Workspace temporarily unavailable"
            explanation="We couldn't connect to the Initiative service. Please try again shortly."
            retryHref="/workspace/initiatives"
            retryLabel="Retry"
            homeLabel="Return Home"
          />
        </InitiativesUnavailableWorkspace>
      </MemberWorkspace>
    );
  }

  return (
    <MemberWorkspace
      title="Initiatives"
      subtitle="Participation initiatives in Humanity Union"
      navItems={NAV_ITEMS}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      <InitiativeWorkspace initialInitiatives={initiatives} />
    </MemberWorkspace>
  );
}
