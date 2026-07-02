import type { CollectiveDecision } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./decision-overview.css";

interface DecisionOverviewProps {
  decision: CollectiveDecision;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMechanism(mechanism: CollectiveDecision["decisionMechanism"]): string {
  if (mechanism === "CommunityPoll") {
    return "Community Poll";
  }

  return mechanism;
}

export function DecisionOverview({ decision }: DecisionOverviewProps) {
  return (
    <div className="decision-overview">
      <ProfileField label="Title" value={decision.ballot.question} />
      <ProfileField label="Status" value={decision.status} />
      <ProfileField label="Decision Template" value={formatMechanism(decision.decisionMechanism)} />
      <ProfileField label="Created" value={formatDate(decision.createdAt)} />
      <ProfileField label="Opening Date" value={formatDate(decision.timeline.opensAt)} />
      <ProfileField label="Closing Date" value={formatDate(decision.timeline.closesAt)} />
    </div>
  );
}
