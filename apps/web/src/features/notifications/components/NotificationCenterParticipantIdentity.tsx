"use client";

import { useEffect, useState } from "react";

import { InitiativeAuthorIdentity } from "../../initiative-active-allies/components/InitiativeAuthorIdentity";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import {
  getMyPublicMemberProfilePreview,
  getWorkspaceMemberIdentity,
} from "../../member-profile/member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";

import "../notifications-page.css";

/**
 * Participant UX Pack 01 — compact signed-in identity for Notification Center.
 * Reuses `InitiativeAuthorIdentity` (`iaa-widget__identity`) presentation and
 * resolves the canonical public profile href dynamically — never hardcoded.
 */
export function NotificationCenterParticipantIdentity() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [profileUrl, setProfileUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [identity, preview] = await Promise.all([
          getWorkspaceMemberIdentity(),
          getMyPublicMemberProfilePreview(),
        ]);

        if (cancelled) {
          return;
        }

        setDisplayName(identity.displayName);
        setAvatarUrl(identity.avatarUrl);
        const publicName = preview.profile.publicName?.trim();
        setProfileUrl(
          publicName ? `/member/${encodeURIComponent(publicName)}` : undefined,
        );
      } catch (error) {
        if (!cancelled && !isAuthenticationRequiredError(error)) {
          setDisplayName(null);
          setProfileUrl(undefined);
        }
      }
    }

    void load();

    function onProfileUpdated() {
      void load();
    }

    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, []);

  if (!displayName) {
    return null;
  }

  return (
    <InitiativeAuthorIdentity
      className="notifications-page__participant-identity"
      displayName={displayName}
      avatarUrl={avatarUrl}
      profileUrl={profileUrl}
      avatarSize={36}
    />
  );
}
