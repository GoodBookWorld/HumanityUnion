"use client";

import type { EvidenceKind, Implementation } from "@hu/types";
import { useEffect, useMemo, useState } from "react";

import { attachEvidence } from "../api";
import {
  canAttachEvidence,
  getAchievementsForEvidenceAttachment,
  getEvidenceAttachmentUnavailableReason,
} from "../implementation-utils";

const EVIDENCE_KINDS: EvidenceKind[] = ["Reference", "Attachment", "Link"];

interface EvidenceAttachmentPanelProps {
  implementation: Implementation;
  onImplementationUpdated: (implementation: Implementation) => void;
}

export function EvidenceAttachmentPanel({
  implementation,
  onImplementationUpdated,
}: EvidenceAttachmentPanelProps) {
  const achievements = useMemo(
    () => getAchievementsForEvidenceAttachment(implementation),
    [implementation],
  );
  const [achievementId, setAchievementId] = useState(achievements[0]?.achievementId ?? "");
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("Reference");
  const [label, setLabel] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [referenceType, setReferenceType] = useState("CommunityRecord");
  const [referenceDisplayLabel, setReferenceDisplayLabel] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [attachmentDisplayLabel, setAttachmentDisplayLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDisplayLabel, setLinkDisplayLabel] = useState("");
  const [linkKind, setLinkKind] = useState("Public");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const attachmentAvailable = canAttachEvidence(implementation);
  const unavailableReason = getEvidenceAttachmentUnavailableReason(implementation);
  const selectedAchievement =
    achievements.find((achievement) => achievement.achievementId === achievementId) ??
    achievements[0] ??
    null;

  useEffect(() => {
    if (achievements.length === 0) {
      setAchievementId("");
      return;
    }

    if (!achievements.some((achievement) => achievement.achievementId === achievementId)) {
      setAchievementId(achievements[0]!.achievementId);
    }
  }, [achievementId, achievements]);

  async function handleAttach() {
    if (!attachmentAvailable || !selectedAchievement) {
      return;
    }

    if (!label.trim()) {
      setErrorMessage("Evidence label is required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const evidenceId = `evidence-${implementation.implementationId}-${Date.now()}`;
      const payload = {
        evidenceId,
        evidenceKind,
        label: label.trim(),
        reference:
          evidenceKind === "Reference"
            ? {
                referenceId: referenceId.trim(),
                referenceType: referenceType.trim(),
                displayLabel: referenceDisplayLabel.trim() || label.trim(),
              }
            : null,
        attachment:
          evidenceKind === "Attachment"
            ? {
                attachmentId: attachmentId.trim(),
                mediaType: mediaType.trim(),
                displayLabel: attachmentDisplayLabel.trim() || label.trim(),
                storageReference: null,
              }
            : null,
        link:
          evidenceKind === "Link"
            ? {
                url: linkUrl.trim(),
                displayLabel: linkDisplayLabel.trim() || label.trim(),
                linkKind: linkKind.trim(),
              }
            : null,
      };

      if (evidenceKind === "Reference") {
        if (!payload.reference?.referenceId || !payload.reference.referenceType) {
          setErrorMessage("Reference evidence requires reference ID and type.");
          setSubmitting(false);
          return;
        }
      }

      if (evidenceKind === "Attachment") {
        if (!payload.attachment?.attachmentId || !payload.attachment.mediaType) {
          setErrorMessage("Attachment evidence requires attachment ID and media type.");
          setSubmitting(false);
          return;
        }
      }

      if (evidenceKind === "Link") {
        if (!payload.link?.url || !payload.link.linkKind) {
          setErrorMessage("Link evidence requires URL and link kind.");
          setSubmitting(false);
          return;
        }
      }

      const updated = await attachEvidence(
        implementation.implementationId,
        selectedAchievement.achievementId,
        payload,
      );

      onImplementationUpdated(updated);
      setLabel("");
      setReferenceId("");
      setReferenceDisplayLabel("");
      setAttachmentId("");
      setMediaType("");
      setAttachmentDisplayLabel("");
      setLinkUrl("");
      setLinkDisplayLabel("");
      setSuccessMessage(
        "Supporting evidence attached. Evidence supports transparency — it does not establish objective truth.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="implementation-evidence-attachment">
      <p className="implementation-section__intro">
        Evidence Attachment Panel — the canonical surface for attaching supporting material to a
        recorded achievement. Evidence substantiates accomplishment — it does not replace
        achievement recording.
      </p>

      {!attachmentAvailable && unavailableReason ? (
        <p className="implementation-section__empty">{unavailableReason}</p>
      ) : null}

      {attachmentAvailable && selectedAchievement ? (
        <div className="implementation-recording-panel">
          <div className="implementation-recording__field">
            <label htmlFor="evidence-achievement">Recorded Achievement</label>
            <select
              id="evidence-achievement"
              value={selectedAchievement.achievementId}
              onChange={(event) => setAchievementId(event.target.value)}
            >
              {achievements.map((achievement) => (
                <option key={achievement.achievementId} value={achievement.achievementId}>
                  {achievement.title}
                </option>
              ))}
            </select>
          </div>

          <div className="implementation-recording__field">
            <label htmlFor="evidence-kind">Evidence Kind</label>
            <select
              id="evidence-kind"
              value={evidenceKind}
              onChange={(event) => setEvidenceKind(event.target.value as EvidenceKind)}
            >
              {EVIDENCE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          <div className="implementation-recording__field">
            <label htmlFor="evidence-label">Evidence Label</label>
            <input
              id="evidence-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Community soil assessment reference"
            />
          </div>

          {evidenceKind === "Reference" ? (
            <>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-reference-id">Reference ID</label>
                <input
                  id="evidence-reference-id"
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                  placeholder="e.g. soil-assessment-ref-001"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-reference-type">Reference Type</label>
                <input
                  id="evidence-reference-type"
                  value={referenceType}
                  onChange={(event) => setReferenceType(event.target.value)}
                  placeholder="e.g. CommunityRecord"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-reference-label">Reference Display Label</label>
                <input
                  id="evidence-reference-label"
                  value={referenceDisplayLabel}
                  onChange={(event) => setReferenceDisplayLabel(event.target.value)}
                  placeholder="e.g. Shared soil assessment summary"
                />
              </div>
            </>
          ) : null}

          {evidenceKind === "Attachment" ? (
            <>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-attachment-id">Attachment ID</label>
                <input
                  id="evidence-attachment-id"
                  value={attachmentId}
                  onChange={(event) => setAttachmentId(event.target.value)}
                  placeholder="e.g. photo-garden-site-001"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-media-type">Media Type</label>
                <input
                  id="evidence-media-type"
                  value={mediaType}
                  onChange={(event) => setMediaType(event.target.value)}
                  placeholder="e.g. image/jpeg"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-attachment-label">Attachment Display Label</label>
                <input
                  id="evidence-attachment-label"
                  value={attachmentDisplayLabel}
                  onChange={(event) => setAttachmentDisplayLabel(event.target.value)}
                  placeholder="e.g. Prepared garden site photograph"
                />
              </div>
            </>
          ) : null}

          {evidenceKind === "Link" ? (
            <>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-link-url">Link URL</label>
                <input
                  id="evidence-link-url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://example.org/public-report"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-link-kind">Link Kind</label>
                <input
                  id="evidence-link-kind"
                  value={linkKind}
                  onChange={(event) => setLinkKind(event.target.value)}
                  placeholder="e.g. Public"
                />
              </div>
              <div className="implementation-recording__field">
                <label htmlFor="evidence-link-label">Link Display Label</label>
                <input
                  id="evidence-link-label"
                  value={linkDisplayLabel}
                  onChange={(event) => setLinkDisplayLabel(event.target.value)}
                  placeholder="e.g. Neighborhood meeting notes"
                />
              </div>
            </>
          ) : null}

          <button
            type="button"
            className="implementation-recording__button"
            disabled={submitting}
            onClick={() => void handleAttach()}
          >
            {submitting ? "Attaching..." : "Attach Evidence"}
          </button>
        </div>
      ) : null}

      {successMessage ? <p className="implementation-section__note">{successMessage}</p> : null}

      {errorMessage ? <p className="implementation-section__error">{errorMessage}</p> : null}

      <p className="implementation-section__note">
        Evidence supports transparency. It does not establish objective truth or replace derived
        progress and completion values.
      </p>
    </div>
  );
}
