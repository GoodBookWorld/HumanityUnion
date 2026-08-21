"use client";

import type { Initiative } from "@hu/types";
import { useEffect, useState } from "react";

import { submitInitiativeVideoLink, uploadInitiativeImage } from "../../media-upload/media-upload-api";
import {
  archiveInitiative,
  closePublicChoiceElection,
  republishInitiative,
  updatePublishedInitiative,
  type SaveInitiativeDraftInput,
} from "../api";

import {
  buildInitiativeFormValuesFromMetadata,
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "./InitiativeFormFields";

import "./initiative-draft-editor.css";

interface InitiativePublishedEditorProps {
  initiative: Initiative;
  onUpdated: (initiative: Initiative) => void;
}

interface PublishedFormState {
  title: string;
  description: string;
  fields: InitiativeFormValues;
}

function buildFormState(initiative: Initiative): PublishedFormState {
  return {
    title: initiative.title,
    description: initiative.description,
    fields: buildInitiativeFormValuesFromMetadata(initiative.metadata),
  };
}

export function InitiativePublishedEditor({
  initiative,
  onUpdated,
}: InitiativePublishedEditorProps) {
  const [form, setForm] = useState<PublishedFormState>(() => buildFormState(initiative));
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [closingElection, setClosingElection] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(initiative));
    setMessage(null);
  }, [initiative]);

  const isArchived = initiative.lifecyclePhase === "archived";
  const isPublicChoice = initiative.lifecycleProfile === "PUBLIC_CHOICE";

  function buildInput(): SaveInitiativeDraftInput {
    return {
      title: form.title,
      description: form.description,
      ...initiativeFormValuesToSaveInput(form.fields, {
        isPublicChoice,
      }),
    };
  }

  async function handleUpdate() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await updatePublishedInitiative(initiative.initiativeId, buildInput());
      onUpdated(updated);
      setMessage("Initiative updated.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Update failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRepublish() {
    setRepublishing(true);
    setMessage(null);

    try {
      const republished = await republishInitiative(initiative.initiativeId, buildInput());
      onUpdated(republished);
      setMessage("Initiative republished. Public projection refreshed.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Republish failed: ${detail}`);
    } finally {
      setRepublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const archived = await archiveInitiative(initiative.initiativeId);
      onUpdated(archived);
      setMessage("Initiative archived. Public projection removed.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Archive failed: ${detail}`);
    } finally {
      setArchiving(false);
    }
  }

  async function handleCloseElection() {
    setClosingElection(true);
    setMessage(null);
    try {
      await closePublicChoiceElection(initiative.initiativeId);
      setConfirmClose(false);
      setMessage("Election closed. Voting stopped; Final Results are available for 72 hours.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Close election failed: ${detail}`);
    } finally {
      setClosingElection(false);
    }
  }

  if (isArchived) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">
          This initiative is archived and no longer appears in Public Experience.
        </p>
      </div>
    );
  }

  const busy = saving || republishing || archiving || closingElection;

  return (
    <div className="initiative-draft-editor">
      <label className="initiative-draft-editor__field">
        <span>Title</span>
        <input
          type="text"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <label className="initiative-draft-editor__field">
        <span>Short description</span>
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          rows={4}
        />
      </label>

      <InitiativeFormFields
        values={form.fields}
        lifecycleProfile={initiative.lifecycleProfile}
        initiativeId={initiative.initiativeId}
        onChange={(patch) =>
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, ...patch },
          }))
        }
        onImageUpload={async (file) => {
          const uploaded = await uploadInitiativeImage(initiative.initiativeId, file);
          return uploaded.mediaUrl;
        }}
        onVideoLinkSubmit={(url) => submitInitiativeVideoLink(initiative.initiativeId, url)}
      />

      <div className="initiative-draft-editor__actions">
        <button type="button" onClick={() => void handleUpdate()} disabled={busy}>
          {saving ? "Updating..." : "Update"}
        </button>
        <button type="button" onClick={() => void handleRepublish()} disabled={busy}>
          {republishing ? "Republishing..." : "Republish"}
        </button>
        {isPublicChoice ? (
          <button type="button" onClick={() => setConfirmClose(true)} disabled={busy}>
            {closingElection ? "Closing…" : "Close election"}
          </button>
        ) : (
          <button type="button" onClick={() => void handleArchive()} disabled={busy}>
            {archiving ? "Archiving..." : "Archive"}
          </button>
        )}
      </div>

      {confirmClose ? (
        <div
          className="initiative-draft-editor__confirm"
          role="dialog"
          aria-labelledby="close-election-title"
        >
          <h3 id="close-election-title">Close election?</h3>
          <p>
            This will stop voting and finalize the current results. Temporary election results will
            remain available for 72 hours.
          </p>
          <div className="initiative-draft-editor__actions">
            <button type="button" onClick={() => setConfirmClose(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleCloseElection()} disabled={busy}>
              {closingElection ? "Closing…" : "Close election"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="initiative-draft-editor__message">{message}</p> : null}
    </div>
  );
}
