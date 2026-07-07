import Link from "next/link";

import type { PublicCivicAccountabilityListItem } from "@hu/types";

interface CivicAccountabilityPublicSectionProps {
  records: PublicCivicAccountabilityListItem[];
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CivicAccountabilityPublicSection({
  records,
}: CivicAccountabilityPublicSectionProps) {
  if (records.length === 0) {
    return null;
  }

  const latest = records[0];

  return (
    <section>
      <h2>Civic Accountability</h2>
      <p>
        {records.length} accountability timeline{records.length === 1 ? "" : "s"} on public record.
      </p>

      {latest ? (
        <div>
          <p>
            <strong>Latest event:</strong> {latest.latestEventTitle ?? "No events yet"}
          </p>
          {latest.latestEventSummary ? <p>{latest.latestEventSummary}</p> : null}
          <p>
            {latest.status} · {latest.eventCount} event{latest.eventCount === 1 ? "" : "s"} ·{" "}
            {formatDate(latest.latestEventOccurredAt ?? latest.updatedAt)}
          </p>
          <p>
            <Link
              href={`/civic-accountability/public/${encodeURIComponent(latest.accountabilityId)}`}
            >
              View timeline →
            </Link>
          </p>
        </div>
      ) : null}

      <ul>
        {records.map((record) => (
          <li key={record.accountabilityId}>
            <Link
              href={`/civic-accountability/public/${encodeURIComponent(record.accountabilityId)}`}
            >
              Civic Accountability — {record.status}
            </Link>
            <p>
              {record.eventCount} event{record.eventCount === 1 ? "" : "s"} ·{" "}
              {formatDate(record.updatedAt)}
            </p>
            {record.latestEventTitle ? <p>{record.latestEventTitle}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
