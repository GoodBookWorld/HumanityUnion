import type { ReactNode } from "react";

interface MediaSectionHeaderProps {
  heading: string;
  headingId: string;
  description?: string;
  controls?: ReactNode;
}

export function MediaSectionHeader({
  heading,
  headingId,
  description,
  controls,
}: MediaSectionHeaderProps) {
  return (
    <div className="media-section-header">
      <div className="media-section-header__copy">
        <h2 id={headingId}>{heading}</h2>
        {description ? <p className="media-section-header__description">{description}</p> : null}
      </div>
      {controls ? <div className="media-section-header__controls">{controls}</div> : null}
    </div>
  );
}
