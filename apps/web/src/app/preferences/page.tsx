import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { PreferencesWorkspace } from "../../features/preferences/components/PreferencesWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./preferences-page.css";

/** PreferencesWorkspace renders ApiUnavailableState when the preferences API is unreachable. */

export default function PreferencesPage() {
  return (
    <main className="preferences-page humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title="Preferences"
          subtitle="Your Humanity Union experience and participation settings"
          workspaceNavigation={<WorkspaceNavigation />}
        >
          <PreferencesWorkspace />
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
