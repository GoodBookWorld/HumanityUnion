"use client";

import { useEffect, useState } from "react";

import type { InitiativeOfficialResponseRecord } from "@hu/types";

import { listPublishedInitiativeOfficialResponses } from "../api";

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
  const [responses, setResponses] = useState<readonly InitiativeOfficialResponseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listPublishedInitiativeOfficialResponses(initiativeId);
        if (!cancelled) {
          setResponses(result);
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

  if (!responses) {
    return <p className="ior-source-panel__empty">Loading published Official Responses…</p>;
  }

  if (responses.length === 0) {
    return <p className="ior-source-panel__empty">No Official Responses published yet.</p>;
  }

  return (
    <article className="ior-public" aria-label="Published Official Responses">
      {isPreview ? <p className="ior-public__meta">Author Preview of published Official Responses</p> : null}
      <section className="ior-public__section">
        <h3>Official Responses</h3>
        <p className="ior-public__meta">{responses.length} Response(s) published</p>
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
          <span className="ior-public__response-status">{response.verificationStatus}</span>
        </div>
      ))}
    </article>
  );
}
