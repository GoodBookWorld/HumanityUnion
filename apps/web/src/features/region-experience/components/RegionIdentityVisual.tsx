import type { RegionRepresentativeVisual } from "@hu/types";

interface RegionIdentityVisualProps {
  regionName: string;
  visual: RegionRepresentativeVisual;
}

export function RegionIdentityVisual({ regionName, visual }: RegionIdentityVisualProps) {
  if (visual.kind === "image" && visual.imageHref) {
    return (
      <figure className="region-identity__visual">
        <img
          className="region-identity__visual-image"
          src={visual.imageHref}
          alt={`Representative visual for ${regionName}`}
        />
        <figcaption className="region-identity__visual-caption">{visual.caption}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="region-identity__visual region-identity__visual--placeholder">
      <div className="region-identity__visual-frame" aria-hidden="true">
        <span className="region-identity__visual-initials">{visual.initials}</span>
      </div>
      <figcaption className="region-identity__visual-caption">{visual.caption}</figcaption>
    </figure>
  );
}
