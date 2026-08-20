"use client";

import { useState } from "react";

import { createPublicChoiceCandidate } from "../api";

interface PublicChoiceCandidateSubmitPanelProps {
  initiativeId: string;
  onSubmitted?: () => void;
}

/**
 * Pack 02D — authenticated Participant candidate submission.
 * Hosted on the election page (#add-candidate). No steward Manage surface required.
 */
export function PublicChoiceCandidateSubmitPanel({
  initiativeId,
  onSubmitted,
}: PublicChoiceCandidateSubmitPanelProps) {
  const [name, setName] = useState("");
  const [campaignPageUrl, setCampaignPageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
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
        Campaign page URL (optional)
        <input
          value={campaignPageUrl}
          onChange={(event) => setCampaignPageUrl(event.target.value)}
          inputMode="url"
          disabled={busy}
          placeholder="https://"
        />
      </label>
      <button type="button" onClick={() => void handleSubmit()} disabled={busy || !name.trim()}>
        {busy ? "Submitting…" : "Submit candidate"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
