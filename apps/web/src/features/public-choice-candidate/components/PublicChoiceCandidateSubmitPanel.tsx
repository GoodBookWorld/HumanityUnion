"use client";

import { useEffect, useRef, useState } from "react";

import type { PublicChoiceCandidatePublicProjection } from "@hu/types";
import { PUBLIC_CHOICE_MAX_CANDIDATES } from "@hu/types";

import { uploadInitiativeImage } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import {
  createPublicChoiceCandidate,
  deletePublicChoiceCandidate,
  updatePublicChoiceCandidate,
} from "../api";

interface PublicChoiceCandidateSubmitPanelProps {
  initiativeId: string;
  /** Fix 08A — active roster size for "N of 20" helper and limit UX. */
  candidateCount?: number;
  /** When set, form is Edit mode for this candidate. */
  editingCandidate?: PublicChoiceCandidatePublicProjection | null;
  onSubmitted?: () => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

/**
 * Pack 02D / Fix 08A — authenticated Participant candidate create + edit.
 * Hosted on Initiative Overview (`#add-candidate`). Includes photo via media upload.
 */
export function PublicChoiceCandidateSubmitPanel({
  initiativeId,
  candidateCount = 0,
  editingCandidate = null,
  onSubmitted,
  onCancel,
  onDeleted,
}: PublicChoiceCandidateSubmitPanelProps) {
  const isEdit = Boolean(editingCandidate);
  const [name, setName] = useState(editingCandidate?.name ?? "");
  const [campaignPageUrl, setCampaignPageUrl] = useState(
    editingCandidate?.campaignPageUrl ?? "",
  );
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    editingCandidate?.photoUrl ?? null,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(editingCandidate?.name ?? "");
    setCampaignPageUrl(editingCandidate?.campaignPageUrl ?? "");
    setPhotoPreviewUrl(editingCandidate?.photoUrl ?? null);
    setPhotoFile(null);
    setClearExistingPhoto(false);
    setMessage(null);
    setConfirmDelete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [editingCandidate]);

  const atLimit = !isEdit && candidateCount >= PUBLIC_CHOICE_MAX_CANDIDATES;

  async function handleSubmit(): Promise<void> {
    if (!name.trim() || busy || atLimit) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let photoUrl: string | undefined | null;
      if (photoFile) {
        const uploaded = await uploadInitiativeImage(initiativeId, photoFile);
        photoUrl = uploaded.mediaUrl;
      } else if (isEdit && clearExistingPhoto) {
        photoUrl = null;
      }

      if (isEdit && editingCandidate) {
        await updatePublicChoiceCandidate(initiativeId, editingCandidate.candidateId, {
          name: name.trim(),
          campaignPageUrl: campaignPageUrl.trim() ? campaignPageUrl.trim() : null,
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        });
        setMessage("Candidate updated.");
      } else {
        await createPublicChoiceCandidate(initiativeId, {
          name: name.trim(),
          campaignPageUrl: campaignPageUrl.trim() || undefined,
          photoUrl: typeof photoUrl === "string" ? photoUrl : undefined,
        });
        setName("");
        setCampaignPageUrl("");
        setPhotoFile(null);
        setPhotoPreviewUrl(null);
        setClearExistingPhoto(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setMessage("Candidate submitted.");
      }
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save candidate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!editingCandidate || busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await deletePublicChoiceCandidate(initiativeId, editingCandidate.candidateId);
      setConfirmDelete(false);
      onDeleted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete candidate.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="add-candidate"
      className="pie-election-candidate-submit"
      aria-labelledby="pie-add-candidate-title"
    >
      <h2 id="pie-add-candidate-title">{isEdit ? "Edit candidate" : "Add a candidate"}</h2>
      <p className="pie-election-candidate-submit__helper">
        Up to {PUBLIC_CHOICE_MAX_CANDIDATES} candidates can be added to one election.
        {candidateCount > 0 ? (
          <>
            {" "}
            <strong>
              {candidateCount} of {PUBLIC_CHOICE_MAX_CANDIDATES} candidates
            </strong>
          </>
        ) : null}
      </p>
      {atLimit ? (
        <p role="status">This election has reached the maximum of 20 candidates.</p>
      ) : null}
      <label>
        Candidate name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          disabled={busy || atLimit}
          required
        />
      </label>
      <label>
        Candidate photo (optional)
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          disabled={busy || atLimit}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setPhotoFile(file);
            setClearExistingPhoto(false);
            setPhotoPreviewUrl(file ? URL.createObjectURL(file) : editingCandidate?.photoUrl ?? null);
          }}
        />
      </label>
      {photoPreviewUrl && !clearExistingPhoto ? (
        <img
          className="pie-election-candidate-submit__preview"
          src={resolveMediaUrl(photoPreviewUrl) ?? photoPreviewUrl}
          alt=""
          width={72}
          height={72}
        />
      ) : null}
      {isEdit && photoPreviewUrl && !clearExistingPhoto ? (
        <button
          type="button"
          className="pie-election-candidate-submit__cancel"
          disabled={busy}
          onClick={() => {
            setPhotoFile(null);
            setClearExistingPhoto(true);
            setPhotoPreviewUrl(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        >
          Remove photo
        </button>
      ) : null}
      <label>
        Campaign page URL (optional)
        <input
          value={campaignPageUrl}
          onChange={(event) => setCampaignPageUrl(event.target.value)}
          inputMode="url"
          disabled={busy || atLimit}
          placeholder="https://"
        />
      </label>
      <div className="pie-election-candidate-submit__actions">
        <button
          type="button"
          className="hu-button hu-button--primary"
          onClick={() => void handleSubmit()}
          disabled={busy || !name.trim() || atLimit}
        >
          {busy ? (isEdit ? "Saving…" : "Submitting…") : isEdit ? "Save changes" : "Submit candidate"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="pie-election-candidate-submit__cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        ) : null}
        {isEdit ? (
          <button
            type="button"
            className="pie-election-candidate-submit__delete"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            Delete candidate
          </button>
        ) : null}
      </div>
      {confirmDelete ? (
        <div className="pie-election-candidate-submit__confirm" role="alertdialog" aria-labelledby="pc-delete-title">
          <p id="pc-delete-title">
            <strong>Delete candidate?</strong>
          </p>
          <p>This candidate will be removed from the election.</p>
          <div className="pie-election-candidate-submit__actions">
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pie-election-candidate-submit__delete"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {busy ? "Deleting…" : "Delete candidate"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
