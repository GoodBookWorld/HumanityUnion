"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeImprovementProposalsCollection,
  InitiativeProposalIntelligenceSnapshot,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateImprovementProposalsDraft, getInitiativeProposalIntelligenceSnapshot, getMyCurrentImprovementProposalsCollection } from "../api";
import { InitiativeImprovementProposalsEditor } from "./InitiativeImprovementProposalsEditor";
import { InitiativeProposalIntelligenceSnapshotPanel } from "./InitiativeProposalIntelligenceSnapshotPanel";

import "./initiative-improvement-proposals-stage-workspace.css";

interface InitiativeImprovementProposalsAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part D. The Improvement Proposals stage's
 * `authorEditorSlot` for `InitiativeLifecycleStageWorkspace` — this
 * component only ever renders inside the Author Workspace branch of that
 * shared shell, never a second standalone page (Part 14).
 *
 * Self-fetches (mirrors `InitiativeCollaborativeAnalysisAuthorWorkspace`,
 * Part B): loads the Author's one canonical collection (Section 5) and
 * the full Proposal Intelligence Snapshot (Section 2/3), then renders the
 * Generate-draft empty state or the Proposal Editor, entirely from real
 * persisted data.
 */
export function InitiativeImprovementProposalsAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeImprovementProposalsAuthorWorkspaceProps) {
  const [collection, setCollection] = useState<InitiativeImprovementProposalsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadCollection = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const current = await getMyCurrentImprovementProposalsCollection(initiativeId);
      setCollection(current);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() => generateImprovementProposalsDraft(initiativeId));
      setCollection(created);
    } catch {
      // The Save-button phase already reverts to idle on failure; the
      // Proposal Sources panel below (toggled open) lets the Author see
      // what data exists to retry with informed context.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="Improvement Proposals could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadCollection()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading) {
    return <p className="lsw-sources__missing">Loading Improvement Proposals…</p>;
  }

  return (
    <div className="lsw-main">
      {collection ? (
        <button
          type="button"
          className="workspace-button workspace-button--secondary"
          aria-expanded={showSourcePanel}
          onClick={() => setShowSourcePanel((current) => !current)}
        >
          {showSourcePanel ? "Hide Proposal Sources" : "Show Proposal Sources"}
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
        />
      ) : (
        <div className="iip-editor">
          <h3>No proposals yet</h3>
          <p>
            Generate structured proposals from the collected proposal-marked Discussion comments above, or
            start from a blank draft and add proposals yourself.
          </p>
          <div className="iip-editor__header-actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(generatePhase.phase, "Generate Improvement Proposals Draft")}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalIntelligenceSnapshotSection({ initiativeId }: { initiativeId: string }) {
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
    return <p className="iip-source-panel__empty">The Proposal Intelligence Snapshot could not be loaded.</p>;
  }

  if (!snapshot) {
    return <p className="iip-source-panel__empty">Loading Proposal Sources…</p>;
  }

  return <InitiativeProposalIntelligenceSnapshotPanel snapshot={snapshot} />;
}
