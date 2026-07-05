import type { CountryRepresentativeVisual } from "@hu/types";

interface CountryIdentityVisualProps {
  countryName: string;
  visual: CountryRepresentativeVisual;
}

export function CountryIdentityVisual({ countryName, visual }: CountryIdentityVisualProps) {
  if (visual.kind === "image" && visual.imageHref) {
    return (
      <figure className="country-identity__visual">
        <img
          className="country-identity__visual-image"
          src={visual.imageHref}
          alt={`Representative visual for ${countryName}`}
        />
        <figcaption className="country-identity__visual-caption">{visual.caption}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="country-identity__visual country-identity__visual--placeholder">
      <div className="country-identity__visual-frame" aria-hidden="true">
        <span className="country-identity__visual-initials">{visual.initials}</span>
      </div>
      <figcaption className="country-identity__visual-caption">{visual.caption}</figcaption>
    </figure>
  );
}
