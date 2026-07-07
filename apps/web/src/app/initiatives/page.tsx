import Link from "next/link";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
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
      <main className="initiatives-page">
        <WorkspaceNavigation current="Initiatives" />
        <h1>Initiatives Workspace</h1>
        <p>Initiative API is not available.</p>
        <p className="initiatives-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="initiatives-page">
      <MemberWorkspace
        title="Initiatives"
        subtitle="Participation initiatives in Humanity Union"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <InitiativeWorkspace initialInitiatives={initiatives} />
      </MemberWorkspace>

      <p className="initiatives-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
