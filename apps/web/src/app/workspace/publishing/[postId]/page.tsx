import { PublishingEditorWorkspacePage } from "../../../../features/blog/components/PublishingEditorWorkspacePage";

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

  return <PublishingEditorWorkspacePage mode="edit" postId={postId} />;
}
