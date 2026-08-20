"use client";

import { useRef, useState } from "react";

import { uploadInitiativeImage } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { createPublicChoiceCandidate } from "../api";

interface PublicChoiceCandidateSubmitPanelProps {
  initiativeId: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

/**
 * Pack 02D/03 — authenticated Participant candidate submission.
 * Hosted on Initiative Overview (`#add-candidate`). Includes photo via existing media upload.
 */
export function PublicChoiceCandidateSubmitPanel({
  initiativeId,
  onSubmitted,
  onCancel,
}: PublicChoiceCandidateSubmitPanelProps) {
  const [name, setName] = useState("");
  const [campaignPageUrl, setCampaignPageUrl] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(): Promise<void> {
    if (!name.trim() || busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const uploaded = await uploadInitiativeImage(initiativeId, photoFile);
        photoUrl = uploaded.mediaUrl;
      }

      await createPublicChoiceCandidate(initiativeId, {
        name: name.trim(),
        campaignPageUrl: campaignPageUrl.trim() || undefined,
        photoUrl,
      });
      setName("");
      setCampaignPageUrl("");
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("Candidate submitted.");
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit candidate.");
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
      <h2 id="pie-add-candidate-title">Add a candidate</h2>
      <p>
        Authenticated Participants may propose candidates for this Public Choice election. Visitors
        must register first.
      </p>
      <label>
        Candidate name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          disabled={busy}
          required
        />
      </label>
      <label>
        Candidate photo (optional)
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setPhotoFile(file);
            setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
          }}
        />
      </label>
      {photoPreviewUrl ? (
        <img
          className="pie-election-candidate-submit__preview"
          src={resolveMediaUrl(photoPreviewUrl) ?? photoPreviewUrl}
          alt=""
          width={72}
          height={72}
        />
      ) : null}
      <label>
        Campaign page URL (optional)
        <input
          value={campaignPageUrl}
          onChange={(event) => setCampaignPageUrl(event.target.value)}
          inputMode="url"
          disabled={busy}
          placeholder="https://"
        />
      </label>
      <div className="pie-election-candidate-submit__actions">
        <button type="button" onClick={() => void handleSubmit()} disabled={busy || !name.trim()}>
          {busy ? "Submitting…" : "Submit candidate"}
        </button>
        {onCancel ? (
          <button type="button" className="pie-election-candidate-submit__cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
