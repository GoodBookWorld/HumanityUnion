import { MemberWorkspace } from "../../../../components/member/MemberWorkspace";
import { BlogEditorPageContent } from "../../../../features/blog/components/BlogEditorPageContent";
import { HumanityUnionAssistantWidget } from "../../../../features/humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../../../features/initiatives/components/WorkspaceNavigation";

import "../../../../features/blog/publishing.css";

export const metadata = {
  title: "New Publication | Publishing | Humanity Union",
  description: "Create a new Humanity Union Blog draft.",
};

export default function WorkspacePublishingNewPage() {
  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="New Publication"
      subtitle="Write a draft. Save often. Preview before you submit."
      workspaceNavigation={<WorkspaceNavigation />}
      assistant={
        <HumanityUnionAssistantWidget
          surfaceId="blog"
          description="Help with structure and clarity only. Never overwrite Author text or publish automatically."
        />
      }
    >
      <BlogEditorPageContent mode="create" />
    </MemberWorkspace>
    </main>
  );
}
