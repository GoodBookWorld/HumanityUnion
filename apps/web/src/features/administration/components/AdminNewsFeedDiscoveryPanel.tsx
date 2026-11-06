"use client";

import type {
  NewsFeedDiscoveryCandidate,
  NewsFeedDiscoveryResult,
  NewsFeedSectionMatch,
} from "@hu/types";

import { Button } from "../../../design-system/components/Button";

export type NewsFeedDiscoveryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: NewsFeedDiscoveryResult };

export interface NewsFeedConfirmOptions {
  replaceWorkingFeed: boolean;
  acceptSectionMismatch: boolean;
}

/** Candidates to show: the recommended feed first, then the others as ranked by the API. */
export function orderDiscoveryCandidates(
  result: NewsFeedDiscoveryResult,
): NewsFeedDiscoveryCandidate[] {
  return [...result.candidates].sort(
    (left, right) => Number(right.recommended) - Number(left.recommended),
  );
}

/**
 * True when using `candidate` would replace a saved RSS URL that still works; the
 * Admin must then confirm the replacement explicitly.
 */
export function replacesWorkingFeed(
  result: NewsFeedDiscoveryResult,
  candidate: NewsFeedDiscoveryCandidate,
): boolean {
  return Boolean(result.current?.valid && result.current.feedUrl !== candidate.feedUrl);
}

/**
 * True when discovery used a news section and `candidate` is not confirmed as
 * specific to it; using it requires accepting that unrelated news may appear.
 */
export function needsSectionMismatchWarning(
  result: NewsFeedDiscoveryResult,
  candidate: NewsFeedDiscoveryCandidate,
): boolean {
  return Boolean(result.newsSectionUrl && candidate.sectionMatch !== "section_match");
}

export const SECTION_MATCH_LABELS: Record<NewsFeedSectionMatch, string> = {
  section_match: "Section match",
  uncertain: "Uncertain section match",
  general_feed: "General feed",
};

export const SECTION_MISMATCH_WARNING =
  "This feed is not confirmed as specific to the news section. Unrelated news may appear.";

export function describeDiscoveryCandidate(candidate: NewsFeedDiscoveryCandidate): string {
  if (candidate.valid) {
    const latest = candidate.latestPublishedAt
      ? new Date(candidate.latestPublishedAt).toISOString().slice(0, 16).replace("T", " ")
      : "unknown";
    return `Valid · ${candidate.sampleArticleCount} articles · latest ${latest} UTC`;
  }
  const status = candidate.httpStatus ? ` (HTTP ${candidate.httpStatus})` : "";
  return `${candidate.message ?? "Not usable."}${status}`;
}

interface AdminNewsFeedDiscoveryPanelProps {
  heading: string;
  state: NewsFeedDiscoveryState;
  confirming: boolean;
  onConfirm: (candidate: NewsFeedDiscoveryCandidate, options: NewsFeedConfirmOptions) => void;
  onCancel: () => void;
}

function CandidateRow({
  candidate,
  result,
  confirming,
  onConfirm,
}: {
  candidate: NewsFeedDiscoveryCandidate;
  result: NewsFeedDiscoveryResult;
  confirming: boolean;
  onConfirm: AdminNewsFeedDiscoveryPanelProps["onConfirm"];
}) {
  const replacing = replacesWorkingFeed(result, candidate);
  const sectionWarning = candidate.valid && needsSectionMismatchWarning(result, candidate);
  const isCurrent = result.current?.feedUrl === candidate.feedUrl;
  return (
    <li
      className={`admin-feed-discovery__candidate${
        candidate.valid ? "" : " admin-feed-discovery__candidate--invalid"
      }`}
    >
      <p className="admin-feed-discovery__title">
        {candidate.title ?? candidate.feedHost}
        {candidate.recommended ? (
          <span className="admin-feed-discovery__badge">Recommended</span>
        ) : null}
        {isCurrent ? <span className="admin-feed-discovery__badge">Current</span> : null}
        {candidate.sectionMatch ? (
          <span
            className={`admin-feed-discovery__badge admin-feed-discovery__badge--${candidate.sectionMatch}`}
          >
            {SECTION_MATCH_LABELS[candidate.sectionMatch]}
          </span>
        ) : null}
      </p>
      <p className="admin-feed-discovery__url">
        <code>{candidate.feedUrl}</code>
      </p>
      <p className="admin-feed-discovery__meta">
        {candidate.format ? `${candidate.format.toUpperCase()} · ` : ""}
        {candidate.feedHost} · {describeDiscoveryCandidate(candidate)}
      </p>
      {candidate.sectionEvidence.length > 0 ? (
        <ul className="admin-feed-discovery__evidence">
          {candidate.sectionEvidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {candidate.valid && !isCurrent ? (
        <div className="admin-feed-discovery__candidate-actions">
          {sectionWarning ? (
            <p className="admin-feed-discovery__warning" role="note">
              {SECTION_MISMATCH_WARNING}
            </p>
          ) : null}
          {replacing ? (
            <p className="admin-feed-discovery__warning" role="note">
              The current RSS feed is working. Using this feed replaces it.
            </p>
          ) : null}
          <Button
            type="button"
            variant={candidate.recommended && !sectionWarning ? "primary" : "secondary"}
            disabled={confirming}
            onClick={() =>
              onConfirm(candidate, {
                replaceWorkingFeed: replacing,
                acceptSectionMismatch: sectionWarning,
              })
            }
          >
            {confirming ? "Saving…" : replacing ? "Replace working RSS" : "Use this RSS"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function AdminNewsFeedDiscoveryPanel({
  heading,
  state,
  confirming,
  onConfirm,
  onCancel,
}: AdminNewsFeedDiscoveryPanelProps) {
  return (
    <section
      className="admin-feed-discovery"
      aria-label={heading}
      aria-busy={state.status === "loading"}
    >
      <h4 className="admin-feed-discovery__heading">{heading}</h4>
      {state.status === "loading" ? (
        <p className="hu-body" role="status">
          Looking for the RSS or Atom feed this page advertises…
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="admin-feed-discovery__error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "done" ? (
        <>
          <p className="admin-feed-discovery__meta">
            {state.result.newsSectionUrl ? "Checked news section page: " : "Checked website: "}
            <code>{state.result.discoveryPageUrl}</code>
          </p>
          <p
            className={`admin-feed-discovery__status admin-feed-discovery__status--${state.result.status}`}
            role="status"
          >
            {state.result.message}
          </p>
          {state.result.current ? (
            <p className="admin-feed-discovery__meta">
              Saved RSS URL: <code>{state.result.current.feedUrl}</code> —{" "}
              {state.result.current.valid
                ? `working (${describeDiscoveryCandidate(state.result.current)})`
                : `not working: ${describeDiscoveryCandidate(state.result.current)}`}
            </p>
          ) : null}
          {state.result.candidates.length > 0 ? (
            <ul className="admin-feed-discovery__candidates">
              {orderDiscoveryCandidates(state.result).map((candidate) => (
                <CandidateRow
                  key={candidate.feedUrl}
                  candidate={candidate}
                  result={state.result}
                  confirming={confirming}
                  onConfirm={onConfirm}
                />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <div className="admin-feed-discovery__actions">
        <Button type="button" variant="secondary" disabled={confirming} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
