import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_FAQ } from "../membership.constants";

export function MembershipFaqAccordion() {
  return (
    <section className="membership-section" aria-labelledby="membership-faq-title">
      <SectionHeader title="Frequently Asked Questions" />
      <div className="membership-faq-accordion" role="region" aria-label="Membership FAQ">
        {MEMBERSHIP_FAQ.map((entry) => (
          <details key={entry.id} className="membership-faq-accordion__item">
            <summary className="membership-faq-accordion__summary">{entry.question}</summary>
            <div className="membership-faq-accordion__body">
              <p>{entry.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
