import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { ApiUnavailableState } from "../../design-system";
import { listMyInitiatives } from "../../features/initiatives/api";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../features/workspace-civic-assistant/initiative-workspace-sections";
import { InitiativeWorkspace } from "../../features/initiatives/components/InitiativeWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./initiatives-page.css";

const NAV_ITEMS = [...INITIATIVE_WORKSPACE_SECTIONS];

export default async function InitiativesPage() {
  let initiatives = null;

  try {
    initiatives = await listMyInitiatives();
  } catch {
    initiatives = null;
  }

  if (!initiatives) {
    return (
      <main className="initiatives-page humanity-workspace-page">
        <ApiUnavailableState
          title="Initiatives workspace is temporarily unavailable"
          explanation="We could not load your initiatives workspace right now. Your participation data is safe, but this workspace cannot be shown until the connection is restored."
          possibleReason="The initiative service may be starting up, undergoing maintenance, or temporarily unreachable."
          retryHref="/initiatives"
        />
      </main>
    );
  }

  return (
    <main className="initiatives-page humanity-workspace-page">
      <MemberWorkspace
        title="Initiatives"
        subtitle="Participation initiatives in Humanity Union"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <InitiativeWorkspace initialInitiatives={initiatives} />
      </MemberWorkspace>
    </main>
  );
}
