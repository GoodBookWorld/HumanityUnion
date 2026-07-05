"use client";

import type { CollectiveDecision, DecisionOption } from "@hu/types";
import { useMemo, useState } from "react";

import { submitParticipantDecision } from "../api";

import "./decision-panel.css";

const BOOTSTRAP_PARTICIPANT_ID = "member-bootstrap-001";

interface DecisionPanelProps {
  decision: CollectiveDecision;
  onDecisionSubmitted: (decision: CollectiveDecision) => void;
}

function findSubmittedDecision(decision: CollectiveDecision) {
  return decision.participantDecisions.find(
    (entry) => entry.participantId === BOOTSTRAP_PARTICIPANT_ID && entry.status === "submitted",
  );
}

export function DecisionPanel({ decision, onDecisionSubmitted }: DecisionPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submittedDecision = useMemo(() => findSubmittedDecision(decision), [decision]);

  const isReadOnly = submittedDecision !== undefined || decision.status !== "Active" || submitting;

  async function handleSubmit(option: DecisionOption) {
    setSubmitting(true);
    setMessage(null);

    try {
      const updated = await submitParticipantDecision(decision.decisionId, {
        participantDecisionId: `participant-decision-${Date.now()}`,
        participantId: BOOTSTRAP_PARTICIPANT_ID,
        ballotId: decision.ballot.ballotId,
        selectedOptionIds: [option.optionId],
        submittedAt: new Date().toISOString(),
        status: "submitted",
      });
      onDecisionSubmitted(updated);
      setMessage(`Your decision (${option.label}) was submitted.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Submission failed: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedDecision) {
    const selectedOption = decision.ballot.options.find((option) =>
      submittedDecision.selectedOptionIds.includes(option.optionId),
    );

    return (
      <div className="decision-panel decision-panel--submitted">
        <p className="decision-panel__status">Decision Submitted</p>
        <p className="decision-panel__choice">
          Selected option: {selectedOption?.label ?? "Unknown"}
        </p>
      </div>
    );
  }

  if (decision.status !== "Active") {
    return (
      <p className="decision-panel__inactive">
        The decision panel opens when the Collective Decision becomes Active.
      </p>
    );
  }

  return (
    <div className="decision-panel">
      <p className="decision-panel__prompt">Select your decision.</p>
      <div className="decision-panel__actions">
        {decision.ballot.options.map((option) => (
          <button
            key={option.optionId}
            type="button"
            className="decision-panel__button"
            disabled={isReadOnly}
            onClick={() => void handleSubmit(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {message ? <p className="decision-panel__message">{message}</p> : null}
    </div>
  );
}
