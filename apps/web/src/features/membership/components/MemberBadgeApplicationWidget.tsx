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
    return "Completed";
  }
  return "Not ready";
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
        <dl className="member-badge-application-widget__fields">
          <div>
            <dt>Recipient</dt>
            <dd>{address.recipientName}</dd>
          </div>
          <div>
            <dt>Delivery address</dt>
            <dd>
              <span>{address.addressLine1}</span>
              {address.addressLine2 ? (
                <>
                  <br />
                  <span>{address.addressLine2}</span>
                </>
              ) : null}
              <br />
              <span>
                {address.city}, {address.provinceStateRegion} {address.postalCode}
              </span>
              <br />
              <span>{address.country}</span>
            </dd>
          </div>
          <div>
            <dt>Badge contribution</dt>
            <dd>
              {MEMBER_BADGE_APPLICATION_PRICE_LABEL}
              <span className="member-badge-application-widget__muted">
                {" "}
                · {MEMBER_BADGE_APPLICATION_DELIVERY_LABEL}
              </span>
            </dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{formatPaymentLabel(application.paymentStatus)}</dd>
          </div>
          <div>
            <dt>Fulfillment</dt>
            <dd>
              {formatFulfillmentLabel(application.fulfillmentStatus, application.paymentStatus)}
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
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
