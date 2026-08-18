"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveLifecycleDraftContext,
  InitiativeLifecycleProfile,
} from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { requiresPublicImpactBeforeCivicArchive } from "../../public-initiative-experience/initiative-lifecycle-shell";
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
  const requirePublicImpact = requiresPublicImpactBeforeCivicArchive(profile);
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

  if (
    requirePublicImpact &&
    !context.intelligenceSnapshot.isPublicImpactReportAvailable
  ) {
    return (
      <div className="lsw-main">
        <InitiativeCivicArchiveIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
          lifecycleProfile={profile}
        />
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
            {requirePublicImpact
              ? "Generate a Civic Archive from the published Public Impact Report and upstream Lifecycle sources. The Archive Assistant remains advisory — nothing publishes automatically, and historical records are never invented or deleted."
              : "Generate a Civic Archive from published Public Choice lifecycle sources (Collective Decision). Public Impact is not required on this route. The Archive Assistant remains advisory — nothing publishes automatically."}
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
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
        />
      )}
    </div>
  );
}
