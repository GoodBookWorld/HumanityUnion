import Link from "next/link";

import { ProfileField } from "../../components/member/ProfileField";
import { ProfileSection } from "../../components/member/ProfileSection";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { getCurrentMember } from "../../features/member/member-api";

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
      <main className="profile-page">
        <h1>Member Workspace</h1>
        <p>Member API is not available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <MemberWorkspace title="Profile" subtitle="Your Humanity Union participant profile">
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

      <p className="profile-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
