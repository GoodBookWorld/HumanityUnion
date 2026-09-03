import type { MembershipTimelineStep } from "@hu/types";
import { useTranslations } from "next-intl";

import { MEMBERSHIP_CONTRIBUTION_AMOUNT } from "../membership.constants";

import "./membership-timeline.css";

interface MembershipTimelineProps {
  steps: MembershipTimelineStep[];
  compact?: boolean;
}

function detailKeyForState(state: MembershipTimelineStep["state"]): string {
  if (state === "complete") {
    return "detailComplete";
  }
  if (state === "current") {
    return "detailCurrent";
  }
  return "detailUpcoming";
}

export function MembershipTimeline({ steps, compact = false }: MembershipTimelineProps) {
  const t = useTranslations("membershipPublic.journey");

  return (
    <ol
      className={`membership-timeline${compact ? " membership-timeline--compact" : ""}`}
      aria-label={t("timelineAria")}
    >
      {steps.map((step, index) => {
        const label = t.has(`steps.${step.id}.label`)
          ? t(`steps.${step.id}.label`)
          : step.label;
        const detailMessageKey = `steps.${step.id}.${detailKeyForState(step.state)}`;
        const detail = step.detail
          ? t.has(detailMessageKey)
            ? t(detailMessageKey, { amount: MEMBERSHIP_CONTRIBUTION_AMOUNT })
            : step.detail
          : null;

        return (
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
              <strong>{label}</strong>
              {detail ? <p>{detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
