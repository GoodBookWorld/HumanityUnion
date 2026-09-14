"use client";

/**
 * Pack 08I.15 — Official Response public list.
 * WEB_UI chrome via catalogs; CIVIC_CONTENT summary via PublicTranslatedFields.
 * organizationName / responseNumber remain NON_TRANSLATABLE.
 */

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { PublicOfficialResponseListItem } from "@hu/types";

import { PublicTranslatedFields } from "../../language";

interface OfficialResponsesPublicSectionProps {
  responses: PublicOfficialResponseListItem[];
  viewAllHref?: string;
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function OfficialResponseSummary({
  response,
}: {
  response: PublicOfficialResponseListItem;
}) {
  const t = useTranslations("initiativeExperience");
  return (
    <PublicTranslatedFields
      sourceKind="official_response"
      sourceRecordId={response.responseId}
      fieldOrder={["summary"]}
      fieldLabels={{
        summary: t("stages.official_response"),
      }}
      fallbackFields={{
        summary: response.summary,
      }}
    />
  );
}

export function OfficialResponsesPublicSection({
  responses,
  viewAllHref,
}: OfficialResponsesPublicSectionProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  if (responses.length === 0) {
    return null;
  }

  const latest = responses[0];
  const heading = t("stages.official_response");

  return (
    <section>
      <h2>{heading}</h2>
      <p>
        {responses.length}{" "}
        {heading}
      </p>

      {latest ? (
        <div>
          <p>
            <strong>{latest.responseNumber}</strong> — {latest.organizationName}
          </p>
          <p>
            {latest.responseType.replace(/_/g, " ")} ·{" "}
            {latest.verificationState.replace(/_/g, " ")} ·{" "}
            {formatDate(latest.receivedAt, locale)}
          </p>
          <OfficialResponseSummary response={latest} />
          <p>
            <Link href={`/public-responses/${encodeURIComponent(latest.responseId)}`}>
              {latest.responseNumber}
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
              {response.responseType.replace(/_/g, " ")} ·{" "}
              {response.verificationState.replace(/_/g, " ")} ·{" "}
              {formatDate(response.receivedAt, locale)}
            </p>
            <OfficialResponseSummary response={response} />
          </li>
        ))}
      </ul>

      {viewAllHref ? (
        <p>
          <Link href={viewAllHref}>{heading}</Link>
        </p>
      ) : null}
    </section>
  );
}
