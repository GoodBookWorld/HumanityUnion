import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { PublishingPageContent } from "../../../features/blog/components/PublishingPageContent";
import { HumanityUnionAssistantWidget } from "../../../features/humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../../../features/blog/publishing.css";

export const metadata = {
  title: "Publishing | Workspace | Humanity Union",
  description: "Create and manage Humanity Union Blog publications.",
};

export default function WorkspacePublishingPage() {
  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Publishing"
        subtitle="Create drafts, preview privately, and submit thoughtful Blog publications."
        workspaceNavigation={<WorkspaceNavigation />}
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description="Ask about categories, clarity, evidence vs opinion, structure, and review status. The Assistant never saves, submits, or publishes for you."
          />
        }
      >
        <PublishingPageContent />
      </MemberWorkspace>
    </main>
  );
}
