import type { MembershipTimelineStep } from "@hu/types";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";

import { MembershipTimeline } from "./MembershipTimeline";

interface MembershipJourneySectionProps {
  steps: MembershipTimelineStep[];
}

export function MembershipJourneySection({ steps }: MembershipJourneySectionProps) {
  const t = useTranslations("membershipPublic");

  return (
    <section className="membership-section" aria-labelledby="membership-journey-title">
      <SectionHeader
        title={t("journey.title")}
        description={t("journey.description")}
        titleId="membership-journey-title"
      />
      <Card>
        <MembershipTimeline steps={steps} />
      </Card>
    </section>
  );
}
