"use client";

import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import type { CivicIntegrationView } from "@hu/types";

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

  if (loading) {
    return (
      <ProfileSection title="Civic Integration">
        <p>Loading civic integration context...</p>
      </ProfileSection>
    );
  }

  if (!view) {
    return null;
  }

  return (
    <ProfileSection title="Civic Integration">
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
    </ProfileSection>
  );
}
