import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { MemberProfilePreview } from "../../features/member-profile/components/MemberProfilePreview";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./profile-page.css";

/** MemberProfilePreview renders ApiUnavailableState when the profile API is unreachable. */

export default function ProfilePage() {
  return (
    <main className="profile-page humanity-workspace-page">
      <MemberWorkspace
        title="Profile"
        subtitle="Preview how your member profile appears"
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <MemberProfilePreview />
      </MemberWorkspace>
    </main>
  );
}
