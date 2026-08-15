import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { OwnerProfilePreview } from "../../features/member-profile/components/OwnerProfilePreview";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./profile-page.css";

/**
 * Profile UX Pack 03.3 — `/profile` stays a Workspace page (sidebar,
 * navigation, header all preserved); only the content area changed. It now
 * renders `OwnerProfilePreview`, which shows the exact same shared
 * `ParticipantProfileSurface` `/member/{publicName}` renders for a public
 * visitor, plus a compact owner-only preview banner. `OwnerProfilePreview`
 * itself renders `ApiUnavailableState` when the profile API is
 * unreachable.
 */
export default function ProfilePage() {
  return (
    <main className="profile-page humanity-workspace-page">
      <MemberWorkspace
        title="Profile"
        subtitle="Preview how your profile appears to other Participants"
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <OwnerProfilePreview />
      </MemberWorkspace>
    </main>
  );
}
