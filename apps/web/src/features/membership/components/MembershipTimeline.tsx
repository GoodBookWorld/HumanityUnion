import type { MembershipTimelineStep } from "@hu/types";

import "./membership-timeline.css";

interface MembershipTimelineProps {
  steps: MembershipTimelineStep[];
  compact?: boolean;
}

export function MembershipTimeline({ steps, compact = false }: MembershipTimelineProps) {
  return (
    <ol
      className={`membership-timeline${compact ? " membership-timeline--compact" : ""}`}
      aria-label="Membership journey timeline"
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`membership-timeline__step membership-timeline__step--${step.state}`}
        >
          <span className="membership-timeline__marker" aria-hidden="true">
            {compact ? null : index + 1}
          </span>
          {!compact && index < steps.length - 1 ? (
            <span className="membership-timeline__connector" aria-hidden="true" />
          ) : null}
          <div className="membership-timeline__content">
            <strong>{step.label}</strong>
            {step.detail ? <p>{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
