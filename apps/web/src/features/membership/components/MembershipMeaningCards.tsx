import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_MEANING_CARD_IDS } from "../membership.constants";

export function MembershipMeaningCards() {
  const t = useTranslations("membershipPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <section className="membership-section" aria-labelledby="membership-meaning-title">
      <SectionHeader
        title={t("meaning.sectionTitle")}
        description={t("meaning.sectionDescription", siteName)}
      />
      <div className="membership-info-grid">
        {MEMBERSHIP_MEANING_CARD_IDS.map((id) => (
          <Card key={id} className="membership-info-card">
            <h3 className="membership-info-card__title">{t(`meaning.cards.${id}.title`)}</h3>
            <p className="membership-info-card__body">{t(`meaning.cards.${id}.body`, siteName)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
