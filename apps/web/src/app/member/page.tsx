import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { MemberProfileWorkspace } from "../../features/member-profile/components/MemberProfileWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

export default function MemberPage() {
  return (
    <main className="humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title="Profile"
          subtitle="Your Humanity Union Participant profile"
          workspaceNavigation={<WorkspaceNavigation />}
        >
          <MemberProfileWorkspace />
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
