import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { getPublicParticipationProfile } from "../../../features/participation/participation-api";

import "./participation-page.css";

interface PublicParticipationPageProps {
  params: Promise<{
    uniqueName: string;
  }>;
}

export default async function PublicParticipationPage({ params }: PublicParticipationPageProps) {
  const t = await getTranslations("participantPublic.participation");
  const { uniqueName } = await params;
  let profile = null;

  try {
    profile = await getPublicParticipationProfile(uniqueName);
  } catch {
    profile = null;
  }

  const formatList = (values: string[] | undefined): string => {
    return values && values.length > 0 ? values.join(", ") : t("notSpecified");
  };

  if (!profile) {
    return (
      <main className="participation-page">
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <p className="participation-page__back">
          <Link href="/">{t("backHome")}</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="participation-page">
      <header className="participation-page__header">
        <h1 className="participation-page__title">{profile.displayName ?? t("title")}</h1>
        <p className="participation-page__subtitle">{t("subtitle")}</p>
      </header>

      <ProfileSection title={t("sectionTitle")}>
        {profile.displayName ? (
          <ProfileField label={t("displayName")} value={profile.displayName} />
        ) : null}
        {profile.languages ? (
          <ProfileField label={t("languages")} value={formatList(profile.languages)} />
        ) : null}
        {profile.interestedTopics ? (
          <ProfileField label={t("interestedTopics")} value={formatList(profile.interestedTopics)} />
        ) : null}
        {profile.volunteerInterests ? (
          <ProfileField
            label={t("volunteerInterests")}
            value={formatList(profile.volunteerInterests)}
          />
        ) : null}
        {profile.preferredParticipationRegions ? (
          <ProfileField
            label={t("preferredRegions")}
            value={formatList(profile.preferredParticipationRegions)}
          />
        ) : null}
      </ProfileSection>

      <p className="participation-page__back">
        <Link href="/">{t("backHome")}</Link>
      </p>
    </main>
  );
}
