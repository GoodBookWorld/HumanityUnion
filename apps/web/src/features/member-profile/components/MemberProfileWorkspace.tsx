"use client";

import { useEffect, useState } from "react";

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

const SECTIONS = [
  "Statistics",
  "Profile",
  "Skills",
  "Professional Links",
  "Privacy",
  "Participation Area",
  "Preferences",
] as const;

function formatLocation(profile: MemberProfile): string {
  const parts = [profile.community, profile.region, profile.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

export function MemberProfileWorkspace() {
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
            setError(
              loadError instanceof Error ? loadError.message : "Unable to load member profile.",
            );
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
  }, []);

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
        setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
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
        });
        setProfile(updated);
        dispatchMemberProfileUpdated();
      });
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save professional links.",
        );
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
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save privacy settings.",
        );
      }
    }
  }

  if (loading) {
    return <p>Loading profile…</p>;
  }

  if (authRequired) {
    return (
      <ProfileSection title="Profile">
        <p>Sign in to manage your Participant profile.</p>
        <Button href="/login">Log in</Button>
      </ProfileSection>
    );
  }

  if (apiUnavailable) {
    return (
      <ProfileSection title="Profile">
        <ApiUnavailableState
          title="Profile temporarily unavailable"
          explanation="We couldn't connect to the Humanity Union service. Please try again shortly."
          retryHref="/member"
        />
      </ProfileSection>
    );
  }

  if (!profile || !privacy) {
    return (
      <ProfileSection title="Profile">
        <p>{error ?? "Profile is unavailable."}</p>
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

      <nav className="member-profile-workspace__sections" aria-label="Profile sections">
        {SECTIONS.map((section) => {
          const sectionId = section.toLowerCase().replace(/\s+/g, "-");
          return (
            <a
              key={section}
              className="member-profile-workspace__section-link"
              href={`#${sectionId}`}
            >
              {section}
            </a>
          );
        })}
      </nav>

      <ProfileSection title="Statistics" id="statistics">
        <PersonalStatisticsCards statistics={statistics} loading={statisticsLoading} />
      </ProfileSection>

      <ProfileSection title="Profile" id="profile">
        <form className="member-profile-workspace__form" onSubmit={handleProfileSave}>
          <label className="member-profile-workspace__field">
            <span>Display name</span>
            <input
              value={profile.displayName}
              onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
            />
          </label>
          <label className="member-profile-workspace__field">
            <span>Public name</span>
            <input
              value={profile.publicName}
              onChange={(event) => setProfile({ ...profile, publicName: event.target.value })}
            />
          </label>
          <label className="member-profile-workspace__field">
            <span>Biography</span>
            <textarea
              value={profile.biography ?? ""}
              onChange={(event) => setProfile({ ...profile, biography: event.target.value })}
            />
          </label>
          <AvatarImageUploadField
            label="Avatar"
            imageUrl={resolveMediaUrl(profile.avatarUrl)}
            helperText="Choose a JPEG, PNG, or WEBP image up to 2 MB, then crop and position it before saving."
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
            <span>Organization</span>
            <input
              value={profile.organization ?? ""}
              onChange={(event) => setProfile({ ...profile, organization: event.target.value })}
            />
          </label>
          <ProfileField label="Member Number" value={profile.memberNumber} />
          <ProfileField label="Location" value={formatLocation(profile)} />
          <Button type="submit" variant="primary" disabled={profilePhase.isBusy} ariaLive="polite">
            {resolveSaveButtonLabel(profilePhase.phase, "Save profile")}
          </Button>
        </form>
      </ProfileSection>

      <ProfileSection title="Skills" id="skills">
        <MemberSkillsEditor
          skills={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })}
          onSave={handleSkillsSave}
        />
      </ProfileSection>

      <ProfileSection title="Professional Links" id="professional-links">
        <MemberProfessionalLinksSection
          website={profile.website}
          linkedinUrl={profile.linkedinUrl}
          phase={linksPhase.phase}
          onWebsiteChange={(website) => setProfile({ ...profile, website })}
          onLinkedInChange={(linkedinUrl) => setProfile({ ...profile, linkedinUrl })}
          onSubmit={handleProfessionalLinksSave}
        />
      </ProfileSection>

      <ProfileSection title="Privacy" id="privacy">
        <form className="member-profile-workspace__form" onSubmit={handlePrivacySave}>
          <label className="member-profile-workspace__field">
            <span>Who can see my public profile</span>
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
              <option value="public">Public</option>
              <option value="members_only">Members only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>Who can see my Participation Areas</span>
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
              <option value="public">Public</option>
              <option value="members_only">Members only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>Who can see my Skills</span>
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
              <option value="public">Public</option>
              <option value="members_only">Members only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>Who can see my Professional Links</span>
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
              <option value="public">Public</option>
              <option value="members_only">Members only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="member-profile-workspace__field">
            <span>Who can message me?</span>
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
              <option value="active_allies">Active Allies (recommended)</option>
              <option value="registered_participants">Registered Participants</option>
              <option value="nobody">Nobody</option>
            </select>
          </label>
          <p className="member-profile-workspace__field-hint">
            Controls who can start a new Direct Collaboration conversation with you. Existing
            conversation history remains visible; choosing &ldquo;Nobody&rdquo; only blocks new messages.
          </p>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showOrganization}
              onChange={(event) =>
                setPrivacy({ ...privacy, showOrganization: event.target.checked })
              }
            />
            <span>Show organization publicly when allowed</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showLocation}
              onChange={(event) => setPrivacy({ ...privacy, showLocation: event.target.checked })}
            />
            <span>Show location publicly when allowed</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showParticipationArea}
              onChange={(event) =>
                setPrivacy({ ...privacy, showParticipationArea: event.target.checked })
              }
            />
            <span>Show participation area publicly when allowed</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showInitiativesStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showInitiativesStatistics: event.target.checked })
              }
            />
            <span>Show Initiatives statistics publicly</span>
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
            <span>Show Collective Decisions statistics publicly</span>
          </label>
          <label className="member-profile-workspace__checkbox">
            <input
              type="checkbox"
              checked={privacy.showAlliesStatistics}
              onChange={(event) =>
                setPrivacy({ ...privacy, showAlliesStatistics: event.target.checked })
              }
            />
            <span>Show Allies statistics publicly</span>
          </label>
          <Button type="submit" variant="primary" disabled={privacyPhase.isBusy} ariaLive="polite">
            {resolveSaveButtonLabel(privacyPhase.phase, "Save privacy settings")}
          </Button>
        </form>
      </ProfileSection>

      <MembershipProfileSection />

      <ParticipationAreaSection />

      <MemberSettingsSummaries profile={profile} />
    </div>
  );
}
