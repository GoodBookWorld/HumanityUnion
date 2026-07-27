"use client";

import type { Initiative } from "@hu/types";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { ApiUnavailableState, Button } from "../../../design-system";
import { Card } from "../../../design-system/components/Card";
import { isApiUnavailableError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { buildInitiativeExperienceManageHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { buildCreateInitiativeFromNewsHref } from "../../public-news/api";
import { resolveInitiativeCreateNewsSourceId } from "../initiative-create-news-source";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

import "./public-initiatives-landing.css";

type GateState = "loading" | "public" | "workspace" | "unavailable";

function CreateInitiativePageContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess(): Promise<void> {
      try {
        const { listMyInitiatives } = await import("../api");
        await listMyInitiatives();

        if (!cancelled) {
          setState("workspace");
        }
      } catch (error) {
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
      }
    }

    void resolveAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "workspace") {
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
  }, [state]);

  function handleCreated(initiative: Initiative) {
    router.push(buildInitiativeExperienceManageHref(initiative.initiativeId));
  }

  if (state === "loading") {
    return (
      <MemberWorkspace
        title="Create Initiative"
        subtitle="Start a new participation initiative"
        navItems={[...INITIATIVE_WORKSPACE_SECTIONS]}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <p role="status">Loading initiative form…</p>
      </MemberWorkspace>
    );
  }

  if (state === "public") {
    const newsId = resolveInitiativeCreateNewsSourceId(searchParams);
    const returnTo = newsId
      ? encodeURIComponent(buildCreateInitiativeFromNewsHref(newsId))
      : encodeURIComponent("/initiatives/create");

    return (
      <section className="public-initiatives-landing" aria-labelledby="create-initiative-heading">
        <Card>
          <h1 id="create-initiative-heading">Create Initiative</h1>
          <p className="public-initiatives-landing__message">
            Sign in or create an account to start a new initiative
            {newsId ? " from the selected news article" : ""}.
          </p>
          <div className="public-initiatives-landing__actions">
            <Button href={`/login?returnTo=${returnTo}`} variant="primary">
              Log in
            </Button>
            <Button href={`/register?returnTo=${returnTo}`}>Create account</Button>
          </div>
        </Card>
      </section>
    );
  }

  if (state === "unavailable") {
    const retryHref = searchParams.toString()
      ? `/initiatives/create?${searchParams.toString()}`
      : "/initiatives/create";

    return (
      <MemberWorkspace
        title="Create Initiative"
        subtitle="Start a new participation initiative"
        navItems={[...INITIATIVE_WORKSPACE_SECTIONS]}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <ApiUnavailableState
          title="Workspace temporarily unavailable"
          explanation="We couldn't connect to the Initiative service. Please try again shortly."
          retryHref={retryHref}
          retryLabel="Retry"
          homeLabel="Return Home"
        />
      </MemberWorkspace>
    );
  }

  return (
    <MemberWorkspace
      title="Create Initiative"
      subtitle="Start a new participation initiative"
      navItems={[...INITIATIVE_WORKSPACE_SECTIONS]}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      <StartNewInitiativeButton onCreated={handleCreated} />
    </MemberWorkspace>
  );
}

export function CreateInitiativePageContent() {
  return (
    <Suspense fallback={<p role="status">Loading initiative form…</p>}>
      <CreateInitiativePageContentInner />
    </Suspense>
  );
}
