"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { MemberProfile, MemberProfilePrivacySettings, ParticipantStatistics } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
import { AvatarImageUploadField } from "../../media-upload/components/AvatarImageUploadField";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { uploadAvatarImage } from "../../media-upload/media-upload-api";
import { PersonalStatisticsCards } from "../../personal-statistics/components/PersonalStatisticsCards";
import {
  getMyMemberProfile,
  getMyMemberProfilePrivacy,
  getMyMemberProfileStatistics,
  updateMyMemberProfile,
  updateMyMemberProfilePrivacy,
} from "../member-profile-api";
import { dispatchMemberProfileUpdated } from "../member-profile-events";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../use-save-button-phase";
import { ParticipationAreaSection } from "../../participation-area/components/ParticipationAreaSection";
import { ProfileAssistantEntry } from "../../humanity-union-assistant";
import { MembershipProfileSection } from "../../membership/components/MembershipProfileSection";
import { MemberSettingsSummaries } from "./MemberSettingsSummaries";
import { MemberSkillsEditor } from "./MemberSkillsEditor";
import { MemberProfessionalLinksSection } from "./MemberProfessionalLinksSection";

import "./member-profile-workspace.css";

const SECTION_IDS = [
  "statistics",
  "profile",
  "skills",
  "professional-links",
  "privacy",
  "participation-area",
  "preferences",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

function formatLocation(profile: MemberProfile, notSpecified: string): string {
  const parts = [profile.community, profile.region, profile.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : notSpecified;
}

const VISIBILITY_OPTION_KEYS = ["public", "members_only", "private"] as const;

export function MemberProfileWorkspace() {
  const t = useTranslations("memberProfile");
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [privacy, setPrivacy] = useState<MemberProfilePrivacySettings | null>(null);
  const [statistics, setStatistics] = useState<ParticipantStatistics | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile UX Pack 02 Part 3 — one independent Save-button phase per
  // section, so saving one section never disables the others.
  const profilePhase = useSaveButtonPhase();
  const linksPhase = useSaveButtonPhase();
  const privacyPhase = useSaveButtonPhase();

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getMyMemberProfile(), getMyMemberProfilePrivacy()])
      .then(([loadedProfile, loadedPrivacy]) => {
        if (!cancelled) {
          setProfile(loadedProfile);
          setPrivacy(loadedPrivacy);
          setError(null);
          setAuthRequired(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          if (isAuthenticationRequiredError(loadError)) {
            setAuthRequired(true);
            setError(null);
            setApiUnavailable(false);
          } else if (isApiUnavailableError(loadError)) {
            setApiUnavailable(true);
            setError(null);
          } else {
            setError(loadError instanceof Error ? loadError.message : t("loadError"));
            setApiUnavailable(false);
          }
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
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    // Profile UX Pack 02 Part 4 — statistics load independently: a failure
    // here should never block the rest of the profile page from working.
    void getMyMemberProfileStatistics()
      .then((loaded) => {
        if (!cancelled) {
          setStatistics(loaded);
        }
      })
      .catch(() => {
        // Non-critical section; leave the skeleton state rather than
        // surfacing a page-level error for a secondary widget.
      })
      .finally(() => {
        if (!cancelled) {
          setStatisticsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setError(null);

    try {
      await profilePhase.runSave(async () => {
        const updated = await updateMyMemberProfile({
          displayName: profile.displayName,
          publicName: profile.publicName,
          biography: profile.biography,
          avatarUrl: profile.avatarUrl,
          organization: profile.organization,
          language: profile.language,
          timezone: profile.timezone,
        });
        setProfile(updated);
        dispatchMemberProfileUpdated();
      });
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(saveError instanceof Error ? saveError.message : t("saveProfileError"));
      }
    }
  }

  async function handleSkillsSave(skills: string[]): Promise<void> {
    if (!profile) {
      return;
    }

    const updated = await updateMyMemberProfile({ skills });
    setProfile(updated);
    dispatchMemberProfileUpdated();
  }

  async function handleProfessionalLinksSave(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setError(null);

    try {
      await linksPhase.runSave(async () => {
        const updated = await updateMyMemberProfile({
          website: profile.website,
          linkedinUrl: profile.linkedinUrl,
          facebookUrl: profile.facebookUrl,
          youtubeUrl: profile.youtubeUrl,
          instagramUrl: profile.instagramUrl,
          xUrl: profile.xUrl,
        });
        setProfile(updated);
        dispatchMemberProfileUpdated();
      });
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(saveError instanceof Error ? saveError.message : t("saveLinksError"));
      }
    }
  }

  async function handlePrivacySave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!privacy) {
      return;
    }

    setError(null);

    try {
      await privacyPhase.runSave(async () => {
        const updated = await updateMyMemberProfilePrivacy(privacy);
        setPrivacy(updated);
      });
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(saveError instanceof Error ? saveError.message : t("savePrivacyError"));
      }
    }
  }

  if (loading) {
    return <p>{t("loading")}</p>;
  }

  if (authRequired) {
    return (
      <ProfileSection title={t("title")}>
        <p>{t("signInBody")}</p>
        <Button href="/login">{t("logIn")}</Button>
      </ProfileSection>
    );
  }

  if (apiUnavailable) {
    return (
      <ProfileSection title={t("title")}>
        <ApiUnavailableState
          title={t("unavailableTitle")}
          explanation={t("unavailableExplanation")}
          retryHref="/member"
        />
      </ProfileSection>
    );
  }

  if (!profile || !privacy) {
    return (
      <ProfileSection title={t("title")}>
        <p>{error ?? t("unavailable")}</p>
      </ProfileSection>
    );
  }

  return (
    <div className="member-profile-workspace">
      {error ? (
        <p className="member-profile-workspace__error" role="alert">
          {error}
        </p>
      ) : null}

      <ProfileAssistantEntry />

      <nav className="member-profile-workspace__sections" aria-label={t("sectionsAria")}>
        {SECTION_IDS.map((sectionId: SectionId) => (
          <a
            key={sectionId}
            className="member-profile-workspace__section-link"
            href={`#${sectionId}`}
          >
            {t(`sections.${sectionId}`)}
          </a>
        ))}
      </nav>

      <ProfileSection title={t("sections.statistics")} id="statistics">
        <PersonalStatisticsCards statistics={statistics} loading={statisticsLoading} />
      </ProfileSection>

      <ProfileSection title={t("sections.profile")} id="profile">
        <form className="member-profile-workspace__form" onSubmit={handleProfileSave}>
          <label className="member-profile-workspace__field">
            <span>{t("fields.displayName")}</span>
            <input
              value={profile.displayName}
              onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
            />
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("fields.publicName")}</span>
            <input
              value={profile.publicName}
              onChange={(event) => setProfile({ ...profile, publicName: event.target.value })}
            />
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("fields.biography")}</span>
            <textarea
              value={profile.biography ?? ""}
              onChange={(event) => setProfile({ ...profile, biography: event.target.value })}
            />
          </label>
          <AvatarImageUploadField
            label={t("fields.avatar")}
            imageUrl={resolveMediaUrl(profile.avatarUrl)}
            helperText={t("fields.avatarHelper")}
            onUpload={async (file) => {
              const uploaded = await uploadAvatarImage(file);
              const updated = await updateMyMemberProfile({ avatarUrl: uploaded.mediaUrl });
              setProfile(updated);
              dispatchMemberProfileUpdated();
              return uploaded.mediaUrl;
            }}
            onRemove={async () => {
              const updated = await updateMyMemberProfile({ avatarUrl: "" });
              setProfile(updated);
              dispatchMemberProfileUpdated();
            }}
          />
          <label className="member-profile-workspace__field">
            <span>{t("fields.organization")}</span>
            <input
              value={profile.organization ?? ""}
              onChange={(event) => setProfile({ ...profile, organization: event.target.value })}
            />
          </label>
          <ProfileField label={t("fields.memberNumber")} value={profile.memberNumber} />
          <ProfileField
            label={t("fields.location")}
            value={formatLocation(profile, t("fields.notSpecified"))}
          />
          <Button type="submit" variant="primary" disabled={profilePhase.isBusy} ariaLive="polite">
            {resolveSaveButtonLabel(profilePhase.phase, t("saveProfile"))}
          </Button>
        </form>
      </ProfileSection>

      <ProfileSection title={t("sections.skills")} id="skills">
        <MemberSkillsEditor
          skills={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })}
          onSave={handleSkillsSave}
        />
      </ProfileSection>

      <ProfileSection title={t("sections.professional-links")} id="professional-links">
        <MemberProfessionalLinksSection
          website={profile.website}
          linkedinUrl={profile.linkedinUrl}
          facebookUrl={profile.facebookUrl}
          youtubeUrl={profile.youtubeUrl}
          instagramUrl={profile.instagramUrl}
          xUrl={profile.xUrl}
          phase={linksPhase.phase}
          onChange={(patch) => setProfile({ ...profile, ...patch })}
          onSubmit={handleProfessionalLinksSave}
        />
      </ProfileSection>

      <ProfileSection title={t("sections.privacy")} id="privacy">
        <form className="member-profile-workspace__form" onSubmit={handlePrivacySave}>
          <label className="member-profile-workspace__field">
            <span>{t("privacy.profileVisibility")}</span>
            <select
              value={privacy.profileVisibility}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  profileVisibility: event.target
                    .value as MemberProfilePrivacySettings["profileVisibility"],
                })
              }
            >
              {VISIBILITY_OPTION_KEYS.map((value) => (
                <option key={value} value={value}>
                  {t(`visibility.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("privacy.participationVisibility")}</span>
            <select
              value={privacy.participationVisibility}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  participationVisibility: event.target
                    .value as MemberProfilePrivacySettings["participationVisibility"],
                })
              }
            >
              {VISIBILITY_OPTION_KEYS.map((value) => (
                <option key={value} value={value}>
                  {t(`visibility.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("privacy.skillsVisibility")}</span>
            <select
              value={privacy.skillsVisibility}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  skillsVisibility: event.target
                    .value as MemberProfilePrivacySettings["skillsVisibility"],
                })
              }
            >
              {VISIBILITY_OPTION_KEYS.map((value) => (
                <option key={value} value={value}>
                  {t(`visibility.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("privacy.professionalLinksVisibility")}</span>
            <select
              value={privacy.professionalLinksVisibility}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  professionalLinksVisibility: event.target
                    .value as MemberProfilePrivacySettings["professionalLinksVisibility"],
                })
              }
            >
              {VISIBILITY_OPTION_KEYS.map((value) => (
                <option key={value} value={value}>
                  {t(`visibility.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>{t("privacy.messagingPolicy")}</span>
            <select
              value={privacy.messagingPolicy}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  messagingPolicy: event.target
                    .value as MemberProfilePrivacySettings["messagingPolicy"],
                })
              }
            >
              <option value="active_allies">{t("privacy.messagingActiveAllies")}</option>
              <option value="registered_participants">{t("privacy.messagingRegistered")}</option>
              <option value="nobody">{t("privacy.messagingNobody")}</option>
            </select>
          </label>
          <p className="member-profile-workspace__field-hint">{t("privacy.messagingHint")}</p>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showOrganization}
              onChange={(event) =>
                setPrivacy({ ...privacy, showOrganization: event.target.checked })
              }
            />
            <span>{t("privacy.showOrganization")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showLocation}
              onChange={(event) => setPrivacy({ ...privacy, showLocation: event.target.checked })}
            />
            <span>{t("privacy.showLocation")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showParticipationArea}
              onChange={(event) =>
                setPrivacy({ ...privacy, showParticipationArea: event.target.checked })
              }
            />
            <span>{t("privacy.showParticipationArea")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showInitiativesStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showInitiativesStatistics: event.target.checked })
              }
            />
            <span>{t("privacy.showInitiativesStatistics")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showCollectiveDecisionsStatistics}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  showCollectiveDecisionsStatistics: event.target.checked,
                })
              }
            />
            <span>{t("privacy.showCollectiveDecisionsStatistics")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showAlliesStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showAlliesStatistics: event.target.checked })
              }
            />
            <span>{t("privacy.showAlliesStatistics")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showProposalsStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showProposalsStatistics: event.target.checked })
              }
            />
            <span>{t("privacy.showProposalsStatistics")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showPetitionsStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showPetitionsStatistics: event.target.checked })
              }
            />
            <span>{t("privacy.showPetitionsStatistics")}</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showCommitmentsStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showCommitmentsStatistics: event.target.checked })
              }
            />
            <span>{t("privacy.showCommitmentsStatistics")}</span>
          </label>
          <Button type="submit" variant="primary" disabled={privacyPhase.isBusy} ariaLive="polite">
            {resolveSaveButtonLabel(privacyPhase.phase, t("savePrivacy"))}
          </Button>
        </form>
      </ProfileSection>

      <MembershipProfileSection />

      <ParticipationAreaSection />

      <MemberSettingsSummaries profile={profile} />
    </div>
  );
}
