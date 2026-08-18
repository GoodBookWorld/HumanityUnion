"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveLifecycleDraftContext,
  InitiativeLifecycleProfile,
} from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativeCivicArchiveDraft, getInitiativeCivicArchiveWorkspace } from "../api";
import { InitiativeCivicArchiveEditor } from "./InitiativeCivicArchiveEditor";
import { InitiativeCivicArchiveIntelligenceSnapshotPanel } from "./InitiativeCivicArchiveIntelligenceSnapshotPanel";

import "./initiative-civic-archive-stage-workspace.css";

interface InitiativeCivicArchiveAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Canonical profile from the Lifecycle shell/experience projection — never invents progression. */
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

export function InitiativeCivicArchiveAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  lifecycleProfile,
}: InitiativeCivicArchiveAuthorWorkspaceProps) {
  const profile = resolveInitiativeLifecycleProfile(lifecycleProfile);
  const [context, setContext] = useState<InitiativeCivicArchiveLifecycleDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourceReview, setShowSourceReview] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeCivicArchiveWorkspace(initiativeId);
      setContext(workspace);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const onLifecyclePublished = useAfterLifecyclePublish(loadWorkspace);

  function handleDraftUpdated(draft: InitiativeCivicArchiveLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeCivicArchiveDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Civic Archive workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="ica-source-panel__empty">Loading Civic Archive workspace…</p>;
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.finalArchiveTitle.trim() ||
        context.draft.sections.some((section) => section.body.trim())),
  );

  return (
    <div className="lsw-main">
      {context.latestPublishedVersion != null ? (
        <p className="ica-source-panel__empty">
          Latest published Archive version: v{context.latestPublishedVersion}. Lifecycle is complete
          after Publish & Complete Initiative Lifecycle. Generate again only to prepare the next
          immutable Archive version — prior versions are never mutated.
        </p>
      ) : null}

      <div className="ica-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourceReview((value) => !value)}>
          {showSourceReview ? "Hide Sources / Completeness" : "Sources / Completeness"}
        </WorkspaceButton>
      </div>

      {showSourceReview ? (
        <InitiativeCivicArchiveIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
          lifecycleProfile={profile}
        />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ica-editor">
          <p className="ica-source-panel__empty">
            Generate a Civic Archive from whatever canonical Lifecycle history exists for this
            Initiative. Missing optional upstream stages become incompleteness notes — not blockers.
            The Archive Assistant remains advisory — nothing publishes automatically, and historical
            records are never invented or deleted.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate Civic Archive Draft")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeCivicArchiveEditor
          initiativeId={initiativeId}
          draft={context.draft}
          lifecycleProfile={profile}
          onDraftUpdated={handleDraftUpdated}
          onPublished={onLifecyclePublished}
          onTogglePreview={onTogglePreview}
        />
      )}
    </div>
  );
}
