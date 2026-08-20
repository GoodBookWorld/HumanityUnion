"use client";

import { useCallback, useEffect, useState } from "react";

import type { PublicChoiceCandidatePublicProjection } from "@hu/types";

import { uploadInitiativeImage } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import {
  createPublicChoiceCandidate,
  deletePublicChoiceCandidate,
  listPublicChoiceCandidates,
  updatePublicChoiceCandidate,
} from "../../public-choice-candidate/api";

interface PublicChoiceCandidateManagerProps {
  initiativeId: string;
}

/**
 * Pack 02A — Author candidate management for SELECT_ONE_CANDIDATE ballots.
 * Reuses initiative image upload for candidate photos.
 */
export function PublicChoiceCandidateManager({ initiativeId }: PublicChoiceCandidateManagerProps) {
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [campaignPageUrl, setCampaignPageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCampaignPageUrl, setEditCampaignPageUrl] = useState("");

  const reload = useCallback(async () => {
    setLoadState("loading");
    try {
      const listed = await listPublicChoiceCandidates(initiativeId);
      setCandidates(listed);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd() {
    if (!name.trim() || busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await createPublicChoiceCandidate(initiativeId, {
        name: name.trim(),
        campaignPageUrl: campaignPageUrl.trim() || undefined,
      });
      setName("");
      setCampaignPageUrl("");
      await reload();
      setMessage("Candidate added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add candidate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(candidateId: string) {
    if (!editName.trim() || busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await updatePublicChoiceCandidate(initiativeId, candidateId, {
        name: editName.trim(),
        campaignPageUrl: editCampaignPageUrl.trim() ? editCampaignPageUrl.trim() : null,
      });
      setEditingId(null);
      await reload();
      setMessage("Candidate updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update candidate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(candidateId: string) {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await deletePublicChoiceCandidate(initiativeId, candidateId);
      await reload();
      setMessage("Candidate removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove candidate.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoUpload(candidateId: string, file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadInitiativeImage(initiativeId, file);
      await updatePublicChoiceCandidate(initiativeId, candidateId, {
        photoUrl: uploaded.mediaUrl,
      });
      await reload();
      setMessage("Candidate photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoRemove(candidateId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await updatePublicChoiceCandidate(initiativeId, candidateId, { photoUrl: null });
      await reload();
      setMessage("Candidate photo removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="initiative-form-fields__candidates">
      <legend>Candidates</legend>
      <p className="initiative-form-fields__helper">
        Add the people or options voters can choose. Photo uses the Initiative media upload; Campaign
        page must be an http(s) URL.
      </p>

      {loadState === "loading" ? <p role="status">Loading candidates…</p> : null}
      {loadState === "error" ? (
        <p role="alert">Candidates could not be loaded. Save the draft first, then try again.</p>
      ) : null}

      {candidates.length > 0 ? (
        <ul className="initiative-form-fields__candidate-list">
          {candidates.map((candidate) => {
            const photo = resolveMediaUrl(candidate.photoUrl);
            const isEditing = editingId === candidate.candidateId;

            return (
              <li key={candidate.candidateId} className="initiative-form-fields__candidate-item">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="initiative-form-fields__candidate-photo"
                    width={48}
                    height={48}
                  />
                ) : (
                  <span className="initiative-form-fields__candidate-photo-placeholder" aria-hidden>
                    —
                  </span>
                )}

                {isEditing ? (
                  <div className="initiative-form-fields__candidate-edit">
                    <input
                      type="text"
                      className="hu-form-control"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      aria-label="Candidate name"
                    />
                    <input
                      type="url"
                      className="hu-form-control"
                      value={editCampaignPageUrl}
                      onChange={(event) => setEditCampaignPageUrl(event.target.value)}
                      placeholder="https://campaign.example"
                      aria-label="Campaign page URL"
                    />
                    <div className="initiative-form-fields__candidate-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveEdit(candidate.candidateId)}
                      >
                        Save
                      </button>
                      <button type="button" disabled={busy} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="initiative-form-fields__candidate-body">
                    <strong>{candidate.name}</strong>
                    {candidate.campaignPageUrl ? (
                      <a
                        href={candidate.campaignPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Campaign page
                      </a>
                    ) : null}
                    <div className="initiative-form-fields__candidate-actions">
                      <label className="initiative-form-fields__photo-upload">
                        <span>{photo ? "Change photo" : "Add photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handlePhotoUpload(candidate.candidateId, file);
                            }
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {photo ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePhotoRemove(candidate.candidateId)}
                        >
                          Remove photo
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(candidate.candidateId);
                          setEditName(candidate.name);
                          setEditCampaignPageUrl(candidate.campaignPageUrl ?? "");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemove(candidate.candidateId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : loadState === "ready" ? (
        <p role="status">No candidates yet.</p>
      ) : null}

      <div className="initiative-form-fields__candidate-add">
        <label className="initiative-form-fields__field">
          <span>Candidate name</span>
          <input
            type="text"
            className="hu-form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="initiative-form-fields__field">
          <span>Campaign page URL (optional)</span>
          <input
            type="url"
            className="hu-form-control"
            value={campaignPageUrl}
            onChange={(event) => setCampaignPageUrl(event.target.value)}
            placeholder="https://"
          />
        </label>
        <button type="button" disabled={busy || !name.trim()} onClick={() => void handleAdd()}>
          {busy ? "Saving…" : "Add candidate"}
        </button>
      </div>

      {message ? (
        <p className="initiative-form-fields__helper" role="status">
          {message}
        </p>
      ) : null}
    </fieldset>
  );
}
