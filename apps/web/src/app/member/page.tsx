import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { MemberProfilePageShell } from "../../features/member-profile/components/MemberProfilePageShell";
import { MemberProfileWorkspace } from "../../features/member-profile/components/MemberProfileWorkspace";

export default function MemberPage() {
  return (
    <main className="humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberProfilePageShell>
          <MemberProfileWorkspace />
        </MemberProfilePageShell>
      </WorkspaceAuthGate>
    </main>
  );
}
