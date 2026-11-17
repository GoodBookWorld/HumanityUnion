"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getMe } from "../../features/auth/auth-api";
import { buildAuthPathWithReturnTo } from "../../features/auth/lib/build-auth-return-path";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";
import {
  hasRrpApplicationEntryIntent,
  RRP_APPLICATION_ENTRY_HREF,
} from "../../features/regional-program/rrp-application-entry";
import { WorkspaceHomeAssistant } from "../../features/workspace-home/components/WorkspaceHomeAssistant";
import { WorkspaceHomeDashboard } from "../../features/workspace-home/components/WorkspaceHomeDashboard";
import { WorkspacePersonalHeader } from "../../features/workspace-home/components/WorkspacePersonalHeader";
import type { WorkspaceHomeState } from "../../features/workspace-home/workspace-home-api";

import "./workspace-page.css";

/**
 * Recovery Task 33 — Workspace UX Evolution, Part 8.
 *
 * The Workspace page previously rendered a second, duplicate in-page
 * "Sections" navigation block (hash-linking to each dashboard widget) in
 * addition to the route-based sidebar (`WorkspaceNavigation`). It has been
 * removed here — intentionally not passing `navItems` to `MemberWorkspace`
 * — because it duplicated information already reachable via the sidebar
 * and the dashboard's own natural scroll order. `MemberWorkspace` and its
 * underlying `WorkspaceSectionNav` component are unchanged and continue to
 * back the in-page section nav used by other pages (initiatives, petitions,
 * collective decisions, etc.).
 */
/**
 * HU-RRP-02A — accept `rrp=apply` on Workspace without opening a form yet.
 * Unverified sessions are sent to confirm-email with the same returnTo.
 * No modal, fake form, or success message in this phase.
 */
function WorkspaceRrpApplicationEntryIntent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!hasRrpApplicationEntryIntent(searchParams)) {
      return;
    }

    let cancelled = false;
    void getMe()
      .then((user) => {
        if (cancelled || user.emailVerificationStatus === "verified") {
          return;
        }
        router.replace(buildAuthPathWithReturnTo("/confirm-email", RRP_APPLICATION_ENTRY_HREF));
      })
      .catch(() => {
        // Guest / session errors are handled by WorkspaceAuthGate.
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return null;
}

function WorkspaceHomePageBody() {
  const tNav = useTranslations("navigation");
  const tWorkspace = useTranslations("workspace");
  const [assistantContext, setAssistantContext] = useState<
    WorkspaceHomeState["assistantContext"] | null
  >(null);

  return (
    <MemberWorkspace
      title={tNav("workspace")}
      subtitle={tWorkspace("homeSubtitle")}
      workspaceNavigation={<WorkspaceNavigation />}
      headerBar={<WorkspacePersonalHeader />}
      assistant={<WorkspaceHomeAssistant context={assistantContext} />}
    >
      <Suspense fallback={null}>
        <WorkspaceRrpApplicationEntryIntent />
      </Suspense>
      <WorkspaceHomeDashboard onLoaded={(state) => setAssistantContext(state.assistantContext)} />
    </MemberWorkspace>
  );
}

export function WorkspaceHomePage() {
  return <WorkspaceHomePageBody />;
}
