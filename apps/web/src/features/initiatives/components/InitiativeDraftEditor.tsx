"use client";

import { INITIATIVE_LIFECYCLE_PHASE_LABELS } from "../initiative-lifecycle-labels";
import type { Initiative } from "@hu/types";
import { useEffect, useState } from "react";

import { uploadInitiativeImage } from "../../media-upload/media-upload-api";
import {
  archiveInitiative,
  publishInitiative,
  saveInitiativeDraft,
  type SaveInitiativeDraftInput,
} from "../api";

import {
  buildInitiativeFormValuesFromMetadata,
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "./InitiativeFormFields";

import "./initiative-draft-editor.css";

interface InitiativeDraftEditorProps {
  initiative: Initiative;
  onUpdated: (initiative: Initiative) => void;
}

interface DraftFormState {
  title: string;
  description: string;
  fields: InitiativeFormValues;
}

function buildFormState(initiative: Initiative): DraftFormState {
  return {
    title: initiative.title,
    description: initiative.description,
    fields: buildInitiativeFormValuesFromMetadata(initiative.metadata),
  };
}

export function InitiativeDraftEditor({ initiative, onUpdated }: InitiativeDraftEditorProps) {
  const [form, setForm] = useState<DraftFormState>(() => buildFormState(initiative));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(initiative));
    setMessage(null);
  }, [initiative]);

  const isDraft = initiative.lifecyclePhase === "draft";

  function buildSaveInput(): SaveInitiativeDraftInput {
    return {
      title: form.title,
      description: form.description,
      ...initiativeFormValuesToSaveInput(form.fields),
    };
  }

  async function handleSaveDraft() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await saveInitiativeDraft(initiative.initiativeId, buildSaveInput());
      onUpdated(updated);
      setMessage("Draft saved successfully.");
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage("Sign in to create an initiative.");
      } else {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setMessage(`Save failed: ${detail}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);

    try {
      await saveInitiativeDraft(initiative.initiativeId, buildSaveInput());
      const published = await publishInitiative(initiative.initiativeId);
      onUpdated(published);
      setMessage("Initiative published successfully.");
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage("Sign in to create an initiative.");
      } else {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setMessage(`Publish failed: ${detail}`);
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const archived = await archiveInitiative(initiative.initiativeId);
      onUpdated(archived);
      setMessage("Initiative archived.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Archive failed: ${detail}`);
    } finally {
      setArchiving(false);
    }
  }

  if (!isDraft) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">
          Lifecycle phase: {INITIATIVE_LIFECYCLE_PHASE_LABELS[initiative.lifecyclePhase]}
        </p>
        {initiative.lifecyclePhase === "projected" ? (
          <p className="initiative-draft-editor__readonly">
            Public projection is available on the associated community experience page.
          </p>
        ) : null}
      </div>
    );
  }

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
        initiativeId={initiative.initiativeId}
        onChange={(patch) =>
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, ...patch },
          }))
        }
        onImageUpload={async (file) => {
          const uploaded = await uploadInitiativeImage(initiative.initiativeId, file);
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, imageUrl: uploaded.mediaUrl },
          }));
          return uploaded.mediaUrl;
        }}
        onImageRemove={async () => {
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, imageUrl: "", imageAltText: "" },
          }));
        }}
      />

      <p className="initiative-draft-editor__visibility">Visibility: Public</p>

      <div className="initiative-draft-editor__actions">
        <button
          type="button"
          onClick={() => void handleSaveDraft()}
          disabled={saving || publishing || archiving}
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={saving || publishing || archiving}
        >
          {publishing ? "Publishing..." : "Publish Initiative"}
        </button>
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={saving || publishing || archiving}
        >
          {archiving ? "Archiving..." : "Archive"}
        </button>
      </div>

      {message ? <p className="initiative-draft-editor__message">{message}</p> : null}
    </div>
  );
}
