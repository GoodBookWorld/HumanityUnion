"use client";

import type { CollaborativeAnalysis } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";

import { AnalysisActions } from "./AnalysisActions";
import { AnalysisOverview } from "./AnalysisOverview";
import { AnalysisSummaryPanel } from "./AnalysisSummary";
import { ContributionExplorer } from "./ContributionExplorer";
import { ProgressPolicyPanel } from "./ProgressPolicyPanel";
import { ReadinessDashboard } from "./ReadinessDashboard";
import { SignalOverview } from "./SignalOverview";

import "./workspace.css";

interface CollaborativeAnalysisWorkspaceProps {
  analysis: CollaborativeAnalysis;
  initiativeTitle: string;
}

export function CollaborativeAnalysisWorkspace({
  analysis,
  initiativeTitle,
}: CollaborativeAnalysisWorkspaceProps) {
  return (
    <div className="collaborative-analysis-workspace">
      <ProfileSection title="Analysis Overview">
        <AnalysisOverview
          analysis={analysis}
          initiativeTitle={initiativeTitle}
        />
      </ProfileSection>

      <ProfileSection title="Readiness Dashboard">
        <ReadinessDashboard readiness={analysis.readiness} />
      </ProfileSection>

      <ProfileSection title="Progress Policy">
        <ProgressPolicyPanel progressPolicy={analysis.progressPolicy} />
      </ProfileSection>

      <ProfileSection title="Contribution Explorer">
        <ContributionExplorer contributions={analysis.contributions} />
      </ProfileSection>

      <ProfileSection title="Signal Overview">
        <SignalOverview signals={analysis.signals} />
      </ProfileSection>

      <ProfileSection title="Analysis Summary">
        <AnalysisSummaryPanel summaries={analysis.summaries} />
      </ProfileSection>

      <ProfileSection title="Actions">
        <AnalysisActions />
      </ProfileSection>
    </div>
  );
}
