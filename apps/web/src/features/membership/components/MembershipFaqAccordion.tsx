import { useTranslations } from "next-intl";

import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_FAQ_IDS } from "../membership.constants";

export function MembershipFaqAccordion() {
  const t = useTranslations("membershipPublic");

  return (
    <section className="membership-section" aria-labelledby="membership-faq-title">
      <SectionHeader title={t("faq.sectionTitle")} />
      <div className="membership-faq-accordion" role="region" aria-label={t("faq.regionLabel")}>
        {MEMBERSHIP_FAQ_IDS.map((id) => (
          <details key={id} className="membership-faq-accordion__item">
            <summary className="membership-faq-accordion__summary">
              {t(`faq.items.${id}.question`)}
            </summary>
            <div className="membership-faq-accordion__body">
              <p>{t(`faq.items.${id}.answer`)}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
