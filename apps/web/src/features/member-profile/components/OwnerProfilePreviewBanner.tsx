"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";

import "./owner-profile-preview-banner.css";

/**
 * Profile UX Pack 03.3 Part 4 — the compact owner-only banner shown above
 * the shared `ParticipantProfileSurface` on `/profile`. Route-specific
 * (hrefs, "who am I") logic lives here and in the `/profile` page, never
 * inside the shared surface component itself.
 */
export interface OwnerProfilePreviewBannerProps {
  editProfileHref: string;
  managePrivacyHref: string;
  /** `null` when the projected public profile URL is not currently available. */
  publicProfileHref: string | null;
}

export function OwnerProfilePreviewBanner({
  editProfileHref,
  managePrivacyHref,
  publicProfileHref,
}: OwnerProfilePreviewBannerProps) {
  const t = useTranslations("memberProfile.preview");
  const tWorkspace = useTranslations("workspace");
  const tHidden = useTranslations("participantPublic.ownerHidden");

  return (
    <section
      className="owner-profile-preview-banner"
      aria-labelledby="owner-profile-preview-banner-title"
    >
      <h2 id="owner-profile-preview-banner-title" className="owner-profile-preview-banner__title">
        {t("title")}
      </h2>
      <p className="owner-profile-preview-banner__text">{t("bannerBody")}</p>
      <div className="owner-profile-preview-banner__actions">
        <Button href={editProfileHref} variant="primary">
          {tWorkspace("editProfile")}
        </Button>
        <Button href={managePrivacyHref} variant="secondary">
          {tHidden("managePrivacy")}
        </Button>
        {publicProfileHref ? (
          <Button href={publicProfileHref} variant="secondary">
            {t("openPublicProfile")}
          </Button>
        ) : (
          <p className="owner-profile-preview-banner__unavailable">{t("linkUnavailable")}</p>
        )}
      </div>
    </section>
  );
}
