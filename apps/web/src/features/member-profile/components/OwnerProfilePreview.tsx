"use client";

import type { MemberProfilePublicPreview } from "@hu/types";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import {
  ApiRequestError,
  isApiUnavailableError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import {
  getMyPublicMemberProfilePreview,
  getPublicMemberProfileByPublicName,
} from "../member-profile-api";
import { mergeOwnerPreviewLocalizedFields } from "../merge-owner-preview-localized-fields";
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
 * will other Participants see" preview with privacy from
 * `getMyPublicMemberProfilePreview`, then aligns Biography/Skills with the
 * same public by-name projection `/member/{publicName}` uses (credentials
 * omitted so the owner is never elevated to viewerIsOwner). Renders the
 * shared `ParticipantProfileSurface` in `owner_preview` mode.
 */
export function OwnerProfilePreview() {
  const locale = useLocale();
  const t = useTranslations("memberProfile.preview");
  const tProfile = useTranslations("memberProfile");
  const tWorkspace = useTranslations("workspace");
  const tHidden = useTranslations("participantPublic.ownerHidden");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const [state, setState] = useState<OwnerProfilePreviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const preview = await getMyPublicMemberProfilePreview(locale);
        const publicName = preview.profile.publicName?.trim();

        let nextPreview = preview;
        if (publicName) {
          try {
            // Same read path as `/member/{publicName}` SSR: anonymous + locale.
            // Keeps privacy shape from preview; overlays participant_public fields.
            const localizedPublic = await getPublicMemberProfileByPublicName(
              publicName,
              locale,
              { credentials: "omit" },
            );
            nextPreview = {
              ...preview,
              profile: mergeOwnerPreviewLocalizedFields({
                privacyFiltered: preview.profile,
                localizedPublic,
              }),
            };
          } catch {
            // members_only / network: keep privacy preview (API overlay still applied).
          }
        }

        if (!cancelled) {
          setState({ status: "ready", preview: nextPreview });
        }
      } catch (error: unknown) {
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (state.status === "loading") {
    return <p>{t("loading")}</p>;
  }

  if (state.status === "api_unavailable") {
    return (
      <ApiUnavailableState
        title={t("unavailableTitle")}
        explanation={tProfile("unavailableExplanation", siteName)}
        retryHref="/profile"
      />
    );
  }

  if (state.status === "auth_required") {
    return (
      <ProfileSection title={t("title")}>
        <p>{t("signInBody")}</p>
        <Button href="/login?returnTo=/profile">{tProfile("logIn")}</Button>
      </ProfileSection>
    );
  }

  if (state.status === "profile_private") {
    return (
      <>
        <ProfileSection title={t("title")}>
          <p>{t("privateBody")}</p>
          <div className="owner-profile-preview-banner__actions">
            <Button href={EDIT_PROFILE_HREF} variant="primary">
              {tWorkspace("editProfile")}
            </Button>
            <Button href={MANAGE_PRIVACY_HREF} variant="secondary">
              {tHidden("managePrivacy")}
            </Button>
          </div>
        </ProfileSection>
        <MembershipProfileSection />
      </>
    );
  }

  if (state.status === "unavailable") {
    return (
      <ProfileSection title={t("title")}>
        <p>{t("unavailable")}</p>
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
