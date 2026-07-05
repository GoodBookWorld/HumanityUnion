import type { CommunityRepresentativeVisual } from "@hu/types";

interface CommunityIdentityVisualProps {
  communityName: string;
  activityArea: string;
  visual: CommunityRepresentativeVisual;
}

export function CommunityIdentityVisual({
  communityName,
  activityArea,
  visual,
}: CommunityIdentityVisualProps) {
  if (visual.kind === "image" && visual.imageHref) {
    return (
      <figure className="community-identity__visual">
        <img
          className="community-identity__visual-image"
          src={visual.imageHref}
          alt={`Representative visual for ${communityName}`}
        />
        <figcaption className="community-identity__visual-caption">{visual.caption}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="community-identity__visual community-identity__visual--placeholder">
      <div
        className="community-identity__visual-frame"
        aria-hidden="true"
        data-activity-area={activityArea}
      >
        <span className="community-identity__visual-initials">{visual.initials}</span>
      </div>
      <figcaption className="community-identity__visual-caption">{visual.caption}</figcaption>
    </figure>
  );
}
