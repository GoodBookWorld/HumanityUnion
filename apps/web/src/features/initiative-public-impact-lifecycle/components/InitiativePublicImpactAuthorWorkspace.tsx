"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactLifecycleDraftContext,
} from "@hu/types";

import { useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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
  const actions = useAuthorActionLabels();
  const { t } = actions;
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

  const onLifecyclePublished = useAfterLifecyclePublish(loadWorkspace);

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
        <WorkspaceErrorState message={t("author.publicImpact.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="ipi-source-panel__empty">{t("author.publicImpact.loading")}</p>;
  }

  if (context.publishedReportId) {
    return (
      <p className="ipi-source-panel__empty">{t("author.publicImpact.alreadyPublished")}</p>
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
          {showSourcePanel ? actions.hideSources : actions.sources}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativePublicImpactIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ipi-editor">
          <p className="ipi-source-panel__empty">{t("author.publicImpact.noDraftExplanation")}</p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {actions.saveLabel(generatePhase.phase, t("author.publicImpact.generateImpactDraft"))}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativePublicImpactEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={onLifecyclePublished}
          onTogglePreview={onTogglePreview}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
