"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type { InitiativePetitionDraft, InitiativePetitionDraftContext } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativePetitionDraft, getInitiativePetitionWorkspace } from "../api";
import { InitiativePetitionEditor } from "./InitiativePetitionEditor";
import { InitiativePetitionIntelligenceSnapshotPanel } from "./InitiativePetitionIntelligenceSnapshotPanel";

import "./initiative-petition-stage-workspace.css";

interface InitiativePetitionAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part F. The Petition stage's `authorEditorSlot`
 * for `InitiativeLifecycleStageWorkspace` — this component only ever
 * renders inside the Author Workspace branch of that shared shell, never a
 * second standalone page or a new editor implementation.
 *
 * Self-fetches (mirrors `InitiativeRevisionAuthorWorkspace`, Part E): loads
 * the Author's Petition workspace context (Petition Sources + Intelligence
 * Snapshot) in a single request, then renders the "Generate Petition
 * Draft" empty state or the Petition Editor, entirely from real persisted
 * data. Once a Petition has already been published for this Initiative,
 * this instead shows the published state — Petition supports only one
 * publish per Initiative, unlike Analysis/Proposal/Revision's repeatable
 * draft cycle.
 */
export function InitiativePetitionAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativePetitionAuthorWorkspaceProps) {
  const actions = useAuthorActionLabels();
  const { t } = actions;
  const [context, setContext] = useState<InitiativePetitionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativePetitionWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativePetitionDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() => generateInitiativePetitionDraft(initiativeId));
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // The Save-button phase already reverts to idle on failure; the
      // Petition Sources panel below (toggled open) lets the Author see
      // what data exists to retry with informed context.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message={t("author.petition.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="lsw-sources__missing">{t("author.petition.loading")}</p>;
  }

  if (context.publishedPetitionId) {
    return (
      <p className="ipl-source-panel__empty">
        {t("author.petition.alreadyPublished")}
      </p>
    );
  }

  if (!context.intelligenceSnapshot.isRevisionAvailable) {
    return (
      <p className="ipl-source-panel__empty">
        {t("author.petition.requiresRevision")}
      </p>
    );
  }

  return (
    <div className="lsw-main">
      {context.draft ? (
        <button
          type="button"
          className="workspace-button workspace-button--secondary"
          aria-expanded={showSourcePanel}
          onClick={() => setShowSourcePanel((current) => !current)}
        >
          {showSourcePanel ? t("author.petition.hideSources") : t("author.petition.showSources")}
        </button>
      ) : null}

      {!context.draft || showSourcePanel ? (
        <InitiativePetitionIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {context.draft ? (
        <InitiativePetitionEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={onLifecyclePublished}
          onTogglePreview={onTogglePreview}
        />
      ) : (
        <div className="ipl-editor">
          <h3>{t("author.petition.noDraftYet")}</h3>
          <p>{t("author.petition.noDraftExplanation")}</p>
          <div className="ipl-editor__header-actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(
                generatePhase.phase,
                t("author.petition.generatePetitionDraft"),
                actions.phaseLabels,
              )}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}
