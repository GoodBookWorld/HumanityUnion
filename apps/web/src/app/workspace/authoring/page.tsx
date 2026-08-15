import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { AuthoringPageContent } from "../../../features/blog/components/AuthoringPageContent";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

export const metadata = {
  title: "Authoring | Workspace | Humanity Union",
  description: "Apply to become a Humanity Union Blog Author or open your publishing entry.",
};

export default function WorkspaceAuthoringPage() {
  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Authoring"
        subtitle="Contribute thoughtful publications to the Humanity Union Blog."
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <AuthoringPageContent />
      </MemberWorkspace>
    </main>
  );
}
