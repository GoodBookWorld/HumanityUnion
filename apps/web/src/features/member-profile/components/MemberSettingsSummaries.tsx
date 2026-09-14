"use client";

import type { MemberPreferences, MemberProfile } from "@hu/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getMyPreferences } from "../../preferences/preferences-api";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { MemberProfessionalLinksDisplay, MemberSkillTags } from "./MemberProfessionalLinksSection";

import "./member-settings-summaries.css";
import "./member-skills-editor.css";

function summarizeList(
  values: string[],
  emptyLabel: string,
  moreLabel: (count: number) => string,
): string {
  if (values.length === 0) {
    return emptyLabel;
  }

  if (values.length <= 3) {
    return values.join(", ");
  }

  return `${values.slice(0, 3).join(", ")} ${moreLabel(values.length - 3)}`;
}

interface MemberSettingsSummariesProps {
  profile: MemberProfile;
}

export function MemberSettingsSummaries({ profile }: MemberSettingsSummariesProps) {
  const t = useTranslations("memberProfile.summaries");
  const tSections = useTranslations("memberProfile.sections");
  const tVisibility = useTranslations("memberProfile.visibility");
  const tPrefs = useTranslations("preferences");
  const tAccount = useTranslations("account");
  const tExperience = useTranslations("initiativeExperience");
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getMyPreferences()
      .then((loaded) => {
        if (!cancelled) {
          setPreferences(loaded);
        }
      })
      .catch((error) => {
        if (!cancelled && !isAuthenticationRequiredError(error)) {
          setPreferences(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p>{t("loading")}</p>;
  }

  if (!preferences) {
    return (
      <ProfileSection title={t("title")}>
        <p>
          <Link href="/preferences">{t("openPreferencesPrefix")}</Link>
          {t("openPreferencesSuffix")}
        </p>
      </ProfileSection>
    );
  }

  const noneSelected = t("noneSelected");
  const moreLabel = (count: number) => t("moreCount", { count });

  return (
    <div className="member-settings-summaries">
      <ProfileSection title={tSections("skills")}>
        {profile.skills.length > 0 ? (
          <MemberSkillTags skills={profile.skills} />
        ) : (
          <ProfileField label={tSections("skills")} value={t("noneAdded")} />
        )}
        <p>
          <a href="#skills">{t("editSkills")}</a>
        </p>
      </ProfileSection>

      <ProfileSection title={tSections("professional-links")}>
        <MemberProfessionalLinksDisplay
          website={profile.website}
          linkedinUrl={profile.linkedinUrl}
          facebookUrl={profile.facebookUrl}
          youtubeUrl={profile.youtubeUrl}
          instagramUrl={profile.instagramUrl}
          xUrl={profile.xUrl}
        />
        {!profile.website &&
        !profile.linkedinUrl &&
        !profile.facebookUrl &&
        !profile.youtubeUrl &&
        !profile.instagramUrl &&
        !profile.xUrl ? (
          <ProfileField label={t("links")} value={t("noneAdded")} />
        ) : null}
        <p>
          <a href="#professional-links">{t("editLinks")}</a>
        </p>
      </ProfileSection>

      <ProfileSection title={t("interests")}>
        <ProfileField
          label={tPrefs("experience.expertiseAreas")}
          value={summarizeList(
            preferences.experiencePreferences.expertiseAreas.map((area) =>
              resolveActivityAreaDisplayLabel(area, tExperience),
            ),
            noneSelected,
            moreLabel,
          )}
        />
        <ProfileField
          label={tPrefs("participation.initiativeInterests")}
          value={summarizeList(
            preferences.participationPreferences.initiativeParticipationInterests,
            noneSelected,
            moreLabel,
          )}
        />
        <p>
          <Link href="/preferences#experience">{t("editInterests")}</Link>
        </p>
      </ProfileSection>

      <ProfileSection title={tPrefs("sections.participation")}>
        <ProfileField
          label={tPrefs("participation.preferredActivityAreas")}
          value={summarizeList(
            preferences.participationPreferences.preferredActivityAreas.map((area) =>
              resolveActivityAreaDisplayLabel(area, tExperience),
            ),
            noneSelected,
            moreLabel,
          )}
        />
        <ProfileField
          label={tPrefs("participation.contributionWillingness")}
          value={summarizeList(
            preferences.participationPreferences.contributionWillingness.map((option) =>
              tPrefs(`contribution.${option}`),
            ),
            noneSelected,
            moreLabel,
          )}
        />
        <p>
          <Link href="/preferences#participation">{t("editParticipation")}</Link>
        </p>
      </ProfileSection>

      <ProfileSection title={tPrefs("sections.visibility")}>
        <ProfileField
          label={t("skillsVisibility")}
          value={tVisibility(profile.skillsVisibility)}
        />
        <ProfileField
          label={t("professionalLinksVisibility")}
          value={tVisibility(profile.professionalLinksVisibility)}
        />
        <ProfileField
          label={t("interestsVisibility")}
          value={tVisibility(preferences.visibilityPreferences.interestsVisibility)}
        />
        <p>
          <a href="#privacy">{t("editProfileVisibility")}</a> ·{" "}
          <Link href="/preferences#visibility">{t("editPreferencesVisibility")}</Link>
        </p>
      </ProfileSection>

      <ProfileSection title={tSections("preferences")}>
        <ProfileField
          label={tPrefs("communication.notificationFrequency")}
          value={tPrefs(
            `notificationFrequencies.${preferences.communicationPreferences.notificationFrequency}`,
          )}
        />
        <ProfileField
          label={t("interestMatchNotifications")}
          value={
            preferences.communicationPreferences.interestMatchNotificationsEnabled
              ? tAccount("enabled")
              : tAccount("disabled")
          }
        />
        <p>
          <Link href="/preferences">{t("openFullPreferences")}</Link>
        </p>
      </ProfileSection>
    </div>
  );
}
