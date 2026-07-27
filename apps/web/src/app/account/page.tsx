import { Suspense } from "react";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { AccountPanel } from "../../features/auth/components/AccountPanel";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

export default function AccountPage() {
  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title="Account"
        subtitle="Your Humanity Union authentication account"
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <Suspense fallback={<p>Loading account...</p>}>
          <AccountPanel />
        </Suspense>
      </MemberWorkspace>
    </main>
  );
}
