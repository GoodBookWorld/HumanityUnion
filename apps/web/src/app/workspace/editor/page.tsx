"use client";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { WorkspaceAuthGate } from "../../../features/auth/components/WorkspaceAuthGate";
import { EditorAccessGate } from "../../../features/administration/components/EditorAccessGate";
import { EditorPanelSection } from "../../../features/administration/components/EditorPanelSection";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

export default function WorkspaceEditorPage() {
  return (
    <main className="humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title="Editor Panel"
          subtitle="Delegated editing tools for your assigned area"
          workspaceNavigation={<WorkspaceNavigation />}
        >
          <EditorAccessGate>{(user) => <EditorPanelSection user={user} />}</EditorAccessGate>
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
