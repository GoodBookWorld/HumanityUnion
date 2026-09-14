"use client";

import type { MemberBadgeApplicationDetail } from "@hu/types";
import { MEMBER_BADGE_APPLICATION_PRICE_LABEL } from "@hu/types";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";

import "./member-badge-application.css";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDeliveryAddress(address: MemberBadgeApplicationDetail["shippingAddress"]): string {
  const lines = [
    address.addressLine1,
    address.addressLine2,
    `${address.city}, ${address.provinceStateRegion} ${address.postalCode}`,
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return lines.join("\n");
}

interface MemberBadgeApplicationWidgetProps {
  application: MemberBadgeApplicationDetail;
  onEdit: () => void;
}

export function MemberBadgeApplicationWidget({
  application,
  onEdit,
}: MemberBadgeApplicationWidgetProps) {
  const t = useTranslations("membershipPublic");
  const address = application.shippingAddress;
  const canEdit = application.paymentStatus === "unpaid";

  const paymentLabel = t(`badgeApplication.paymentStatus.${application.paymentStatus}`);

  let fulfillmentLabel: string;
  if (application.paymentStatus === "unpaid") {
    fulfillmentLabel = t("badgeApplication.fulfillmentStatus.awaitingPayment");
  } else if (application.paymentStatus === "refunded") {
    fulfillmentLabel = t("badgeApplication.fulfillmentStatus.paymentRefunded");
  } else if (
    application.fulfillmentStatus === "awaiting_fulfillment" ||
    application.fulfillmentStatus === "preparing" ||
    application.fulfillmentStatus === "shipped" ||
    application.fulfillmentStatus === "completed"
  ) {
    fulfillmentLabel = t(`badgeApplication.fulfillmentStatus.${application.fulfillmentStatus}`);
  } else {
    fulfillmentLabel = t("badgeApplication.fulfillmentStatus.notReady");
  }

  return (
    <section
      className="membership-success-section member-badge-application-widget"
      aria-labelledby="member-badge-application-widget-title"
    >
      <SectionHeader title={t("badgeApplication.widgetTitle")} />
      <Card className="member-badge-application-widget__card">
        <dl className="member-badge-application-widget__fields member-badge-application-widget__fields--horizontal">
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.recipient")}</dt>
            <dd>{address.recipientName}</dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.deliveryAddress")}</dt>
            <dd className="member-badge-application-widget__address">
              {formatDeliveryAddress(address)}
            </dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.contribution")}</dt>
            <dd>
              {MEMBER_BADGE_APPLICATION_PRICE_LABEL}
              <span className="member-badge-application-widget__muted">
                {" "}
                · {t("badgeProduct.deliveryIncluded")}
              </span>
            </dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.payment")}</dt>
            <dd>{paymentLabel}</dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.fulfillment")}</dt>
            <dd>{fulfillmentLabel}</dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>{t("badgeApplication.updated")}</dt>
            <dd>{formatUpdatedAt(application.updatedAt)}</dd>
          </div>
        </dl>
        {canEdit ? (
          <div className="member-badge-application-widget__actions">
            <Button type="button" variant="secondary" onClick={onEdit}>
              {t("badgeApplication.edit")}
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
