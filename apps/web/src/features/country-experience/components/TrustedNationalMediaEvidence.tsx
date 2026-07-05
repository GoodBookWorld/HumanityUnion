import type { TrustedNationalMediaPublicProjection } from "@hu/types";

function isActiveMediaRoute(
  record: TrustedNationalMediaPublicProjection["media"][number],
): record is TrustedNationalMediaPublicProjection["media"][number] & { mediaHref: string } {
  return record.mediaRouteStatus === "active" && Boolean(record.mediaHref);
}

interface TrustedNationalMediaEvidenceProps {
  projection: TrustedNationalMediaPublicProjection;
}

export function TrustedNationalMediaEvidence({ projection }: TrustedNationalMediaEvidenceProps) {
  return (
    <div className="trusted-national-media">
      <p className="trusted-national-media__scope">
        Scope: {projection.scopeLabel}
        {projection.source === "bootstrap" ? (
          <span className="trusted-national-media__source"> · Bootstrap demonstration data</span>
        ) : null}
      </p>

      {projection.media.length > 0 ? (
        <ul className="trusted-national-media__list">
          {projection.media.map((record) => (
            <li key={record.id} className="trusted-national-media__item">
              <article aria-labelledby={`trusted-media-${record.id}`}>
                <h3 className="trusted-national-media__title" id={`trusted-media-${record.id}`}>
                  {isActiveMediaRoute(record) ? (
                    <a href={record.mediaHref}>{record.title}</a>
                  ) : (
                    <span>{record.title}</span>
                  )}
                </h3>
                <p className="trusted-national-media__publisher">{record.publisher}</p>
                <p className="trusted-national-media__summary">{record.summary}</p>
                {record.mediaRouteStatus === "unavailable" ? (
                  <p className="trusted-national-media__unavailable" role="note">
                    {record.unavailableNotice ??
                      "Media link not available — Verified Media capability not yet implemented."}
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="trusted-national-media__empty" role="status">
          No public-safe national media associations are available for this country yet.
        </p>
      )}
    </div>
  );
}
