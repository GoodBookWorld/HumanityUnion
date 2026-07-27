"use client";

import { useEffect, useState } from "react";

import type { MemberProfile, MemberProfilePrivacySettings } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
import { AvatarImageUploadField } from "../../media-upload/components/AvatarImageUploadField";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { uploadAvatarImage } from "../../media-upload/media-upload-api";
import {
  getMyMemberProfile,
  getMyMemberProfilePrivacy,
  updateMyMemberProfile,
  updateMyMemberProfilePrivacy,
} from "../member-profile-api";
import { dispatchMemberProfileUpdated } from "../member-profile-events";
import { ParticipationAreaSection } from "../../participation-area/components/ParticipationAreaSection";
import { MembershipProfileSection } from "../../membership/components/MembershipProfileSection";
import { MemberSettingsSummaries } from "./MemberSettingsSummaries";
import { MemberSkillsEditor } from "./MemberSkillsEditor";
import { MemberProfessionalLinksSection } from "./MemberProfessionalLinksSection";

import "./member-profile-workspace.css";

const SECTIONS = [
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
  const [error, setError] = useState<string | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [linksSuccessMessage, setLinksSuccessMessage] = useState<string | null>(null);

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

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
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
      setSuccessMessage("Profile saved successfully.");
      dispatchMemberProfileUpdated();
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
      }
    } finally {
      setSaving(false);
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

    setSaving(true);
    setError(null);
    setLinksSuccessMessage(null);

    try {
      const updated = await updateMyMemberProfile({
        website: profile.website,
        linkedinUrl: profile.linkedinUrl,
      });
      setProfile(updated);
      setLinksSuccessMessage("Professional links saved successfully.");
      dispatchMemberProfileUpdated();
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save professional links.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePrivacySave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!privacy) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateMyMemberProfilePrivacy(privacy);
      setPrivacy(updated);
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save privacy settings.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading member profile...</p>;
  }

  if (authRequired) {
    return (
      <ProfileSection title="Member Profile">
        <p>Sign in to manage your member profile.</p>
        <Button href="/login">Log in</Button>
      </ProfileSection>
    );
  }

  if (apiUnavailable) {
    return (
      <ProfileSection title="Member Profile">
        <ApiUnavailableState
          title="Member profile temporarily unavailable"
          explanation="We couldn't connect to the Humanity Union service. Please try again shortly."
          retryHref="/member"
        />
      </ProfileSection>
    );
  }

  if (!profile || !privacy) {
    return (
      <ProfileSection title="Member Profile">
        <p>{error ?? "Member profile is unavailable."}</p>
      </ProfileSection>
    );
  }

  return (
    <div className="member-profile-workspace">
      {successMessage ? (
        <p className="member-profile-workspace__success" role="status">
          {successMessage}
        </p>
      ) : null}
      {error ? (
        <p className="member-profile-workspace__error" role="alert">
          {error}
        </p>
      ) : null}

      <nav className="member-profile-workspace__sections" aria-label="Member profile sections">
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
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </ProfileSection>

      <ProfileSection title="Skills" id="skills">
        <MemberSkillsEditor
          skills={profile.skills}
          disabled={saving}
          onChange={(skills) => setProfile({ ...profile, skills })}
          onSave={handleSkillsSave}
        />
      </ProfileSection>

      <ProfileSection title="Professional Links" id="professional-links">
        <MemberProfessionalLinksSection
          website={profile.website}
          linkedinUrl={profile.linkedinUrl}
          disabled={saving}
          saving={saving}
          successMessage={linksSuccessMessage}
          onWebsiteChange={(website) => setProfile({ ...profile, website })}
          onLinkedInChange={(linkedinUrl) => setProfile({ ...profile, linkedinUrl })}
          onSubmit={handleProfessionalLinksSave}
        />
      </ProfileSection>

      <ProfileSection title="Privacy" id="privacy">
        <form className="member-profile-workspace__form" onSubmit={handlePrivacySave}>
          <label className="member-profile-workspace__field">
            <span>Profile visibility</span>
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
            <span>Participation area visibility</span>
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
            <span>Skills visibility</span>
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
            <span>Professional links visibility</span>
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
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save privacy settings"}
          </Button>
        </form>
      </ProfileSection>

      <MembershipProfileSection />

      <ParticipationAreaSection />

      <MemberSettingsSummaries profile={profile} />
    </div>
  );
}
