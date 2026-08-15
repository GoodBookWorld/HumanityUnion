import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceAuthGate } from "../../features/auth/components/WorkspaceAuthGate";
import { AdminPanelPageContent } from "../../features/administration/components/AdminPanelPageContent";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

export const metadata = {
  title: "Admin Panel | Humanity Union",
  description: "Platform administration foundation for Humanity Union administrators.",
};

/**
 * Admin Panel root — authentication via WorkspaceAuthGate; admin authorization
 * enforced independently in AdminPanelPageContent via server-backed getMe().
 */
export default function AdminPanelPage() {
  return (
    <main className="humanity-workspace-page">
      <WorkspaceAuthGate>
        <MemberWorkspace
          title="Admin Panel"
          subtitle="Platform administration for Humanity Union"
          workspaceNavigation={<WorkspaceNavigation />}
        >
          <AdminPanelPageContent />
        </MemberWorkspace>
      </WorkspaceAuthGate>
    </main>
  );
}
