"use client";

import { useState } from "react";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";
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
export function WorkspaceHomePage() {
  const [assistantContext, setAssistantContext] = useState<
    WorkspaceHomeState["assistantContext"] | null
  >(null);

  return (
    <MemberWorkspace
      title="Workspace"
      subtitle="Your personal civic dashboard"
      workspaceNavigation={<WorkspaceNavigation />}
      headerBar={<WorkspacePersonalHeader />}
      assistant={<WorkspaceHomeAssistant context={assistantContext} />}
    >
      <WorkspaceHomeDashboard onLoaded={(state) => setAssistantContext(state.assistantContext)} />
    </MemberWorkspace>
  );
}
