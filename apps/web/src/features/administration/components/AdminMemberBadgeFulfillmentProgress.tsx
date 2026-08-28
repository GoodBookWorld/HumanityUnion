import type { MemberBadgeApplicationFulfillmentStatus } from "@hu/types";

const MILESTONES = [
  "Awaiting fulfillment",
  "Preparing",
  "Shipped",
  "Delivered",
] as const;

export function resolveFulfillmentProgressIndex(input: {
  fulfillmentStatus: MemberBadgeApplicationFulfillmentStatus | string;
  shipped: boolean;
  delivered: boolean;
}): number {
  if (input.delivered || input.fulfillmentStatus === "completed") {
    return 3;
  }
  if (input.shipped || input.fulfillmentStatus === "shipped") {
    return 2;
  }
  if (input.fulfillmentStatus === "preparing") {
    return 1;
  }
  return 0;
}

interface AdminMemberBadgeFulfillmentProgressProps {
  fulfillmentStatus: MemberBadgeApplicationFulfillmentStatus | string;
  shipped: boolean;
  delivered: boolean;
}

/**
 * Pack 25D — compact fulfillment milestones with animated red progress line
 * until Delivered, then static green. Honors prefers-reduced-motion via CSS.
 */
export function AdminMemberBadgeFulfillmentProgress({
  fulfillmentStatus,
  shipped,
  delivered,
}: AdminMemberBadgeFulfillmentProgressProps) {
  const activeIndex = resolveFulfillmentProgressIndex({
    fulfillmentStatus,
    shipped,
    delivered,
  });
  const isComplete = activeIndex >= 3;

  return (
    <div
      className={[
        "admin-member-badge-fulfillment-progress",
        isComplete
          ? "admin-member-badge-fulfillment-progress--complete"
          : "admin-member-badge-fulfillment-progress--active",
      ].join(" ")}
      role="status"
      aria-label={`Fulfillment Progress: ${MILESTONES[activeIndex]}`}
    >
      <p className="admin-member-badge-fulfillment-progress__title">Fulfillment Progress</p>
      <ol className="admin-member-badge-fulfillment-progress__track">
        {MILESTONES.map((label, index) => {
          const reached = index <= activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <li
              key={label}
              className={[
                "admin-member-badge-fulfillment-progress__step",
                reached ? "admin-member-badge-fulfillment-progress__step--reached" : "",
                isCurrent ? "admin-member-badge-fulfillment-progress__step--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="admin-member-badge-fulfillment-progress__dot" aria-hidden="true" />
              <span className="admin-member-badge-fulfillment-progress__label">{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="admin-member-badge-fulfillment-progress__rail" aria-hidden="true">
        <div
          className="admin-member-badge-fulfillment-progress__rail-fill"
          style={{ width: `${(activeIndex / (MILESTONES.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
