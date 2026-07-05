"use client";

import type {
  CivicCompatibilityReview,
  CivicCompatibilityReviewComparison,
  Initiative,
} from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import {
  compareInitiativeCompatibilityReviews,
  listInitiativeCompatibilityReviews,
  runInitiativeCompatibilityReview,
} from "../api";

import "./civic-compatibility-review-workspace.css";

interface CivicCompatibilityReviewWorkspaceProps {
  initiative: Initiative;
}

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

function formatStatus(status: CivicCompatibilityReview["compatibilityStatus"]): string {
  return status.replace(/_/g, " ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CivicCompatibilityReviewWorkspace({
  initiative,
}: CivicCompatibilityReviewWorkspaceProps) {
  const [reviews, setReviews] = useState<CivicCompatibilityReview[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CivicCompatibilityReviewComparison | null>(null);
  const [compareWithId, setCompareWithId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedReview = reviews.find((review) => review.reviewId === selectedReviewId) ?? null;
  const latestReview = reviews[0] ?? null;
  const canRunReview = ["published", "projected", "archived"].includes(initiative.lifecyclePhase);

  const loadReviews = useCallback(async () => {
    if (!isSteward(initiative) || !canRunReview) {
      setReviews([]);
      return;
    }

    setLoading(true);

    try {
      const items = await listInitiativeCompatibilityReviews(initiative.initiativeId);
      setReviews(items);
      setSelectedReviewId(items[0]?.reviewId ?? null);
    } catch {
      setReviews([]);
      setSelectedReviewId(null);
    } finally {
      setLoading(false);
    }
  }, [canRunReview, initiative]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function handleRunReview() {
    setRunning(true);
    setMessage(null);
    setComparison(null);

    try {
      const review = await runInitiativeCompatibilityReview(initiative.initiativeId);
      setReviews((current) => [review, ...current]);
      setSelectedReviewId(review.reviewId);
      setMessage(
        "Civic compatibility review generated. Publication is never blocked by this advisory review.",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Review failed: ${detail}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleCompare() {
    if (!selectedReview || !compareWithId) {
      return;
    }

    setComparing(true);
    setMessage(null);

    try {
      const result = await compareInitiativeCompatibilityReviews(
        compareWithId,
        selectedReview.reviewId,
      );
      setComparison(result);
      setMessage("Review comparison loaded.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Comparison failed: ${detail}`);
    } finally {
      setComparing(false);
    }
  }

  if (!isSteward(initiative)) {
    return null;
  }

  if (!canRunReview) {
    return (
      <p className="civic-compatibility-review-workspace__note">
        Civic compatibility reviews become available after the initiative is published.
      </p>
    );
  }

  return (
    <div className="civic-compatibility-review-workspace">
      <p className="civic-compatibility-review-workspace__note">
        Run an advisory civic compatibility review against Humanity Union principles and human
        rights frameworks. This intelligent civic assistant never blocks publication automatically.
      </p>

      {latestReview && latestReview.compatibilityStatus !== "compatible" ? (
        <p className="civic-compatibility-review-workspace__notice" role="status">
          ⚠ Civic Compatibility Review Available
        </p>
      ) : null}

      <div className="civic-compatibility-review-workspace__actions">
        <button type="button" onClick={() => void handleRunReview()} disabled={running}>
          {running ? "Running Review..." : "Run Review"}
        </button>
      </div>

      {loading ? (
        <p className="civic-compatibility-review-workspace__empty">Loading reviews...</p>
      ) : null}

      {!loading && reviews.length === 0 ? (
        <p className="civic-compatibility-review-workspace__empty">
          No compatibility reviews yet. Run a review to receive structured recommendations.
        </p>
      ) : null}

      {reviews.length > 0 ? (
        <ul className="civic-compatibility-review-workspace__reviews">
          {reviews.map((review) => (
            <li key={review.reviewId}>
              <button
                type="button"
                className={
                  selectedReviewId === review.reviewId
                    ? "civic-compatibility-review-workspace__review-button civic-compatibility-review-workspace__review-button--active"
                    : "civic-compatibility-review-workspace__review-button"
                }
                onClick={() => {
                  setSelectedReviewId(review.reviewId);
                  setComparison(null);
                }}
              >
                Version {review.initiativeVersion} · Review {review.reviewVersion} ·{" "}
                {formatStatus(review.compatibilityStatus)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedReview ? (
        <div className="civic-compatibility-review-workspace__detail">
          <h3>Compatibility Summary</h3>
          <p>{selectedReview.compatibilitySummary}</p>
          <p>
            <strong>Status:</strong> {formatStatus(selectedReview.compatibilityStatus)}
          </p>
          <p>
            <strong>Generated:</strong> {formatDate(selectedReview.generatedAt)}
          </p>
          <p>
            <strong>Human Rights Assessment:</strong> {selectedReview.humanRightsAssessment}
          </p>
          <p>
            <strong>Humanity Union Assessment:</strong> {selectedReview.humanityUnionAssessment}
          </p>

          {selectedReview.positiveAlignment.length > 0 ? (
            <>
              <h4>Positive Alignment</h4>
              <ul>
                {selectedReview.positiveAlignment.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {selectedReview.detectedConcerns.length > 0 ? (
            <>
              <h4>Potential Concerns</h4>
              <ul>
                {selectedReview.detectedConcerns.map((concern) => (
                  <li key={concern.concernId}>
                    <strong>{concern.summary}</strong>
                    <p>{concern.explanation}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {selectedReview.recommendations.length > 0 ? (
            <>
              <h4>Recommendations</h4>
              <ul>
                {selectedReview.recommendations.map((recommendation) => (
                  <li key={recommendation.recommendationId}>
                    <strong>{recommendation.summary}</strong>
                    <p>{recommendation.explanation}</p>
                    <p>{recommendation.suggestedImprovement}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {selectedReview.referencedPrinciples.length > 0 ? (
            <>
              <h4>Referenced Principles</h4>
              <ul>
                {selectedReview.referencedPrinciples.map((principle) => (
                  <li key={principle.frameworkId}>
                    {principle.referenceCode}: {principle.title}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {selectedReview.referencedHumanRightsArticles.length > 0 ? (
            <>
              <h4>Referenced Human Rights Articles</h4>
              <ul>
                {selectedReview.referencedHumanRightsArticles.map((article) => (
                  <li key={article.frameworkId}>
                    {article.referenceCode}: {article.title}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="civic-compatibility-review-workspace__compare">
            <label>
              Compare with
              <select
                value={compareWithId}
                onChange={(event) => setCompareWithId(event.target.value)}
              >
                <option value="">Select earlier review</option>
                {reviews
                  .filter((review) => review.reviewId !== selectedReview.reviewId)
                  .map((review) => (
                    <option key={review.reviewId} value={review.reviewId}>
                      Version {review.initiativeVersion} · Review {review.reviewVersion}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleCompare()}
              disabled={comparing || !compareWithId}
            >
              {comparing ? "Comparing..." : "Compare Reviews"}
            </button>
          </div>

          {comparison ? (
            <div className="civic-compatibility-review-workspace__comparison">
              <h4>Comparison</h4>
              <p>
                Initiative version changed: {comparison.initiativeVersionChanged ? "Yes" : "No"}
              </p>
              <p>
                Compatibility status changed: {comparison.compatibilityStatusChanged ? "Yes" : "No"}
              </p>
              <p>Added concerns: {comparison.addedConcerns.length}</p>
              <p>Resolved concerns: {comparison.resolvedConcerns.length}</p>
              <p>Added recommendations: {comparison.addedRecommendations.length}</p>
              <p>Resolved recommendations: {comparison.resolvedRecommendations.length}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="civic-compatibility-review-workspace__message">{message}</p> : null}
    </div>
  );
}
