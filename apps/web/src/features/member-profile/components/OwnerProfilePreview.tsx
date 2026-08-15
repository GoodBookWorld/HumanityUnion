"use client";

import type { MemberProfilePublicPreview } from "@hu/types";
import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import {
  ApiRequestError,
  isApiUnavailableError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import { getMyPublicMemberProfilePreview } from "../member-profile-api";
import { MembershipProfileSection } from "../../membership/components/MembershipProfileSection";
import { ParticipantProfileSurface } from "./ParticipantProfileSurface";
import { OwnerProfilePreviewBanner } from "./OwnerProfilePreviewBanner";

const EDIT_PROFILE_HREF = "/member";
const MANAGE_PRIVACY_HREF = "/member#privacy";

type OwnerProfilePreviewState =
  | { status: "loading" }
  | { status: "auth_required" }
  | { status: "api_unavailable" }
  | { status: "profile_private" }
  | { status: "unavailable" }
  | { status: "ready"; preview: MemberProfilePublicPreview };

/**
 * Profile UX Pack 03.3 — `/profile` route body. Loads the owner's "what
 * will other Participants see" preview with a single request
 * (`getMyPublicMemberProfilePreview`), then renders the exact same shared
 * `ParticipantProfileSurface` `/member/{publicName}` uses, in
 * `owner_preview` mode, with the compact preview banner above it. Never
 * fetches the raw, unfiltered `MemberProfile` — the surface only ever
 * receives the already-Privacy-filtered projection.
 */
export function OwnerProfilePreview() {
  const [state, setState] = useState<OwnerProfilePreviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void getMyPublicMemberProfilePreview()
      .then((preview) => {
        if (!cancelled) {
          setState({ status: "ready", preview });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(error)) {
          setState({ status: "auth_required" });
          return;
        }

        if (error instanceof ApiRequestError && error.status === 403) {
          setState({ status: "profile_private" });
          return;
        }

        if (isApiUnavailableError(error)) {
          setState({ status: "api_unavailable" });
          return;
        }

        setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p>Loading your profile preview...</p>;
  }

  if (state.status === "api_unavailable") {
    return (
      <ApiUnavailableState
        title="Profile preview temporarily unavailable"
        explanation="We couldn't connect to the Humanity Union service. Please try again shortly."
        retryHref="/profile"
      />
    );
  }

  if (state.status === "auth_required") {
    return (
      <ProfileSection title="Public Profile Preview">
        <p>Sign in to preview your public profile.</p>
        <Button href="/login?returnTo=/profile">Log in</Button>
      </ProfileSection>
    );
  }

  if (state.status === "profile_private") {
    return (
      <>
        <ProfileSection title="Public Profile Preview">
          <p>
            Your Profile Visibility is currently set to Private, so other Participants cannot open
            your profile at all.
          </p>
          <div className="owner-profile-preview-banner__actions">
            <Button href={EDIT_PROFILE_HREF} variant="primary">
              Edit Profile
            </Button>
            <Button href={MANAGE_PRIVACY_HREF} variant="secondary">
              Manage Privacy
            </Button>
          </div>
        </ProfileSection>
        <MembershipProfileSection />
      </>
    );
  }

  if (state.status === "unavailable") {
    return (
      <ProfileSection title="Public Profile Preview">
        <p>Profile preview is unavailable.</p>
      </ProfileSection>
    );
  }

  const { profile, hiddenSections } = state.preview;
  const publicProfileHref = profile.publicName
    ? `/member/${encodeURIComponent(profile.publicName)}`
    : null;

  return (
    <>
      <OwnerProfilePreviewBanner
        editProfileHref={EDIT_PROFILE_HREF}
        managePrivacyHref={MANAGE_PRIVACY_HREF}
        publicProfileHref={publicProfileHref}
      />
      <ParticipantProfileSurface
        mode="owner_preview"
        profile={profile}
        hiddenSections={hiddenSections}
        ownerActionLinks={{
          editProfileHref: EDIT_PROFILE_HREF,
          managePrivacyHref: MANAGE_PRIVACY_HREF,
        }}
      />
      <MembershipProfileSection />
    </>
  );
}
