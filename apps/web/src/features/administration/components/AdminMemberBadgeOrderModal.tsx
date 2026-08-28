"use client";

import type { AdminMemberBadgeOrderDetail } from "@hu/types";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  emailAdminMemberBadgeLabel,
  fetchAdminMemberBadgeOrder,
  patchAdminMemberBadgeFulfillment,
  printAdminMemberBadgeLabel,
} from "../admin-member-badge-order-api";
import { AdminMemberBadgeFulfillmentProgress } from "./AdminMemberBadgeFulfillmentProgress";

import "../../../design-system/components/confirm-dialog.css";
import "./admin-member-badge-order.css";

interface AdminMemberBadgeOrderModalProps {
  applicationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPaymentStatus(status: string): string {
  if (status === "paid") {
    return "Paid";
  }
  if (status === "refunded") {
    return "Refunded";
  }
  return "Unpaid";
}

function formatFulfillmentStatus(order: AdminMemberBadgeOrderDetail): string {
  if (order.delivered || order.fulfillmentStatus === "completed") {
    return "Delivered";
  }
  if (order.shipped || order.fulfillmentStatus === "shipped") {
    return "Shipped";
  }
  if (order.fulfillmentStatus === "preparing") {
    return "Preparing";
  }
  if (order.fulfillmentStatus === "awaiting_fulfillment") {
    return "Awaiting fulfillment";
  }
  return "Not ready";
}

/**
 * Pack 25D — Admin Member Badge Order fulfillment dialog.
 */
export function AdminMemberBadgeOrderModal({
  applicationId,
  isOpen,
  onClose,
  onUpdated,
}: AdminMemberBadgeOrderModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [order, setOrder] = useState<AdminMemberBadgeOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"shipped" | "delivered" | "print" | "email" | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], textarea, input",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !applicationId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionMessage(null);

    void fetchAdminMemberBadgeOrder(applicationId)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOrder(null);
          setError(
            isForbiddenError(err)
              ? "Administrator access is required to view Member Badge Orders."
              : formatAuthFormError(err),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function refreshOrder() {
    const refreshed = await fetchAdminMemberBadgeOrder(applicationId);
    setOrder(refreshed);
    onUpdated?.();
  }

  async function handleToggleShipped() {
    if (!order) {
      return;
    }
    setBusy("shipped");
    setError(null);
    try {
      const next = await patchAdminMemberBadgeFulfillment(applicationId, {
        shipped: !order.shipped,
      });
      setOrder(next);
      setActionMessage(next.shipped ? "Marked as Shipped." : "Shipped marker removed.");
      onUpdated?.();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleDelivered() {
    if (!order) {
      return;
    }
    setBusy("delivered");
    setError(null);
    try {
      const next = await patchAdminMemberBadgeFulfillment(applicationId, {
        delivered: !order.delivered,
      });
      setOrder(next);
      setActionMessage(next.delivered ? "Marked as Delivered." : "Delivered marker removed.");
      onUpdated?.();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePrintLabel() {
    setBusy("print");
    setError(null);
    try {
      await printAdminMemberBadgeLabel(applicationId);
      setActionMessage("Shipping label opened for printing.");
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailLabel() {
    setBusy("email");
    setError(null);
    try {
      const result = await emailAdminMemberBadgeLabel(applicationId);
      setActionMessage(result.message || (result.queued ? "Label email queued." : "Label email sent."));
      await refreshOrder();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusy(null);
    }
  }

  const address = order?.shippingAddress;

  return (
    <div className="hu-confirm-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="hu-confirm-dialog admin-member-badge-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="hu-heading-3">
          Member Badge Order
        </h2>
        <p id={descriptionId} className="hu-caption">
          Review payment, private delivery address, and fulfillment markers for this Member Badge
          order.
        </p>

        {loading ? <p className="hu-body">Loading order…</p> : null}
        {error ? <StatusBanner title="Order unavailable" message={error} /> : null}
        {actionMessage ? (
          <StatusBanner title="Fulfillment update" message={actionMessage} />
        ) : null}

        {order ? (
          <div className="admin-member-badge-order-modal__body">
            <section className="admin-member-badge-order-modal__section" aria-labelledby="mba-order">
              <h3 id="mba-order" className="hu-heading-4">
                Order
              </h3>
              <dl className="admin-member-badge-order-modal__meta">
                <div>
                  <dt>Participant</dt>
                  <dd>
                    {order.participantDisplayName}
                    <span className="hu-caption admin-member-badge-order-modal__email">
                      {order.email}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Member Number</dt>
                  <dd>{order.memberNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt>Order reference</dt>
                  <dd>{order.lookupReference}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(order.createdAt)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDateTime(order.paidAt)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="admin-member-badge-order-modal__section"
              aria-labelledby="mba-payment"
            >
              <h3 id="mba-payment" className="hu-heading-4">
                Payment
              </h3>
              <dl className="admin-member-badge-order-modal__meta">
                <div>
                  <dt>Amount</dt>
                  <dd>{order.priceLabel}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{order.currency.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Payment status</dt>
                  <dd>{formatPaymentStatus(order.paymentStatus)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="admin-member-badge-order-modal__section"
              aria-labelledby="mba-delivery"
            >
              <h3 id="mba-delivery" className="hu-heading-4">
                Delivery
              </h3>
              {address ? (
                <dl className="admin-member-badge-order-modal__meta admin-member-badge-order-modal__meta--delivery">
                  <div>
                    <dt>Recipient</dt>
                    <dd>{address.recipientName}</dd>
                  </div>
                  <div>
                    <dt>Address line 1</dt>
                    <dd>{address.addressLine1}</dd>
                  </div>
                  {address.addressLine2 ? (
                    <div>
                      <dt>Address line 2</dt>
                      <dd>{address.addressLine2}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>City</dt>
                    <dd>{address.city}</dd>
                  </div>
                  <div>
                    <dt>Province / State / Region</dt>
                    <dd>{address.provinceStateRegion}</dd>
                  </div>
                  <div>
                    <dt>Postal / ZIP</dt>
                    <dd>{address.postalCode}</dd>
                  </div>
                  <div>
                    <dt>Country</dt>
                    <dd>{address.country}</dd>
                  </div>
                  {address.phone ? (
                    <div>
                      <dt>Phone</dt>
                      <dd>{address.phone}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="hu-caption">Delivery address unavailable.</p>
              )}
            </section>

            <section
              className="admin-member-badge-order-modal__section"
              aria-labelledby="mba-fulfillment"
            >
              <h3 id="mba-fulfillment" className="hu-heading-4">
                Fulfillment
              </h3>
              <p className="hu-body admin-member-badge-order-modal__state">
                Current state: <strong>{formatFulfillmentStatus(order)}</strong>
              </p>
              <div className="admin-member-badge-order-modal__markers">
                <Button
                  type="button"
                  variant={order.shipped ? "primary" : "secondary"}
                  aria-pressed={order.shipped}
                  disabled={busy !== null}
                  className={
                    order.shipped
                      ? "admin-member-badge-order-modal__marker--selected"
                      : undefined
                  }
                  onClick={() => void handleToggleShipped()}
                >
                  {busy === "shipped"
                    ? "Updating…"
                    : order.shipped
                      ? "Shipped"
                      : "Mark as Shipped"}
                </Button>
                <Button
                  type="button"
                  variant={order.delivered ? "primary" : "secondary"}
                  aria-pressed={order.delivered}
                  disabled={busy !== null}
                  className={
                    order.delivered
                      ? "admin-member-badge-order-modal__marker--selected"
                      : undefined
                  }
                  onClick={() => void handleToggleDelivered()}
                >
                  {busy === "delivered"
                    ? "Updating…"
                    : order.delivered
                      ? "Delivered"
                      : "Mark as Delivered"}
                </Button>
              </div>

              <AdminMemberBadgeFulfillmentProgress
                fulfillmentStatus={order.fulfillmentStatus}
                shipped={order.shipped}
                delivered={order.delivered}
              />

              <div className="admin-member-badge-order-modal__label-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void handlePrintLabel()}
                >
                  {busy === "print" ? "Opening…" : "Print Label"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void handleEmailLabel()}
                >
                  {busy === "email" ? "Sending…" : "Email Label"}
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="hu-confirm-dialog__actions">
          <Button type="button" variant="tertiary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
