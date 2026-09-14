import { PublishingEditorWorkspacePage } from "../../../../features/blog/components/PublishingEditorWorkspacePage";

export const metadata = {
  title: "New Publication | Publishing | Humanity Union",
  description: "Create a new Humanity Union Blog draft.",
};

export default function WorkspacePublishingNewPage() {
  return <PublishingEditorWorkspacePage mode="create" />;
}
