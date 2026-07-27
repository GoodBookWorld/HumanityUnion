import type { MembershipTimelineStep } from "@hu/types";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";

import { MembershipTimeline } from "./MembershipTimeline";

interface MembershipJourneySectionProps {
  steps: MembershipTimelineStep[];
}

export function MembershipJourneySection({ steps }: MembershipJourneySectionProps) {
  return (
    <section className="membership-section" aria-labelledby="membership-journey-title">
      <SectionHeader
        title="Membership Journey"
        description="Your path from Participant to Member."
      />
      <Card>
        <MembershipTimeline steps={steps} />
      </Card>
    </section>
  );
}
