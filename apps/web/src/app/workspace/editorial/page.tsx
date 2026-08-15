import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { EditorialQueuePageContent } from "../../../features/blog/components/EditorialQueuePageContent";
import { HumanityUnionAssistantWidget } from "../../../features/humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../../../features/blog/editorial.css";

export const metadata = {
  title: "Editorial Review | Workspace | Humanity Union",
  description: "Review submitted Humanity Union Blog publications.",
};

export default function WorkspaceEditorialPage() {
  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Editorial Review"
        subtitle="Review submitted Blog publications with clear Safety and editorial separation."
        workspaceNavigation={<WorkspaceNavigation />}
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description="Ask for a summary, unclear claims, evidence vs opinion, Safety status, or Blog standards. The Assistant never approves, declines, or publishes."
          />
        }
      >
        <EditorialQueuePageContent />
      </MemberWorkspace>
    </main>
  );
}
