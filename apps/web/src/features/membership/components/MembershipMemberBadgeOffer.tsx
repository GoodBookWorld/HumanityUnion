"use client";

import type { MemberBadgeContributionAvailability } from "@hu/types";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { getMemberBadgeAvailability } from "../member-badge-api";
import { MEMBER_BADGE_PRODUCT } from "../membership.constants";

import { MemberBadgeIcon } from "./MemberBadgeIcon";

export function MembershipMemberBadgeOffer() {
  const [availability, setAvailability] = useState<MemberBadgeContributionAvailability | null>(
    null,
  );

  useEffect(() => {
    void getMemberBadgeAvailability()
      .then(setAvailability)
      .catch(() => {
        setAvailability({
          enabled: false,
          eligible: false,
          reason: "Member Badge Contributions are not currently open.",
          contributionAmountCad: "20 CAD",
          shippingCountries: [],
        });
      });
  }, []);

  const showRequestLink = availability?.enabled && availability.eligible;

  return (
    <section className="membership-success-section" aria-labelledby="membership-badge-offer-title">
      <SectionHeader title={MEMBER_BADGE_PRODUCT.title} />
      <Card className="membership-badge-offer">
        <div className="membership-badge-offer__layout">
          <div className="membership-badge-offer__artwork">
            <MemberBadgeIcon size="feature" />
          </div>
          <div className="membership-badge-offer__content">
            <p className="membership-badge-offer__body">{MEMBER_BADGE_PRODUCT.body}</p>
            <p className="membership-badge-offer__subtitle">{MEMBER_BADGE_PRODUCT.subtitle}</p>
            <ul className="membership-badge-offer__features">
              <li>{MEMBER_BADGE_PRODUCT.productName}</li>
              {MEMBER_BADGE_PRODUCT.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className="membership-badge-offer__pricing">
            <p className="membership-badge-offer__price">{MEMBER_BADGE_PRODUCT.price}</p>
            <p className="membership-badge-offer__shipping">{MEMBER_BADGE_PRODUCT.shippingNote}</p>
            {showRequestLink ? (
              <Button href="/membership/member-badge" variant="secondary">
                Request Member Badge
              </Button>
            ) : (
              <>
                <Button variant="secondary" disabled aria-disabled="true">
                  Coming Soon
                </Button>
                <p className="membership-badge-offer__note" role="status">
                  Member Badge Contributions are not currently open.
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
