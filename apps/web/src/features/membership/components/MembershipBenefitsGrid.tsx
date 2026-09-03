import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_BENEFIT_IDS } from "../membership.constants";

export function MembershipBenefitsGrid() {
  const t = useTranslations("membershipPublic");

  return (
    <section className="membership-section" aria-labelledby="membership-benefits-title">
      <SectionHeader
        title={t("benefits.sectionTitle")}
        description={t("benefits.sectionDescription")}
      />
      <div className="membership-benefits-grid">
        {MEMBERSHIP_BENEFIT_IDS.map((id) => (
          <Card key={id} className="membership-benefits-grid__item">
            <h3 className="membership-info-card__title">{t(`benefits.items.${id}.title`)}</h3>
            <p className="membership-info-card__body">{t(`benefits.items.${id}.body`)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
