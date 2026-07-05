"use client";

import type { Initiative } from "@hu/types";
import { useEffect, useState } from "react";

import {
  INITIATIVE_COMMUNITY_OPTIONS,
  archiveInitiative,
  republishInitiative,
  updatePublishedInitiative,
  type SaveInitiativeDraftInput,
} from "../api";

import "./initiative-draft-editor.css";

interface InitiativePublishedEditorProps {
  initiative: Initiative;
  onUpdated: (initiative: Initiative) => void;
}

interface PublishedFormState {
  title: string;
  description: string;
  communitySlug: string;
  activityArea: string;
}

function buildFormState(initiative: Initiative): PublishedFormState {
  return {
    title: initiative.title,
    description: initiative.description,
    communitySlug: initiative.metadata.communitySlug,
    activityArea: initiative.metadata.activityArea,
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(initiative));
    setMessage(null);
  }, [initiative]);

  const isArchived = initiative.lifecyclePhase === "archived";

  function buildInput(): SaveInitiativeDraftInput {
    return {
      title: form.title,
      description: form.description,
      communitySlug: form.communitySlug,
      activityArea: form.activityArea,
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

  if (isArchived) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">
          This initiative is archived and no longer appears in Public Experience.
        </p>
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

      <label className="initiative-draft-editor__field">
        <span>Community association</span>
        <select
          value={form.communitySlug}
          onChange={(event) =>
            setForm((current) => ({ ...current, communitySlug: event.target.value }))
          }
        >
          {INITIATIVE_COMMUNITY_OPTIONS.map((community) => (
            <option key={community.slug} value={community.slug}>
              {community.label}
            </option>
          ))}
        </select>
      </label>

      <label className="initiative-draft-editor__field">
        <span>Activity area</span>
        <input
          type="text"
          value={form.activityArea}
          onChange={(event) =>
            setForm((current) => ({ ...current, activityArea: event.target.value }))
          }
        />
      </label>

      <div className="initiative-draft-editor__actions">
        <button
          type="button"
          onClick={() => void handleUpdate()}
          disabled={saving || republishing || archiving}
        >
          {saving ? "Updating..." : "Update"}
        </button>
        <button
          type="button"
          onClick={() => void handleRepublish()}
          disabled={saving || republishing || archiving}
        >
          {republishing ? "Republishing..." : "Republish"}
        </button>
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={saving || republishing || archiving}
        >
          {archiving ? "Archiving..." : "Archive"}
        </button>
      </div>

      {message ? <p className="initiative-draft-editor__message">{message}</p> : null}
    </div>
  );
}
