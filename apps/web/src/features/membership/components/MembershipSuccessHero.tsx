import { MEMBERSHIP_SUCCESS_COPY } from "../membership.constants";

import { MemberBadgeIcon } from "./MemberBadgeIcon";

export function MembershipSuccessHero() {
  return (
    <section className="membership-success-hero" aria-labelledby="membership-success-hero-title">
      <div className="membership-success-hero__content">
        <p className="membership-success-hero__eyebrow">Membership confirmed</p>
        <h1 id="membership-success-hero-title" className="membership-success-hero__title">
          {MEMBERSHIP_SUCCESS_COPY.heading}
        </h1>
        <p className="membership-success-hero__subheading">{MEMBERSHIP_SUCCESS_COPY.subheading}</p>
        <p className="membership-success-hero__body">{MEMBERSHIP_SUCCESS_COPY.body}</p>
      </div>
      <div className="membership-success-hero__artwork" aria-hidden="true">
        <div className="membership-success-hero__glow" />
        <MemberBadgeIcon size="feature" decorative />
      </div>
    </section>
  );
}
