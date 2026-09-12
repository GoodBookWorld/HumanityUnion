"use client";

import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";

export function MembershipSuccessPermanentNote() {
  const t = useTranslations("membershipPublic.successPage");

  return (
    <section
      className="membership-success-section"
      aria-labelledby="membership-success-permanent-title"
    >
      <Card className="membership-success-permanent">
        <h2 id="membership-success-permanent-title" className="membership-success-permanent__title">
          {t("permanentTitle")}
        </h2>
        <p>{t("permanentBody")}</p>
      </Card>
    </section>
  );
}
