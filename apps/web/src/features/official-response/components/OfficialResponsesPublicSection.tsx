import Link from "next/link";

import type { PublicOfficialResponseListItem } from "@hu/types";

interface OfficialResponsesPublicSectionProps {
  responses: PublicOfficialResponseListItem[];
  viewAllHref?: string;
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

function formatType(responseType: string): string {
  return responseType.replace(/_/g, " ");
}

export function OfficialResponsesPublicSection({
  responses,
  viewAllHref,
}: OfficialResponsesPublicSectionProps) {
  if (responses.length === 0) {
    return null;
  }

  const latest = responses[0];

  return (
    <section>
      <h2>Official Responses</h2>
      <p>
        {responses.length} institutional response{responses.length === 1 ? "" : "s"} on public
        record.
      </p>

      {latest ? (
        <div>
          <p>
            <strong>Latest:</strong> {latest.responseNumber} — {latest.organizationName}
          </p>
          <p>
            {formatType(latest.responseType)} · {latest.verificationState.replace(/_/g, " ")} ·{" "}
            {formatDate(latest.receivedAt)}
          </p>
          <p>{latest.summary}</p>
          <p>
            <Link href={`/public-responses/${encodeURIComponent(latest.responseId)}`}>
              Open response →
            </Link>
          </p>
        </div>
      ) : null}

      <ul>
        {responses.map((response) => (
          <li key={response.responseId}>
            <Link href={`/public-responses/${encodeURIComponent(response.responseId)}`}>
              {response.responseNumber} — {response.organizationName}
            </Link>
            <p>
              {formatType(response.responseType)} · {response.verificationState.replace(/_/g, " ")}{" "}
              · {formatDate(response.receivedAt)}
            </p>
            <p>{response.summary}</p>
          </li>
        ))}
      </ul>

      {viewAllHref ? (
        <p>
          <Link href={viewAllHref}>View all official responses</Link>
        </p>
      ) : null}
    </section>
  );
}
