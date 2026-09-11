"use client";

import { useTranslations } from "next-intl";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";

interface MemberProfilePageShellProps {
  children: React.ReactNode;
}

/** Owner `/member` chrome — title/subtitle from memberProfile WEB_UI catalog. */
export function MemberProfilePageShell({ children }: MemberProfilePageShellProps) {
  const t = useTranslations("memberProfile");

  return (
    <MemberWorkspace
      title={t("title")}
      subtitle={t("subtitle")}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      {children}
    </MemberWorkspace>
  );
}
