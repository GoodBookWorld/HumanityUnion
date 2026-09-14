"use client";

import { useTranslations } from "next-intl";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { EditorialReviewPageContent } from "./EditorialReviewPageContent";

import "../editorial.css";

export function EditorialReviewWorkspacePage({ postId }: { postId: string }) {
  const t = useTranslations("workspace.editorialPage");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle")}
        workspaceNavigation={<WorkspaceNavigation />}
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description={t("assistantDescription")}
          />
        }
      >
        <EditorialReviewPageContent postId={postId} />
      </MemberWorkspace>
    </main>
  );
}
