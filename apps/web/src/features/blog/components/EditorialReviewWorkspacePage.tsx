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
        headerBar={
          <header className="member-workspace__header editorial-review-header">
            <div className="editorial-review-header__copy">
              <h1 className="member-workspace__title">{t("title")}</h1>
              <p className="member-workspace__subtitle">{t("subtitle")}</p>
            </div>
            <div className="editorial-review-header__assistant">
              <HumanityUnionAssistantWidget
                surfaceId="blog"
                description={t("assistantDescription")}
              />
            </div>
          </header>
        }
      >
        <EditorialReviewPageContent postId={postId} />
      </MemberWorkspace>
    </main>
  );
}
