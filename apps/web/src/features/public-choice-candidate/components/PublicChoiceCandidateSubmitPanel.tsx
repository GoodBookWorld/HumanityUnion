"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicChoiceCandidatePublicProjection } from "@hu/types";
import { PUBLIC_CHOICE_MAX_CANDIDATES } from "@hu/types";

import { PersonImageUploadField } from "../../media-upload/components/PersonImageUploadField";
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
 * Pack 02D / Fix 08A / Pack 09A — authenticated Participant candidate create + edit.
 * Hosted on Initiative Overview (`#add-candidate`). Photo uses Profile-aligned person image UX.
 */
export function PublicChoiceCandidateSubmitPanel({
  initiativeId,
  candidateCount = 0,
  editingCandidate = null,
  onSubmitted,
  onCancel,
  onDeleted,
}: PublicChoiceCandidateSubmitPanelProps) {
  const t = useTranslations("initiativeExperience");
  const isEdit = Boolean(editingCandidate);
  const [name, setName] = useState(editingCandidate?.name ?? "");
  const [campaignPageUrl, setCampaignPageUrl] = useState(
    editingCandidate?.campaignPageUrl ?? "",
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(editingCandidate?.photoUrl ?? null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(editingCandidate?.name ?? "");
    setCampaignPageUrl(editingCandidate?.campaignPageUrl ?? "");
    setPhotoUrl(editingCandidate?.photoUrl ?? null);
    setPhotoCleared(false);
    setMessage(null);
    setConfirmDelete(false);
  }, [editingCandidate]);

  const atLimit = !isEdit && candidateCount >= PUBLIC_CHOICE_MAX_CANDIDATES;
  const photoPreview = photoCleared ? null : resolveMediaUrl(photoUrl) ?? photoUrl;

  async function handlePhotoUpload(file: File): Promise<string> {
    const uploaded = await uploadInitiativeImage(initiativeId, file);
    setPhotoUrl(uploaded.mediaUrl);
    setPhotoCleared(false);
    return uploaded.mediaUrl;
  }

  async function handlePhotoRemove(): Promise<void> {
    setPhotoUrl(null);
    setPhotoCleared(true);
  }

  async function handleSubmit(): Promise<void> {
    if (!name.trim() || busy || atLimit) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      if (isEdit && editingCandidate) {
        await updatePublicChoiceCandidate(initiativeId, editingCandidate.candidateId, {
          name: name.trim(),
          campaignPageUrl: campaignPageUrl.trim() ? campaignPageUrl.trim() : null,
          ...(photoCleared
            ? { photoUrl: null }
            : photoUrl
              ? { photoUrl }
              : {}),
        });
        setMessage(t("publicChoice.candidateSubmit.updated"));
      } else {
        await createPublicChoiceCandidate(initiativeId, {
          name: name.trim(),
          campaignPageUrl: campaignPageUrl.trim() || undefined,
          photoUrl: photoUrl ?? undefined,
        });
        setName("");
        setCampaignPageUrl("");
        setPhotoUrl(null);
        setPhotoCleared(false);
        setMessage(t("publicChoice.candidateSubmit.submitted"));
      }
      onSubmitted?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("publicChoice.candidateSubmit.saveFailed"),
      );
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
      setMessage(
        error instanceof Error ? error.message : t("publicChoice.candidateSubmit.deleteFailed"),
      );
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
      <h2 id="pie-add-candidate-title">
        {isEdit
          ? t("publicChoice.candidateSubmit.editTitle")
          : t("publicChoice.candidateSubmit.addTitle")}
      </h2>
      <p className="pie-election-candidate-submit__helper">
        {t("publicChoice.candidateSubmit.helper", { max: PUBLIC_CHOICE_MAX_CANDIDATES })}
        {candidateCount > 0 ? (
          <>
            {" "}
            <strong>
              {t("publicChoice.candidateSubmit.helperCount", {
                count: candidateCount,
                max: PUBLIC_CHOICE_MAX_CANDIDATES,
              })}
            </strong>
          </>
        ) : null}
      </p>
      {atLimit ? (
        <p role="status">{t("publicChoice.candidateSubmit.atLimit")}</p>
      ) : null}
      <label>
        {t("publicChoice.candidateSubmit.nameLabel")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          disabled={busy || atLimit}
          required
        />
      </label>
      <div className="pie-election-candidate-submit__photo">
        <PersonImageUploadField
          label={t("publicChoice.candidateSubmit.photoLabel")}
          imageUrl={photoPreview}
          disabled={busy || atLimit}
          variant="person"
          onUpload={handlePhotoUpload}
          onRemove={isEdit || photoUrl ? handlePhotoRemove : undefined}
        />
      </div>
      <label>
        {t("publicChoice.candidateSubmit.campaignUrlLabel")}
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
          {busy
            ? t("publicChoice.candidateSubmit.saving")
            : isEdit
              ? t("publicChoice.candidateSubmit.saveChanges")
              : t("publicChoice.candidateSubmit.submit")}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="hu-button hu-button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t("publicChoice.candidateSubmit.cancel")}
          </button>
        ) : null}
        {isEdit ? (
          <button
            type="button"
            className="pie-election-candidate-submit__delete hu-button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            {t("publicChoice.candidateSubmit.deleteCandidate")}
          </button>
        ) : null}
      </div>
      {confirmDelete ? (
        <div
          className="pie-election-candidate-submit__confirm"
          role="alertdialog"
          aria-labelledby="pc-delete-title"
        >
          <p id="pc-delete-title">
            <strong>{t("publicChoice.candidateSubmit.deleteConfirmTitle")}</strong>
          </p>
          <p>{t("publicChoice.candidateSubmit.deleteConfirmBody")}</p>
          <div className="pie-election-candidate-submit__actions">
            <button
              type="button"
              className="hu-button hu-button--secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              {t("publicChoice.candidateSubmit.cancel")}
            </button>
            <button
              type="button"
              className="pie-election-candidate-submit__delete hu-button"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {busy
                ? t("publicChoice.candidateSubmit.deleting")
                : t("publicChoice.candidateSubmit.deleteCandidate")}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
