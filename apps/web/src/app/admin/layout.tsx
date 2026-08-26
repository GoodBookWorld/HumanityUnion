import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";
import { AdminWorkspaceHeader } from "../../features/administration/components/AdminWorkspaceHeader";

import "../../features/administration/components/admin-panel.css";

export const metadata = {
  title: "Admin Panel | Humanity Union",
  description: "Platform administration for Humanity Union administrators.",
};

/**
 * Shared Admin Panel shell. Section pages enforce admin authorization via
 * AdminAccessGate (independent of Workspace sidebar visibility).
 * Pack 22E.2 — Notification widget via existing headerBar contract.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title="Admin Panel"
          subtitle="Platform administration for Humanity Union"
          workspaceNavigation={<WorkspaceNavigation />}
          headerBar={
            <AdminWorkspaceHeader
              title="Admin Panel"
              subtitle="Platform administration for Humanity Union"
            />
          }
        >
          {children}
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
