import type { Initiative } from "@hu/types";

import { formatInitiativeDate, formatTimelineEventLabel } from "../initiative-lifecycle-labels";

import "./initiative-lifecycle-timeline.css";

interface InitiativeLifecycleTimelineProps {
  initiative: Initiative | null;
}

export function InitiativeLifecycleTimeline({ initiative }: InitiativeLifecycleTimelineProps) {
  if (!initiative) {
    return (
      <p className="initiative-lifecycle-timeline__empty">Select an initiative to view timeline.</p>
    );
  }

  if (initiative.timeline.length === 0) {
    return (
      <p className="initiative-lifecycle-timeline__empty">No lifecycle events recorded yet.</p>
    );
  }

  return (
    <ol className="initiative-lifecycle-timeline">
      {initiative.timeline.map((event, index) => (
        <li key={event.eventId} className="initiative-lifecycle-timeline__item">
          <span className="initiative-lifecycle-timeline__step">{index + 1}</span>
          <div className="initiative-lifecycle-timeline__content">
            <span className="initiative-lifecycle-timeline__label">
              {formatTimelineEventLabel(event.eventType)}
            </span>
            <span className="initiative-lifecycle-timeline__date">
              {formatInitiativeDate(event.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
