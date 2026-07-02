"use client";

import type { CollectiveDecision, CollaborativeAnalysis, Initiative } from "@hu/types";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";

import { AnalysisSummary } from "./AnalysisSummary";
import { BallotPanel } from "./Ballot";
import { DecisionActions } from "./DecisionActions";
import { DecisionOverview } from "./DecisionOverview";
import { DecisionPanel } from "./DecisionPanel";
import { DecisionResultPanel } from "./DecisionResult";
import { DecisionSubject } from "./DecisionSubject";
import { OutcomePanel } from "./OutcomePanel";
import { ParticipationStatistics } from "./ParticipationStatistics";

import "./workspace.css";

interface CollectiveDecisionWorkspaceProps {
  initialDecision: CollectiveDecision;
  initiativeSubject?: Initiative | null;
  collaborativeAnalysis?: Pick<
    CollaborativeAnalysis,
    "summaries" | "readiness" | "progressPolicy"
  > | null;
}

export function CollectiveDecisionWorkspace({
  initialDecision,
  initiativeSubject = null,
  collaborativeAnalysis = null,
}: CollectiveDecisionWorkspaceProps) {
  const [decision, setDecision] = useState(initialDecision);

  return (
    <div className="collective-decision-workspace">
      <ProfileSection title="Decision Overview">
        <DecisionOverview decision={decision} />
      </ProfileSection>

      <ProfileSection title="Decision Subject">
        <DecisionSubject decision={decision} initiativeSubject={initiativeSubject} />
      </ProfileSection>

      <ProfileSection title="Analysis Summary">
        <AnalysisSummary collaborativeAnalysis={collaborativeAnalysis} />
      </ProfileSection>

      <ProfileSection title="Ballot">
        <BallotPanel decision={decision} />
      </ProfileSection>

      <ProfileSection title="Decision Panel">
        <DecisionPanel decision={decision} onDecisionSubmitted={setDecision} />
      </ProfileSection>

      <ProfileSection title="Participation Statistics">
        <ParticipationStatistics decision={decision} />
      </ProfileSection>

      <ProfileSection title="Decision Result">
        <DecisionResultPanel decision={decision} />
      </ProfileSection>

      <ProfileSection title="Outcome">
        <OutcomePanel decision={decision} />
      </ProfileSection>

      <ProfileSection title="Actions">
        <DecisionActions decision={decision} />
      </ProfileSection>
    </div>
  );
}
