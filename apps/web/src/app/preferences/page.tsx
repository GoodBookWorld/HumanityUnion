import { getTranslations } from "next-intl/server";

import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { PreferencesWorkspace } from "../../features/preferences/components/PreferencesWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./preferences-page.css";

/** PreferencesWorkspace renders ApiUnavailableState when the preferences API is unreachable. */

export default async function PreferencesPage() {
  const t = await getTranslations("preferences");

  return (
    <main className="preferences-page humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title={t("title")}
          subtitle={t("subtitle")}
          workspaceNavigation={<WorkspaceNavigation />}
        >
          <PreferencesWorkspace />
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
