import { InitiativesPageGate } from "../../../features/initiatives/components/InitiativesPageGate";

import "../../initiatives/initiatives-page.css";

export default function WorkspaceInitiativesPage() {
  return (
    <main className="initiatives-page humanity-workspace-page">
      <InitiativesPageGate />
    </main>
  );
}
