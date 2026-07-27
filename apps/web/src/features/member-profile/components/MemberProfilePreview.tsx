"use client";

import type { MemberProfile } from "@hu/types";
import { useEffect, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
import { getMyMemberProfile } from "../../member-profile/member-profile-api";
import { MembershipProfileSection } from "../../membership/components/MembershipProfileSection";
import { isMemberProfileFieldVisible } from "../member-profile-visibility";
import { MemberProfessionalLinksDisplay, MemberSkillTags } from "./MemberProfessionalLinksSection";

import "./member-profile-preview.css";
import "./member-skills-editor.css";
import "./member-professional-links.css";

function formatLocation(profile: MemberProfile): string {
  const parts = [profile.community, profile.region, profile.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

export function MemberProfilePreview() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getMyMemberProfile()
      .then((loaded) => {
        if (!cancelled) {
          setProfile(loaded);
        }
      })
      .catch((error) => {
        if (!cancelled && isAuthenticationRequiredError(error)) {
          setAuthRequired(true);
          return;
        }

        if (!cancelled && isApiUnavailableError(error)) {
          setApiUnavailable(true);
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
    return <p>Loading profile preview...</p>;
  }

  if (apiUnavailable) {
    return (
      <ApiUnavailableState
        title="Profile preview temporarily unavailable"
        explanation="We couldn't connect to the Humanity Union service. Please try again shortly."
        retryHref="/profile"
      />
    );
  }

  if (authRequired) {
    return (
      <ProfileSection title="Profile Preview">
        <p>Sign in to preview your member profile.</p>
        <Button href="/login?returnTo=/profile">Log in</Button>
      </ProfileSection>
    );
  }

  if (!profile) {
    return (
      <ProfileSection title="Profile Preview">
        <p>Profile preview is unavailable.</p>
      </ProfileSection>
    );
  }

  const publicViewer = {
    viewerIsAuthenticated: false,
    viewerIsOwner: false,
  };
  const skillsVisible = isMemberProfileFieldVisible(profile.skillsVisibility, publicViewer);
  const linksVisible = isMemberProfileFieldVisible(
    profile.professionalLinksVisibility,
    publicViewer,
  );
  const visibleSkills = skillsVisible ? profile.skills : [];
  const visibleWebsite = linksVisible ? profile.website : undefined;
  const visibleLinkedIn = linksVisible ? profile.linkedinUrl : undefined;

  return (
    <div className="member-profile-preview">
      <ProfileSection title="Public Profile Preview">
        <div className="member-profile-preview__header">
          <HumanityAvatar
            alt={profile.publicName || profile.displayName}
            avatarUrl={profile.avatarUrl}
            size={64}
          />
          <div>
            <h2>{profile.publicName || profile.displayName}</h2>
            <p>{profile.biography ?? "No biography yet."}</p>
          </div>
        </div>
        <ProfileField label="Display name" value={profile.displayName} />
        <ProfileField label="Public name" value={profile.publicName} />
        <ProfileField label="Organization" value={profile.organization ?? "Not specified"} />
        <ProfileField label="Location" value={formatLocation(profile)} />
        <ProfileField label="Profile visibility" value={profile.profileVisibility} />

        <div className="member-profile-preview__subsection">
          <h3 className="member-profile-preview__subsection-title">Skills</h3>
          {visibleSkills.length > 0 ? (
            <MemberSkillTags skills={visibleSkills} />
          ) : (
            <p className="member-profile-preview__muted">
              {skillsVisible ? "No skills added yet." : "Skills are hidden from public viewers."}
            </p>
          )}
        </div>

        <div className="member-profile-preview__subsection">
          <h3 className="member-profile-preview__subsection-title">Professional Links</h3>
          <MemberProfessionalLinksDisplay website={visibleWebsite} linkedinUrl={visibleLinkedIn} />
          {!visibleWebsite && !visibleLinkedIn ? (
            <p className="member-profile-preview__muted">
              {linksVisible
                ? "No professional links added yet."
                : "Professional links are hidden from public viewers."}
            </p>
          ) : null}
        </div>

        <p className="member-profile-preview__note">
          Manage email, password, and security on the <a href="/account">Account &amp; Security</a>{" "}
          page. Edit profile details on the <a href="/member">Member workspace</a>. Manage
          visibility in <a href="/preferences#visibility">Preferences</a>.
        </p>
      </ProfileSection>

      <MembershipProfileSection />
    </div>
  );
}
