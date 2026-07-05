"use client";

import type { Initiative } from "@hu/types";
import { useState } from "react";

import { createInitiativeDraft, INITIATIVE_COMMUNITY_OPTIONS } from "../api";

import "./start-new-initiative-button.css";

interface StartNewInitiativeButtonProps {
  onCreated: (initiative: Initiative) => void;
}

const DEFAULT_ACTIVITY_AREA = "Environment";

export function StartNewInitiativeButton({ onCreated }: StartNewInitiativeButtonProps) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [communitySlug, setCommunitySlug] = useState<string>(
    INITIATIVE_COMMUNITY_OPTIONS[0]?.slug ?? "",
  );
  const [activityArea, setActivityArea] = useState(DEFAULT_ACTIVITY_AREA);

  async function handleCreate() {
    setCreating(true);
    setMessage(null);

    try {
      const created = await createInitiativeDraft({
        title,
        description,
        communitySlug,
        activityArea,
      });
      onCreated(created);
      setMessage(`Created ${created.title}.`);
      setTitle("");
      setDescription("");
      setCommunitySlug(INITIATIVE_COMMUNITY_OPTIONS[0]?.slug ?? "");
      setActivityArea(DEFAULT_ACTIVITY_AREA);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="start-new-initiative-button">
      <label className="start-new-initiative-button__field">
        <span>Title</span>
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="start-new-initiative-button__field">
        <span>Short description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <label className="start-new-initiative-button__field">
        <span>Community association</span>
        <select value={communitySlug} onChange={(event) => setCommunitySlug(event.target.value)}>
          {INITIATIVE_COMMUNITY_OPTIONS.map((community) => (
            <option key={community.slug} value={community.slug}>
              {community.label}
            </option>
          ))}
        </select>
      </label>

      <label className="start-new-initiative-button__field">
        <span>Activity area</span>
        <input
          type="text"
          value={activityArea}
          onChange={(event) => setActivityArea(event.target.value)}
        />
      </label>

      <p className="start-new-initiative-button__visibility">Visibility: Public</p>

      <button
        type="button"
        className="start-new-initiative-button__action"
        onClick={() => void handleCreate()}
        disabled={creating}
      >
        {creating ? "Creating..." : "Create Draft"}
      </button>
      {message ? <p className="start-new-initiative-button__message">{message}</p> : null}
    </div>
  );
}
