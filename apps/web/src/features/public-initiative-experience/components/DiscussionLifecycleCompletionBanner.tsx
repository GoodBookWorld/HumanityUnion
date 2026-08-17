"use client";

import { useState } from "react";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import { completeInitiativeDiscussionStage } from "../../initiative-discussion-lifecycle/api";

interface DiscussionLifecycleCompletionBannerProps {
  readonly initiativeId: string;
  readonly discussionCompleted: boolean;
  readonly canComplete: boolean;
  readonly onCompleted: () => void;
}

/**
 * Phase 04 — Discussion completion is an explicit Author action.
 * Visiting #discussion never completes the stage.
 */
export function DiscussionLifecycleCompletionBanner({
  initiativeId,
  discussionCompleted,
  canComplete,
  onCompleted,
}: DiscussionLifecycleCompletionBannerProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (!canComplete && !discussionCompleted) {
    return null;
  }

  if (discussionCompleted) {
    return (
      <div className="pie-discussion-lifecycle" role="status">
        <p className="pie-discussion-lifecycle__status">
          Discussion is marked complete for lifecycle progression. Participants may still comment.
        </p>
      </div>
    );
  }

  async function handleComplete() {
    if (
      !window.confirm(
        "Mark Discussion complete? This unlocks the next applicable lifecycle stage. Visiting Discussion alone does not complete it — this action is required.",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await completeInitiativeDiscussionStage(initiativeId);
      setMessage({
        tone: "success",
        text: "Discussion completed. Refreshing lifecycle progress…",
      });
      onCompleted();
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Could not complete Discussion: ${detail}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pie-discussion-lifecycle">
      <p className="pie-discussion-lifecycle__guidance">
        When discussion has produced enough civic signal, mark Discussion complete to advance the
        Initiative lifecycle. This does not close comments.
      </p>
      <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleComplete()}>
        {busy ? "Completing…" : "Complete Discussion"}
      </WorkspaceButton>
      {message ? (
        <p className="pie-discussion-lifecycle__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
