"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativeCivicArchiveDraft, getInitiativeCivicArchiveWorkspace } from "../api";
import { InitiativeCivicArchiveEditor } from "./InitiativeCivicArchiveEditor";
import { InitiativeCivicArchiveIntelligenceSnapshotPanel } from "./InitiativeCivicArchiveIntelligenceSnapshotPanel";

import "./initiative-civic-archive-stage-workspace.css";

interface InitiativeCivicArchiveAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

export function InitiativeCivicArchiveAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeCivicArchiveAuthorWorkspaceProps) {
  const [context, setContext] = useState<InitiativeCivicArchiveLifecycleDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
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

  if (!context.intelligenceSnapshot.isPublicImpactReportAvailable) {
    return (
      <div className="lsw-main">
        <InitiativeCivicArchiveIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
        <p className="ica-source-panel__empty">
          A published Public Impact Report is required before generating Civic Archive.
        </p>
      </div>
    );
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
          Latest published Archive version: v{context.latestPublishedVersion}. Generate again to
          prepare the next immutable version — prior versions are never mutated.
        </p>
      ) : null}

      <div className="ica-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? "Hide Sources / Completeness" : "Sources / Completeness"}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeCivicArchiveIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ica-editor">
          <p className="ica-source-panel__empty">
            Generate a Civic Archive from the published Public Impact Report and upstream Lifecycle
            sources. The Archive Assistant remains advisory — nothing publishes automatically, and
            historical records are never invented or deleted.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate Civic Archive Draft")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeCivicArchiveEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
        />
      )}
    </div>
  );
}
