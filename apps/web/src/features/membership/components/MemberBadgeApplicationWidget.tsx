"use client";

import type { MemberBadgeApplicationDetail } from "@hu/types";
import {
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";

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

function formatPaymentLabel(status: MemberBadgeApplicationDetail["paymentStatus"]): string {
  if (status === "paid") {
    return "Paid";
  }
  if (status === "refunded") {
    return "Refunded";
  }
  return "Not paid";
}

function formatFulfillmentLabel(
  status: MemberBadgeApplicationDetail["fulfillmentStatus"],
  paymentStatus: MemberBadgeApplicationDetail["paymentStatus"],
): string {
  if (paymentStatus === "unpaid") {
    return "Awaiting payment";
  }
  if (paymentStatus === "refunded") {
    return "Payment refunded";
  }
  if (status === "awaiting_fulfillment") {
    return "Awaiting fulfillment";
  }
  if (status === "preparing") {
    return "Preparing";
  }
  if (status === "shipped") {
    return "Shipped";
  }
  if (status === "completed") {
    return "Delivered";
  }
  return "Not ready";
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
  const address = application.shippingAddress;
  const canEdit = application.paymentStatus === "unpaid";

  return (
    <section
      className="membership-success-section member-badge-application-widget"
      aria-labelledby="member-badge-application-widget-title"
    >
      <SectionHeader title="My Member Badge Application" />
      <Card className="member-badge-application-widget__card">
        <dl className="member-badge-application-widget__fields member-badge-application-widget__fields--horizontal">
          <div className="member-badge-application-widget__field">
            <dt>Recipient</dt>
            <dd>{address.recipientName}</dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>Delivery Address</dt>
            <dd className="member-badge-application-widget__address">
              {formatDeliveryAddress(address)}
            </dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>Contribution</dt>
            <dd>
              {MEMBER_BADGE_APPLICATION_PRICE_LABEL}
              <span className="member-badge-application-widget__muted">
                {" "}
                · {MEMBER_BADGE_APPLICATION_DELIVERY_LABEL}
              </span>
            </dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>Payment</dt>
            <dd>{formatPaymentLabel(application.paymentStatus)}</dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>Fulfillment</dt>
            <dd>
              {formatFulfillmentLabel(application.fulfillmentStatus, application.paymentStatus)}
            </dd>
          </div>
          <div className="member-badge-application-widget__field">
            <dt>Updated</dt>
            <dd>{formatUpdatedAt(application.updatedAt)}</dd>
          </div>
        </dl>
        {canEdit ? (
          <div className="member-badge-application-widget__actions">
            <Button type="button" variant="secondary" onClick={onEdit}>
              Edit application
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
