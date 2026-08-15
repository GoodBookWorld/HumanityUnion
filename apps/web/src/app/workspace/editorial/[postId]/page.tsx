import { MemberWorkspace } from "../../../../components/member/MemberWorkspace";
import { EditorialReviewPageContent } from "../../../../features/blog/components/EditorialReviewPageContent";
import { HumanityUnionAssistantWidget } from "../../../../features/humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../../../features/initiatives/components/WorkspaceNavigation";

import "../../../../features/blog/editorial.css";

export const metadata = {
  title: "Review Publication | Editorial Review | Humanity Union",
  description: "Editorial review of a submitted Blog publication.",
};

export default async function WorkspaceEditorialReviewPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Editorial Review"
      subtitle="Preview the sanitized publication and record an editorial decision."
      workspaceNavigation={<WorkspaceNavigation />}
      assistant={
        <HumanityUnionAssistantWidget
          surfaceId="blog"
          description="Ask for a summary, unclear claims, evidence vs opinion, Safety status, or Blog standards. The Assistant never approves, declines, or publishes."
        />
      }
    >
      <EditorialReviewPageContent postId={postId} />
    </MemberWorkspace>
    </main>
  );
}
