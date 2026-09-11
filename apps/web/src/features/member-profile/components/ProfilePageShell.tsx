"use client";

import { useTranslations } from "next-intl";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";

interface ProfilePageShellProps {
  children: React.ReactNode;
}

/** Owner `/profile` chrome — title/subtitle from memberProfile WEB_UI catalog. */
export function ProfilePageShell({ children }: ProfilePageShellProps) {
  const t = useTranslations("memberProfile");

  return (
    <MemberWorkspace
      title={t("title")}
      subtitle={t("previewSubtitle")}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      {children}
    </MemberWorkspace>
  );
}
