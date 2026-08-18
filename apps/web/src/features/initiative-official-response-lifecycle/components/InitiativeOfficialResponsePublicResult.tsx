"use client";

import { useEffect, useState } from "react";

import type {
  InitiativeOfficialResponsePackage,
  InitiativeOfficialResponseRecord,
} from "@hu/types";

import { getPublishedOfficialResponses } from "../api";

import "./initiative-official-response-stage-workspace.css";

interface InitiativeOfficialResponsePublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part K, Section 6/9. Read-only for every
 * viewer, including the Initiative's Author — editing a published
 * Response happens only via a new Publish cycle, never here.
 */
export function InitiativeOfficialResponsePublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeOfficialResponsePublicResultProps) {
  const [pkg, setPackage] = useState<InitiativeOfficialResponsePackage | null | undefined>(undefined);
  const [responses, setResponses] = useState<readonly InitiativeOfficialResponseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublishedOfficialResponses(initiativeId);
        if (!cancelled) {
          setPackage(result.package);
          setResponses(result.responses);
        }
      } catch {
        if (!cancelled) {
          setError("Published Official Responses could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (error) {
    return <p className="ior-source-panel__empty">{error}</p>;
  }

  if (pkg === undefined || !responses) {
    return <p className="ior-source-panel__empty">Loading published Official Responses…</p>;
  }

  if (!pkg) {
    return <p className="ior-source-panel__empty">No Official Responses published yet.</p>;
  }

  const isNoResponse = pkg.outcomeKind === "no_official_response_received" || responses.length === 0;

  if (isNoResponse) {
    return (
      <article className="ior-public" aria-label="No official response received">
        {isPreview ? <p className="ior-public__meta">Author Preview of published Official Responses</p> : null}
        <section className="ior-public__section">
          <h3>{pkg.title || "Official Responses"}</h3>
          <p className="ior-public__meta">Published outcome</p>
          <h3>No official response received</h3>
          <p>
            {pkg.noResponseDetail?.note?.trim() ||
              pkg.summary ||
              "The Author documented that no official response was received."}
          </p>
          {pkg.noResponseDetail?.contactedOrganizations?.length ? (
            <p className="ior-public__meta">
              Contacted: {pkg.noResponseDetail.contactedOrganizations.join(", ")}
            </p>
          ) : null}
          {pkg.noResponseDetail?.contactedDates?.length ? (
            <p className="ior-public__meta">Dates: {pkg.noResponseDetail.contactedDates.join(", ")}</p>
          ) : null}
        </section>
      </article>
    );
  }

  return (
    <article className="ior-public" aria-label="Published Official Responses">
      {isPreview ? <p className="ior-public__meta">Author Preview of published Official Responses</p> : null}
      <section className="ior-public__section">
        <h3>Received official responses</h3>
        <p className="ior-public__meta">{responses.length} Response(s) published</p>
        {pkg.summary ? <p>{pkg.summary}</p> : null}
      </section>

      {responses.map((response) => (
        <div className="ior-public__response" key={response.responseId}>
          <h3>{response.subject}</h3>
          <p className="ior-public__meta">
            {response.institution || response.organization || "Institution not named"} · Received{" "}
            {response.receivedAt}
          </p>
          <p>{response.summary}</p>
          {response.documentIds.length > 0 || response.links.length > 0 ? (
            <p className="ior-public__meta">
              {response.documentIds.length} document(s) · {response.links.length} link(s)
            </p>
          ) : null}
        </div>
      ))}
    </article>
  );
}
