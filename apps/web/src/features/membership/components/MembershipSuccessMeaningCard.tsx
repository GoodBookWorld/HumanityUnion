"use client";

import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

const SUCCESS_MEANING_POINT_IDS = [
  "support",
  "equal",
  "vote",
  "profile",
  "community",
] as const;

export function MembershipSuccessMeaningCard() {
  const t = useTranslations("membershipPublic.successPage");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <section
      className="membership-success-section"
      aria-labelledby="membership-success-meaning-title"
    >
      <SectionHeader title={t("meaningTitle")} />
      <Card>
        <ul className="membership-success-meaning__list">
          {SUCCESS_MEANING_POINT_IDS.map((id) => (
            <li key={id}>{t(`meaningPoints.${id}`, siteName)}</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
