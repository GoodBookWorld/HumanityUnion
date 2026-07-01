import type { CollaborativeAnalysis } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./analysis-overview.css";

interface AnalysisOverviewProps {
  analysis: CollaborativeAnalysis;
  initiativeTitle: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatus(status: CollaborativeAnalysis["status"]): string {
  return status.replace(/_/g, " ");
}

export function AnalysisOverview({ analysis, initiativeTitle }: AnalysisOverviewProps) {
  return (
    <div className="analysis-overview">
      <ProfileField label="Initiative" value={initiativeTitle} />
      <ProfileField label="Analysis Status" value={formatStatus(analysis.status)} />
      <ProfileField label="Created" value={formatDate(analysis.createdAt)} />
      <ProfileField label="Updated" value={formatDate(analysis.updatedAt)} />
    </div>
  );
}
