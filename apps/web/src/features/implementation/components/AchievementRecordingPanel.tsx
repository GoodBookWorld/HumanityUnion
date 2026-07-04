"use client";

import type { Implementation } from "@hu/types";
import { useEffect, useMemo, useState } from "react";

import { recordAchievement } from "../api";
import {
  BOOTSTRAP_PARTICIPANT_ID,
  canRecordAchievement,
  getAchievementRecordingUnavailableReason,
  getOpenMilestones,
} from "../implementation-utils";

interface AchievementRecordingPanelProps {
  implementation: Implementation;
  onImplementationUpdated: (implementation: Implementation) => void;
}

export function AchievementRecordingPanel({
  implementation,
  onImplementationUpdated,
}: AchievementRecordingPanelProps) {
  const openMilestones = useMemo(
    () => getOpenMilestones(implementation),
    [implementation],
  );
  const [milestoneId, setMilestoneId] = useState(openMilestones[0]?.milestoneId ?? "");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recordingAvailable = canRecordAchievement(implementation);
  const unavailableReason = getAchievementRecordingUnavailableReason(implementation);
  const selectedMilestone =
    openMilestones.find((milestone) => milestone.milestoneId === milestoneId) ??
    openMilestones[0] ??
    null;

  useEffect(() => {
    if (openMilestones.length === 0) {
      setMilestoneId("");
      return;
    }

    if (!openMilestones.some((milestone) => milestone.milestoneId === milestoneId)) {
      setMilestoneId(openMilestones[0]!.milestoneId);
    }
  }, [milestoneId, openMilestones]);

  async function handleRecord() {
    if (!recordingAvailable || !selectedMilestone) {
      return;
    }

    if (!title.trim() || !summary.trim()) {
      setErrorMessage("Achievement title and summary are required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const achievementId = `achievement-${implementation.implementationId}-${Date.now()}`;
      const updated = await recordAchievement(implementation.implementationId, {
        achievementId,
        milestoneId: selectedMilestone.milestoneId,
        title: title.trim(),
        summary: summary.trim(),
        recordedByParticipantId: BOOTSTRAP_PARTICIPANT_ID,
      });

      onImplementationUpdated(updated);
      setTitle("");
      setSummary("");
      setSuccessMessage("Collective achievement recorded. Derived progress will update from this record.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="implementation-achievement-recording">
      <p className="implementation-section__intro">
        Achievement Recording Panel — the canonical surface for recording collective accomplishment.
        Recording describes what the community achieved — not personal task completion.
      </p>

      {!recordingAvailable && unavailableReason ? (
        <p className="implementation-section__empty">{unavailableReason}</p>
      ) : null}

      {recordingAvailable && selectedMilestone ? (
        <div className="implementation-recording-panel">
          <div className="implementation-recording__field">
            <label htmlFor="achievement-milestone">Target Milestone</label>
            <select
              id="achievement-milestone"
              value={selectedMilestone.milestoneId}
              onChange={(event) => setMilestoneId(event.target.value)}
            >
              {openMilestones.map((milestone) => (
                <option key={milestone.milestoneId} value={milestone.milestoneId}>
                  {milestone.title} ({milestone.requirementType})
                </option>
              ))}
            </select>
          </div>

          <div className="implementation-recording__field">
            <label htmlFor="achievement-title">Achievement Title</label>
            <input
              id="achievement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Community site preparation completed collectively"
            />
          </div>

          <div className="implementation-recording__field">
            <label htmlFor="achievement-summary">Achievement Summary</label>
            <textarea
              id="achievement-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Describe the collective accomplishment in civic language."
              rows={4}
            />
          </div>

          <button
            type="button"
            className="implementation-recording__button"
            disabled={submitting}
            onClick={() => void handleRecord()}
          >
            {submitting ? "Recording..." : "Record Achievement"}
          </button>
        </div>
      ) : null}

      {successMessage ? (
        <p className="implementation-section__note">{successMessage}</p>
      ) : null}

      {errorMessage ? <p className="implementation-section__error">{errorMessage}</p> : null}

      <p className="implementation-section__note">
        The platform never records accomplishments on your behalf. Derived progress and completion
        values update automatically — they cannot be edited here.
      </p>
    </div>
  );
}
