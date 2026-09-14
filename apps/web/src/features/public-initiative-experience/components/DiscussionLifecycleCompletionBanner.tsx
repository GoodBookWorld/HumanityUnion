"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("initiativeExperience");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (!canComplete && !discussionCompleted) {
    return null;
  }

  if (discussionCompleted) {
    return (
      <div className="pie-discussion-lifecycle" role="status">
        <p className="pie-discussion-lifecycle__status">
          {t("collaboration.complete.statusCompleted")}
        </p>
      </div>
    );
  }

  async function handleComplete() {
    if (!window.confirm(t("collaboration.complete.confirmDescription"))) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await completeInitiativeDiscussionStage(initiativeId);
      setMessage({
        tone: "success",
        text: t("collaboration.complete.success"),
      });
      onCompleted();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : t("collaboration.complete.unknownError");
      setMessage({
        tone: "error",
        text: t("collaboration.complete.failed", { detail }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pie-discussion-lifecycle">
      <p className="pie-discussion-lifecycle__guidance">
        {t("collaboration.complete.guidance")}
      </p>
      <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleComplete()}>
        {busy
          ? t("collaboration.complete.completing")
          : t("collaboration.complete.completeDiscussion")}
      </WorkspaceButton>
      {message ? (
        <p className="pie-discussion-lifecycle__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
