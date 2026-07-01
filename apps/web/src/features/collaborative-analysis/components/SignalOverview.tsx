import type { Signal, SignalType } from "@hu/types";

import "./signal-overview.css";

interface SignalOverviewProps {
  signals: Signal[];
}

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  NeedsClarification: "Needs Clarification",
  StrongEvidence: "Strong Evidence",
  WeakEvidence: "Weak Evidence",
  Duplicate: "Duplicate",
  NeedsExpertReview: "Needs Expert Review",
  RegionalImpact: "Regional Impact",
  HighPriority: "High Priority",
  ReadyForPoll: "Ready for Poll",
};

function countSignalsByType(signals: Signal[]): { type: SignalType; label: string; count: number }[] {
  const counts = new Map<SignalType, number>();

  for (const signal of signals) {
    counts.set(signal.signalType, (counts.get(signal.signalType) ?? 0) + 1);
  }

  return (Object.keys(SIGNAL_TYPE_LABELS) as SignalType[])
    .map((type) => ({
      type,
      label: SIGNAL_TYPE_LABELS[type],
      count: counts.get(type) ?? 0,
    }))
    .filter((entry) => entry.count > 0);
}

export function SignalOverview({ signals }: SignalOverviewProps) {
  const totals = countSignalsByType(signals);

  if (totals.length === 0) {
    return <p className="signal-overview__empty">No signals recorded yet.</p>;
  }

  return (
    <div className="signal-overview">
      <p className="signal-overview__note">
        Signals are analytical indicators. They are not votes.
      </p>
      <ul className="signal-overview__list">
        {totals.map((entry) => (
          <li key={entry.type} className="signal-overview__item">
            <span className="signal-overview__label">{entry.label}</span>
            <span className="signal-overview__count">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
