import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { MyCivicActivitySection } from "../../features/civic-activity/components/MyCivicActivitySection";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./civic-activity-page.css";

export default async function CivicActivityPage() {
  const t = await getTranslations("civicActivity");
  const tWorkspace = await getTranslations("workspace");

  const navItems = [
    {
      id: "section-my-civic-activity",
      label: tWorkspace("myCivicActivity"),
    },
    {
      id: "section-activity-summary",
      label: t("sections.summary"),
    },
    {
      id: "section-activity-timeline",
      label: t("sections.timeline"),
    },
  ] as const;

  return (
    <main className="civic-activity-page humanity-workspace-page">
      <MemberWorkspace
        title={tWorkspace("myCivicActivity")}
        subtitle={t("pageSubtitle")}
        navItems={navItems}
        sectionsLabel={t("sections.navLabel")}
        sectionsAriaLabel={t("sections.navAria")}
        navAriaLabel={t("sections.workspaceNavAria")}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <MyCivicActivitySection />
      </MemberWorkspace>

      <p className="civic-activity-page__back">
        <Link href="/">{t("backToHome")}</Link>
      </p>
    </main>
  );
}
