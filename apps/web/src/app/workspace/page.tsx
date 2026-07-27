import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { WorkspaceHomePage } from "./WorkspaceHomePage";

import "./workspace-page.css";

export default function WorkspacePage() {
  return (
    <main className="workspace-page humanity-workspace-page">
      <WorkspaceAuthGate>
        <WorkspaceHomePage />
      </WorkspaceAuthGate>
    </main>
  );
}
