"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeImprovementProposalsCollection,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeRevisionDraft,
  InitiativeRevisionDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  createInitiativeRevisionDraft,
  getInitiativeRevisionWorkspace,
} from "../../initiative-version-revision/api";
import { InitiativeRevisionEditor } from "../../initiative-version-revision/components/InitiativeRevisionEditor";
import { InitiativeRevisionIntelligenceSnapshotPanel } from "../../initiative-version-revision/components/InitiativeRevisionIntelligenceSnapshotPanel";
import "../../initiative-version-revision/components/initiative-revision-stage-workspace.css";
import {
  ensureEmptyImprovementProposalsDraft,
  generateImprovementProposalsDraft,
  getInitiativeProposalIntelligenceSnapshot,
  getMyCurrentImprovementProposalsCollection,
} from "../api";
import { InitiativeImprovementProposalsEditor } from "./InitiativeImprovementProposalsEditor";
import { InitiativeProposalIntelligenceSnapshotPanel } from "./InitiativeProposalIntelligenceSnapshotPanel";

import "./initiative-improvement-proposals-stage-workspace.css";

interface InitiativeImprovementProposalsAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

/**
 * Improvement Proposals Author stage — reviews proposals AND edits/commits
 * the resulting Initiative version (Revision re-homed here; not a nav stage).
 */
export function InitiativeImprovementProposalsAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
}: InitiativeImprovementProposalsAuthorWorkspaceProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const [collection, setCollection] = useState<InitiativeImprovementProposalsCollection | null>(null);
  const [revisionContext, setRevisionContext] = useState<InitiativeRevisionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showVersionSources, setShowVersionSources] = useState(false);
  const generatePhase = useSaveButtonPhase();
  const emptyDraftPhase = useSaveButtonPhase();
  const revisionCreatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const [current, revisionWorkspace] = await Promise.all([
        getMyCurrentImprovementProposalsCollection(initiativeId),
        getInitiativeRevisionWorkspace(initiativeId).catch(() => null),
      ]);
      setCollection(current);
      setRevisionContext(revisionWorkspace);
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

  function handleDraftUpdated(draft: InitiativeRevisionDraft) {
    setRevisionContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() => generateImprovementProposalsDraft(initiativeId));
      setCollection(created);
    } catch {
      // Save-button phase reverts; Sources panel remains available.
    }
  }

  async function handleStartWithoutProposals() {
    try {
      const created = await emptyDraftPhase.runSave(() =>
        ensureEmptyImprovementProposalsDraft(initiativeId),
      );
      setCollection(created);

      if (!revisionContext?.draft) {
        const draft = await createInitiativeRevisionDraft(initiativeId);
        setRevisionContext((current) =>
          current ? { ...current, draft } : current,
        );
      }
    } catch {
      // Save-button phase reverts.
    }
  }

  async function handleCreateRevisionDraft() {
    try {
      const created = await revisionCreatePhase.runSave(() =>
        createInitiativeRevisionDraft(initiativeId),
      );
      setRevisionContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // Save-button phase reverts.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message={t("author.proposal.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading) {
    return <p className="lsw-sources__missing">{t("author.proposal.loading")}</p>;
  }

  const canEditVersion = Boolean(revisionContext && revisionContext.currentVersion > 0);

  return (
    <div className="lsw-main">
      {collection ? (
        <button
          type="button"
          className="workspace-button workspace-button--secondary"
          aria-expanded={showSourcePanel}
          onClick={() => setShowSourcePanel((current) => !current)}
        >
          {showSourcePanel
            ? t("author.proposal.hideSources")
            : t("author.proposal.showSources")}
        </button>
      ) : null}

      {!collection || showSourcePanel ? (
        <ProposalIntelligenceSnapshotSection initiativeId={initiativeId} />
      ) : null}

      {collection ? (
        <InitiativeImprovementProposalsEditor
          initiativeId={initiativeId}
          collection={collection}
          onUpdated={setCollection}
          onTogglePreview={onTogglePreview}
          onNavigate={onNavigate}
          onCompleted={onLifecyclePublished}
        />
      ) : (
        <div className="iip-editor">
          <h3>{t("author.proposal.noProposalsYet")}</h3>
          <p>{t("author.proposal.noProposalsExplanation")}</p>
          <div className="iip-editor__header-actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy || emptyDraftPhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(
                generatePhase.phase,
                t("author.proposal.generateDraft"),
                actions.phaseLabels,
              )}
            </WorkspaceButton>
            <WorkspaceButton
              variant="secondary"
              disabled={generatePhase.isBusy || emptyDraftPhase.isBusy}
              onClick={() => void handleStartWithoutProposals()}
            >
              {resolveSaveButtonLabel(
                emptyDraftPhase.phase,
                t("author.proposal.continueWithoutProposals"),
                actions.phaseLabels,
              )}
            </WorkspaceButton>
          </div>
        </div>
      )}

      {canEditVersion ? (
        <section className="iip-editor" aria-label={t("author.proposal.versionSectionAria")}>
          <div className="iip-editor__header">
            <h3>{t("author.proposal.versionSectionTitle")}</h3>
          </div>
          <p>{t("author.proposal.versionSectionHelp")}</p>

          {revisionContext?.draft ? (
            <button
              type="button"
              className="workspace-button workspace-button--secondary"
              aria-expanded={showVersionSources}
              onClick={() => setShowVersionSources((current) => !current)}
            >
              {showVersionSources
                ? t("author.proposal.hideVersionSources")
                : t("author.proposal.showVersionSources")}
            </button>
          ) : null}

          {(!revisionContext?.draft || showVersionSources) && revisionContext ? (
            <InitiativeRevisionIntelligenceSnapshotPanel snapshot={revisionContext.intelligenceSnapshot} />
          ) : null}

          {revisionContext?.draft ? (
            <InitiativeRevisionEditor
              initiativeId={initiativeId}
              context={revisionContext}
              draft={revisionContext.draft}
              onDraftUpdated={handleDraftUpdated}
              onPublished={onLifecyclePublished}
              onTogglePreview={onTogglePreview}
              embeddedInProposals
            />
          ) : (
            <div className="iip-editor__header-actions">
              <WorkspaceButton
                variant="primary"
                disabled={revisionCreatePhase.isBusy}
                onClick={() => void handleCreateRevisionDraft()}
              >
                {resolveSaveButtonLabel(
                  revisionCreatePhase.phase,
                  t("author.proposal.startVersionDraft"),
                  actions.phaseLabels,
                )}
              </WorkspaceButton>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ProposalIntelligenceSnapshotSection({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeProposalIntelligenceSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeProposalIntelligenceSnapshot(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadFailed) {
    return <p className="iip-source-panel__empty">{t("author.proposal.sourceSnapshot.loadFailed")}</p>;
  }

  if (!snapshot) {
    return <p className="iip-source-panel__empty">{t("author.proposal.sourceSnapshot.loading")}</p>;
  }

  return <InitiativeProposalIntelligenceSnapshotPanel snapshot={snapshot} />;
}
