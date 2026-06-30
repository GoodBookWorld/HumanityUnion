import Link from "next/link";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { getPublicMember } from "../../../features/member/member-api";

import "./public-member-page.css";

interface PublicMemberPageProps {
  params: Promise<{
    uniqueName: string;
  }>;
}

export default async function PublicMemberPage({ params }: PublicMemberPageProps) {
  const { uniqueName } = await params;
  let member = null;

  try {
    member = await getPublicMember(uniqueName);
  } catch {
    member = null;
  }

  if (!member) {
    return (
      <main className="public-member-page">
        <h1>Public Member Profile</h1>
        <p>Member profile is not available.</p>
        <p className="public-member-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-member-page">
      <header className="public-member-page__header">
        <h1 className="public-member-page__title">{member.displayName}</h1>
        <p className="public-member-page__subtitle">@{member.uniqueName}</p>
      </header>

      <ProfileSection title="Public Profile">
        <ProfileField label="Display Name" value={member.displayName} />
        <ProfileField label="Country" value={member.country ?? ""} />
        <ProfileField label="Region" value={member.region ?? ""} />
        <ProfileField label="Languages" value={member.languages.join(", ")} />
      </ProfileSection>

      <ProfileSection title="Public Initiatives" placeholder />
      <ProfileSection title="Public Participation" placeholder />
      <ProfileSection title="Public Organizations" placeholder />

      <p className="public-member-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
