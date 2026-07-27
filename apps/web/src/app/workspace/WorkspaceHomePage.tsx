"use client";

import { useState } from "react";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";
import { WorkspaceHomeAssistant } from "../../features/workspace-home/components/WorkspaceHomeAssistant";
import { WorkspaceHomeDashboard } from "../../features/workspace-home/components/WorkspaceHomeDashboard";
import { WorkspacePersonalHeader } from "../../features/workspace-home/components/WorkspacePersonalHeader";
import type { WorkspaceHomeState } from "../../features/workspace-home/workspace-home-api";

import "./workspace-page.css";

const NAV_ITEMS = [
  "Personal Welcome",
  "Quick Actions",
  "My Active Civic Work",
  "My Recent Activity",
  "My Responsibilities",
  "Participation Summary",
  "Workspace Notifications",
  "Recent Public Contributions",
] as const;

export function WorkspaceHomePage() {
  const [assistantContext, setAssistantContext] = useState<
    WorkspaceHomeState["assistantContext"] | null
  >(null);

  return (
    <MemberWorkspace
      title="Workspace"
      subtitle="Your personal civic dashboard"
      navItems={NAV_ITEMS}
      workspaceNavigation={<WorkspaceNavigation />}
      headerBar={<WorkspacePersonalHeader />}
      assistant={<WorkspaceHomeAssistant context={assistantContext} />}
    >
      <WorkspaceHomeDashboard onLoaded={(state) => setAssistantContext(state.assistantContext)} />
    </MemberWorkspace>
  );
}
