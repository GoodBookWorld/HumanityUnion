import { ProfileField } from "../../components/member/ProfileField";
import { ProfileSection } from "../../components/member/ProfileSection";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceUnavailableContent } from "../../components/member/WorkspaceUnavailableContent";
import { getCurrentMember } from "../../features/member/member-api";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./profile-page.css";

export default async function ProfilePage() {
  let member = null;

  try {
    member = await getCurrentMember();
  } catch {
    member = null;
  }

  if (!member) {
    return (
      <main className="profile-page humanity-workspace-page">
        <MemberWorkspace
          title="Profile"
          subtitle="Your Humanity Union participant profile"
          workspaceNavigation={<WorkspaceNavigation current="Profile" />}
        >
          <WorkspaceUnavailableContent
            title="Workspace temporarily unavailable"
            explanation="We couldn't connect to the Member service. Please try again shortly."
            retryHref="/profile"
          />
        </MemberWorkspace>
      </main>
    );
  }

  return (
    <main className="profile-page humanity-workspace-page">
      <MemberWorkspace
        title="Profile"
        subtitle="Your Humanity Union participant profile"
        workspaceNavigation={<WorkspaceNavigation current="Profile" />}
      >
        <ProfileSection title="Basic Information">
          <ProfileField label="Display Name" value={member.profile.displayName} />
          <ProfileField label="Country" value={member.profile.country ?? ""} />
          <ProfileField label="Region" value={member.profile.region ?? ""} />
          <ProfileField label="City" value={member.profile.city ?? ""} />
          <ProfileField label="Languages" value={member.profile.languages.join(", ")} />
        </ProfileSection>

        <ProfileSection title="Skills" placeholder />
        <ProfileSection title="Interests" placeholder />
        <ProfileSection title="Participation" placeholder />
        <ProfileSection title="Visibility" placeholder />
        <ProfileSection title="Preferences" placeholder />
      </MemberWorkspace>
    </main>
  );
}
