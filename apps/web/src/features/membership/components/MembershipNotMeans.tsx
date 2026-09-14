import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_NOT_MEANS_IDS } from "../membership.constants";

export function MembershipNotMeans() {
  const t = useTranslations("membershipPublic");

  return (
    <section className="membership-section" aria-labelledby="membership-not-means-title">
      <SectionHeader
        title={t("notMeans.sectionTitle")}
        description={t("notMeans.sectionDescription")}
      />
      <div className="membership-info-grid membership-info-grid--neutral">
        {MEMBERSHIP_NOT_MEANS_IDS.map((id) => (
          <Card key={id} className="membership-info-card membership-info-card--neutral">
            <p className="membership-info-card__body">
              {t("notMeans.prefix", { item: t(`notMeans.items.${id}`) })}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
