"use client";

import type { Initiative } from "@hu/types";
import { useState } from "react";

import { createInitiative } from "../api";

import "./start-new-initiative-button.css";

interface StartNewInitiativeButtonProps {
  onCreated: (initiative: Initiative) => void;
}

function buildBootstrapInitiative(): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId: `initiative-bootstrap-${Date.now()}`,
    stewardId: "member-bootstrap-001",
    createdAt: now,
    updatedAt: now,
    title: "New Bootstrap Initiative",
    description: "Bootstrap initiative created from the workspace.",
    status: "draft",
    visibility: {
      policy: "steward_only",
    },
    metadata: {
      category: "Community",
      tags: ["Bootstrap"],
      region: "British Columbia",
      language: "en",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

export function StartNewInitiativeButton({ onCreated }: StartNewInitiativeButtonProps) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setMessage(null);

    try {
      const created = await createInitiative(buildBootstrapInitiative());
      onCreated(created);
      setMessage(`Created ${created.title}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="start-new-initiative-button">
      <button
        type="button"
        className="start-new-initiative-button__action"
        onClick={handleCreate}
        disabled={creating}
      >
        {creating ? "Starting..." : "Start New Initiative"}
      </button>
      {message ? <p className="start-new-initiative-button__message">{message}</p> : null}
    </div>
  );
}
