"use client";

import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import type { CivicIntegrationView } from "@hu/types";

import { WorkspaceEmptyState, WorkspaceSectionShell } from "../../initiative-workspace-ux";
import { getCivicIntegrationView } from "../api";

import {
  CivicBreadcrumb,
  CivicContextPanel,
  CivicPipelineStatusPanel,
  RelatedCivicRecordsPanel,
} from "./CivicIntegrationWidgets";

import "./capability02-integration.css";

interface WorkspaceCivicIntegrationPanelProps {
  initiativeId: string;
}

export function WorkspaceCivicIntegrationPanel({
  initiativeId,
}: WorkspaceCivicIntegrationPanelProps) {
  const [view, setView] = useState<CivicIntegrationView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const integration = await getCivicIntegrationView("initiative", initiativeId);

        if (!cancelled) {
          setView(integration);
        }
      } catch {
        if (!cancelled) {
          setView(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  return (
    <ProfileSection title="Civic Integration">
      <WorkspaceSectionShell
        purpose="Review civic pipeline status, related records, and integration context across the full Capability 02 workflow."
        loading={loading ? "Loading civic integration context..." : null}
        emptyState={
          !loading && !view ? (
            <WorkspaceEmptyState
              title="Civic integration context is unavailable"
              explanation="The integration layer could not load pipeline status for this initiative."
              nextStep="Refresh the page or continue working in the preceding workspace sections."
            />
          ) : null
        }
      >
        {view ? (
          <div className="capability02-integration">
            <CivicBreadcrumb items={view.breadcrumb} />
            <CivicPipelineStatusPanel status={view.pipelineStatus} />
            {view.pipelineStatus.currentStageId ? (
              <p className="capability02-integration__meta">
                Current civic stage: {view.pipelineStatus.currentStageId.replace(/_/g, " ")}
              </p>
            ) : null}
            {view.pipelineStatus.previousStageId ? (
              <p className="capability02-integration__meta">
                Previous civic stage: {view.pipelineStatus.previousStageId.replace(/_/g, " ")}
              </p>
            ) : null}
            <CivicContextPanel
              title={view.context.title}
              summary={view.context.summary}
              sections={view.context.relatedSections}
            />
            <RelatedCivicRecordsPanel records={view.relatedRecords} />
          </div>
        ) : null}
      </WorkspaceSectionShell>
    </ProfileSection>
  );
}
