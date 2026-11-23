"use client";

import { useTranslations } from "next-intl";

import { useBrandSiteName } from "../../brand-localization/useLocalizedBrand";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";

interface MemberProfilePageShellProps {
  children: React.ReactNode;
}

/** Owner `/member` chrome — title/subtitle from memberProfile WEB_UI catalog. */
export function MemberProfilePageShell({ children }: MemberProfilePageShellProps) {
  const t = useTranslations("memberProfile");
  const siteName = useBrandSiteName();

  return (
    <MemberWorkspace
      title={t("title")}
      subtitle={t("subtitle", { siteName })}
      workspaceNavigation={<WorkspaceNavigation />}
    >
      {children}
    </MemberWorkspace>
  );
}
