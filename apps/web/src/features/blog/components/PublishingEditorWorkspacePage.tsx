"use client";

import { useTranslations } from "next-intl";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { BlogEditorPageContent } from "./BlogEditorPageContent";

import "../publishing.css";

export function PublishingEditorWorkspacePage({
  mode,
  postId,
}: {
  mode: "create" | "edit";
  postId?: string;
}) {
  const t = useTranslations("workspace.publishingPage");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={mode === "create" ? t("editor.page.createTitle") : t("editor.page.editTitle")}
        subtitle={
          mode === "create" ? t("editor.page.createSubtitle") : t("editor.page.editSubtitle")
        }
        workspaceNavigation={<WorkspaceNavigation />}
        assistantPlacement="compact"
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description={
              mode === "create"
                ? t("editor.page.assistantDescription")
                : t("editor.page.assistantEditDescription")
            }
          />
        }
      >
        <BlogEditorPageContent mode={mode} postId={postId} />
      </MemberWorkspace>
    </main>
  );
}
