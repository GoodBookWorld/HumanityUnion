"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativePublicImpactDraft, getInitiativePublicImpactWorkspace } from "../api";
import { InitiativePublicImpactEditor } from "./InitiativePublicImpactEditor";
import { InitiativePublicImpactIntelligenceSnapshotPanel } from "./InitiativePublicImpactIntelligenceSnapshotPanel";

import "./initiative-public-impact-stage-workspace.css";

interface InitiativePublicImpactAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Civic Archive" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativePublicImpactAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
}: InitiativePublicImpactAuthorWorkspaceProps) {
  const [context, setContext] = useState<InitiativePublicImpactLifecycleDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativePublicImpactWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativePublicImpactLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativePublicImpactDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Public Impact workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="ipi-source-panel__empty">Loading Public Impact workspace…</p>;
  }

  if (context.publishedReportId) {
    return (
      <p className="ipi-source-panel__empty">
        Public Impact has already been published for this Initiative. Use Public Preview to review
        the Report, or continue to Civic Archive.
      </p>
    );
  }

  if (!context.intelligenceSnapshot.isOfficialResponsePackageAvailable) {
    return (
      <div className="lsw-main">
        <InitiativePublicImpactIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
        <p className="ipi-source-panel__empty">
          A published Official Response Package is required before generating Public Impact.
        </p>
      </div>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() || context.draft.sections.some((section) => section.body.trim())),
  );

  return (
    <div className="lsw-main">
      <div className="ipi-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? "Hide Sources" : "Sources"}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativePublicImpactIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ipi-editor">
          <p className="ipi-source-panel__empty">
            Generate a Public Impact Report from Initiative, Collective Decision, Tracking, Official
            Responses (including No official response received), and linked evidence. The Assistant is
            advisory only — it cannot invent results, publish, or advance Lifecycle. Zero measurable
            impact is a valid publishable conclusion.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativePublicImpactEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
