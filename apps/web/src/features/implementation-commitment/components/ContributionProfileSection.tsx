"use client";

import type { CommitmentContributionType, ImplementationCommitment } from "@hu/types";
import { useMemo, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";

import { addContributionItem, withdrawContributionItem } from "../api";
import {
  BOOTSTRAP_PARTICIPANT_ID,
  formatCommitmentDate,
  getActiveParticipantItem,
  getParticipantItems,
} from "../commitment-utils";

interface ContributionProfileSectionProps {
  commitment: ImplementationCommitment;
  onCommitmentUpdated: (commitment: ImplementationCommitment) => void;
}

const CONTRIBUTION_TYPES: CommitmentContributionType[] = ["Volunteer", "Professional", "Resource"];

export function ContributionProfileSection({
  commitment,
  onCommitmentUpdated,
}: ContributionProfileSectionProps) {
  const [contributionType, setContributionType] = useState<CommitmentContributionType>("Volunteer");
  const [contributionCapacity, setContributionCapacity] = useState("");
  const [availabilityDescription, setAvailabilityDescription] = useState("");
  const [skillSummary, setSkillSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeItem = useMemo(
    () => getActiveParticipantItem(commitment, BOOTSTRAP_PARTICIPANT_ID),
    [commitment],
  );
  const history = useMemo(
    () => getParticipantItems(commitment, BOOTSTRAP_PARTICIPANT_ID),
    [commitment],
  );
  const profile = commitment.contributionProfiles[BOOTSTRAP_PARTICIPANT_ID];

  async function handleDeclare() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const itemId = `contribution-${commitment.implementationCommitmentId}-${BOOTSTRAP_PARTICIPANT_ID}-${Date.now()}`;
      const updated = await addContributionItem(commitment.implementationCommitmentId, {
        contributionItemId: itemId,
        participantId: BOOTSTRAP_PARTICIPANT_ID,
        contributionType,
        contributionCapacity,
        availability: { description: availabilityDescription },
        profile: skillSummary ? { skillSummary } : undefined,
      });
      onCommitmentUpdated(updated);
      setContributionCapacity("");
      setAvailabilityDescription("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!activeItem) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await withdrawContributionItem(
        commitment.implementationCommitmentId,
        activeItem.contributionItemId,
        BOOTSTRAP_PARTICIPANT_ID,
      );
      onCommitmentUpdated(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="commitment-contribution-profile">
      <p className="commitment-section__intro">
        Contribution Declaration Panel — the canonical surface for recording preparedness.
        Declaration does not assign implementation work.
      </p>

      {profile ? (
        <>
          {profile.skillSummary ? (
            <ProfileField label="Skill Summary" value={profile.skillSummary} />
          ) : null}
          {profile.regionalContext ? (
            <ProfileField label="Regional Context" value={profile.regionalContext} />
          ) : null}
          {profile.organizationalContext ? (
            <ProfileField label="Organizational Context" value={profile.organizationalContext} />
          ) : null}
        </>
      ) : (
        <p className="commitment-section__empty">No Contribution Profile metadata recorded yet.</p>
      )}

      {activeItem ? (
        <div className="commitment-item-history">
          <ProfileField label="Active Item Status" value={activeItem.commitmentStatus} />
          <ProfileField label="Type" value={activeItem.contributionType} />
          <ProfileField label="Capacity" value={activeItem.contributionCapacity} />
          <ProfileField
            label="Availability"
            value={activeItem.availability.description ?? "Not specified"}
          />
          {commitment.status === "Active" ? (
            <button
              type="button"
              className="commitment-declaration__button"
              disabled={submitting}
              onClick={() => void handleWithdraw()}
            >
              {submitting ? "Withdrawing..." : "Withdraw Declaration"}
            </button>
          ) : null}
        </div>
      ) : null}

      {commitment.status === "Active" && !activeItem ? (
        <div className="commitment-declaration-panel">
          <div className="commitment-declaration__field">
            <label htmlFor="contribution-type">Contribution Type</label>
            <select
              id="contribution-type"
              value={contributionType}
              onChange={(event) =>
                setContributionType(event.target.value as CommitmentContributionType)
              }
            >
              {CONTRIBUTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="commitment-declaration__field">
            <label htmlFor="contribution-capacity">Contribution Capacity</label>
            <input
              id="contribution-capacity"
              value={contributionCapacity}
              onChange={(event) => setContributionCapacity(event.target.value)}
              placeholder="e.g. Translator — 4 hours weekly"
            />
          </div>
          <div className="commitment-declaration__field">
            <label htmlFor="availability-description">Availability</label>
            <textarea
              id="availability-description"
              value={availabilityDescription}
              onChange={(event) => setAvailabilityDescription(event.target.value)}
              placeholder="When you may be available to help"
              rows={3}
            />
          </div>
          <div className="commitment-declaration__field">
            <label htmlFor="skill-summary">Skill Summary (optional)</label>
            <input
              id="skill-summary"
              value={skillSummary}
              onChange={(event) => setSkillSummary(event.target.value)}
              placeholder="e.g. Translator, Coordinator"
            />
          </div>
          <button
            type="button"
            className="commitment-declaration__button"
            disabled={submitting || !contributionCapacity.trim() || !availabilityDescription.trim()}
            onClick={() => void handleDeclare()}
          >
            {submitting ? "Recording declaration..." : "Record Contribution Declaration"}
          </button>
        </div>
      ) : null}

      {commitment.status !== "Active" ? (
        <p className="commitment-section__note">
          {commitment.status === "Draft" || commitment.status === "Submitted"
            ? "Contribution declarations become available when the commitment is Active."
            : "This commitment phase no longer accepts new declarations."}
        </p>
      ) : null}

      {history.length > 0 ? (
        <div className="commitment-item-history">
          <h3 className="commitment-policy__group-title">Contribution History</h3>
          <ul className="commitment-policy__list">
            {history.map((item) => (
              <li key={item.contributionItemId}>
                {item.contributionType} — {item.commitmentStatus} —{" "}
                {formatCommitmentDate(item.declaredAt)}
                {item.withdrawnAt ? ` (withdrawn ${formatCommitmentDate(item.withdrawnAt)})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {errorMessage ? <p className="commitment-section__error">{errorMessage}</p> : null}
    </div>
  );
}
