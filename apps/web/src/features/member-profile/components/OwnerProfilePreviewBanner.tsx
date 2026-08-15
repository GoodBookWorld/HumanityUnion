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
  return (
    <section
      className="owner-profile-preview-banner"
      aria-labelledby="owner-profile-preview-banner-title"
    >
      <h2 id="owner-profile-preview-banner-title" className="owner-profile-preview-banner__title">
        Public Profile Preview
      </h2>
      <p className="owner-profile-preview-banner__text">
        This is how your profile appears to other Participants based on your current Privacy
        settings.
      </p>
      <div className="owner-profile-preview-banner__actions">
        <Button href={editProfileHref} variant="primary">
          Edit Profile
        </Button>
        <Button href={managePrivacyHref} variant="secondary">
          Manage Privacy
        </Button>
        {publicProfileHref ? (
          <Button href={publicProfileHref} variant="secondary">
            Open Public Profile
          </Button>
        ) : (
          <p className="owner-profile-preview-banner__unavailable">
            Your public profile link is not available right now.
          </p>
        )}
      </div>
    </section>
  );
}
