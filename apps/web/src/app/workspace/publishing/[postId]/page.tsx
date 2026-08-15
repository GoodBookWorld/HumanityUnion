import { MemberWorkspace } from "../../../../components/member/MemberWorkspace";
import { BlogEditorPageContent } from "../../../../features/blog/components/BlogEditorPageContent";
import { HumanityUnionAssistantWidget } from "../../../../features/humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../../../features/initiatives/components/WorkspaceNavigation";

import "../../../../features/blog/publishing.css";

export const metadata = {
  title: "Edit Publication | Publishing | Humanity Union",
  description: "Edit a Humanity Union Blog publication.",
};

export default async function WorkspacePublishingEditPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Edit Publication"
      subtitle="Update your draft or published article according to your Author permissions."
      workspaceNavigation={<WorkspaceNavigation />}
      assistant={
        <HumanityUnionAssistantWidget
          surfaceId="blog"
          description="Help with clarity and review status. The Assistant cannot save, submit, or publish."
        />
      }
    >
      <BlogEditorPageContent mode="edit" postId={postId} />
    </MemberWorkspace>
    </main>
  );
}
