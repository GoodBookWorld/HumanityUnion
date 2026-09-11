import { EditorialReviewWorkspacePage } from "../../../../features/blog/components/EditorialReviewWorkspacePage";

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

  return <EditorialReviewWorkspacePage postId={postId} />;
}
