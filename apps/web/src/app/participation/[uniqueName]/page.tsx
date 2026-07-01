import Link from "next/link";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { getPublicParticipationProfile } from "../../../features/participation/participation-api";

import "./participation-page.css";

interface PublicParticipationPageProps {
  params: Promise<{
    uniqueName: string;
  }>;
}

function formatList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(", ") : "Not specified";
}

export default async function PublicParticipationPage({ params }: PublicParticipationPageProps) {
  const { uniqueName } = await params;
  let profile = null;

  try {
    profile = await getPublicParticipationProfile(uniqueName);
  } catch {
    profile = null;
  }

  if (!profile) {
    return (
      <main className="participation-page">
        <h1>Public Participation Profile</h1>
        <p>Public participation profile is not available.</p>
        <p className="participation-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="participation-page">
      <header className="participation-page__header">
        <h1 className="participation-page__title">
          {profile.displayName ?? "Public Participation Profile"}
        </h1>
        <p className="participation-page__subtitle">Public participation interests</p>
      </header>

      <ProfileSection title="Public Participation">
        {profile.displayName ? (
          <ProfileField label="Display Name" value={profile.displayName} />
        ) : null}
        {profile.languages ? (
          <ProfileField label="Languages" value={formatList(profile.languages)} />
        ) : null}
        {profile.interestedTopics ? (
          <ProfileField label="Interested Topics" value={formatList(profile.interestedTopics)} />
        ) : null}
        {profile.volunteerInterests ? (
          <ProfileField
            label="Volunteer Interests"
            value={formatList(profile.volunteerInterests)}
          />
        ) : null}
        {profile.preferredParticipationRegions ? (
          <ProfileField
            label="Preferred Participation Regions"
            value={formatList(profile.preferredParticipationRegions)}
          />
        ) : null}
      </ProfileSection>

      <p className="participation-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
