import { MemberWorkspace } from "../../../../../components/member/MemberWorkspace";
import { BlogPreviewPageContent } from "../../../../../features/blog/components/BlogPreviewPageContent";
import { WorkspaceNavigation } from "../../../../../features/initiatives/components/WorkspaceNavigation";

import "../../../../../features/blog/publishing.css";

export const metadata = {
  title: "Draft Preview | Publishing | Humanity Union",
  description: "Private Blog draft preview — not published.",
};

export default async function WorkspacePublishingPreviewPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Draft Preview"
      subtitle="Private preview — this does not publish the article."
      workspaceNavigation={<WorkspaceNavigation />}
    >
      <BlogPreviewPageContent postId={postId} />
    </MemberWorkspace>
    </main>
  );
}