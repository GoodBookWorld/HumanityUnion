"use client";

import type { MemberBadgeApplicationShippingAddress } from "@hu/types";
import {
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { trapTabKey } from "../../../design-system/focus-trap";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  continueMyMemberBadgeApplicationPayment,
  saveMyMemberBadgeApplication,
} from "../member-badge-application-api";
import { MEMBER_BADGE_PRODUCT } from "../membership.constants";

import { MemberBadgeIcon } from "./MemberBadgeIcon";

import "../../../design-system/components/confirm-dialog.css";
import "./member-badge-application.css";

const EMPTY_ADDRESS: MemberBadgeApplicationShippingAddress = {
  recipientName: "",
  addressLine1: "",
  addressLine2: null,
  city: "",
  provinceStateRegion: "",
  postalCode: "",
  country: "",
  phone: null,
};

interface MemberBadgeApplicationModalProps {
  isOpen: boolean;
  initialAddress?: MemberBadgeApplicationShippingAddress | null;
  onClose: () => void;
  onSaved: (applicationUpdated: boolean) => void;
}

export function MemberBadgeApplicationModal({
  isOpen,
  initialAddress,
  onClose,
  onSaved,
}: MemberBadgeApplicationModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [form, setForm] = useState<MemberBadgeApplicationShippingAddress>(EMPTY_ADDRESS);
  const [busy, setBusy] = useState<"save" | "payment" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(initialAddress ?? EMPTY_ADDRESS);
    setError(null);
    setPaymentMessage(null);
    setBusy(null);

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea",
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
  }, [isOpen, initialAddress, onClose]);

  if (!isOpen) {
    return null;
  }

  function updateField<K extends keyof MemberBadgeApplicationShippingAddress>(
    key: K,
    value: MemberBadgeApplicationShippingAddress[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildAddressPayload(): MemberBadgeApplicationShippingAddress {
    return {
      recipientName: form.recipientName.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2?.trim() ? form.addressLine2.trim() : null,
      city: form.city.trim(),
      provinceStateRegion: form.provinceStateRegion.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      phone: form.phone?.trim() ? form.phone.trim() : null,
    };
  }

  async function handleSaveForLater() {
    setBusy("save");
    setError(null);
    setPaymentMessage(null);

    try {
      await saveMyMemberBadgeApplication(buildAddressPayload());
      onSaved(true);
      onClose();
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setBusy(null);
    }
  }

  async function handleContinueToPayment() {
    setBusy("payment");
    setError(null);
    setPaymentMessage(null);

    try {
      const result = await continueMyMemberBadgeApplicationPayment(buildAddressPayload());
      onSaved(true);

      if (result.checkoutReady && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      setPaymentMessage(result.message);
    } catch (paymentError) {
      setError(formatAuthFormError(paymentError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="hu-confirm-dialog__backdrop member-badge-application-modal__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="hu-confirm-dialog member-badge-application-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="member-badge-application-modal__scroll">
          <header className="member-badge-application-modal__header">
            <MemberBadgeIcon size="medium" decorative />
            <div>
              <h2 id={titleId} className="member-badge-application-modal__title">
                Member Badge Application
              </h2>
              <p id={descriptionId} className="member-badge-application-modal__intro">
                {MEMBER_BADGE_PRODUCT.applicationIntro}
              </p>
            </div>
          </header>

          <div className="member-badge-application-modal__price" aria-label="Badge contribution">
            <p className="member-badge-application-modal__product">Official Member Badge</p>
            <p className="member-badge-application-modal__amount">
              {MEMBER_BADGE_APPLICATION_PRICE_LABEL}
            </p>
            <p className="member-badge-application-modal__delivery">
              {MEMBER_BADGE_APPLICATION_DELIVERY_LABEL}
            </p>
          </div>

          <form
            className="member-badge-application-modal__form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleContinueToPayment();
            }}
          >
            <label className="member-badge-application-modal__field">
              <span>Recipient name *</span>
              <input
                name="recipientName"
                autoComplete="name"
                required
                value={form.recipientName}
                onChange={(event) => updateField("recipientName", event.target.value)}
              />
            </label>
            <label className="member-badge-application-modal__field">
              <span>Address line 1 *</span>
              <input
                name="addressLine1"
                autoComplete="address-line1"
                required
                value={form.addressLine1}
                onChange={(event) => updateField("addressLine1", event.target.value)}
              />
            </label>
            <label className="member-badge-application-modal__field">
              <span>Address line 2</span>
              <input
                name="addressLine2"
                autoComplete="address-line2"
                value={form.addressLine2 ?? ""}
                onChange={(event) => updateField("addressLine2", event.target.value || null)}
              />
            </label>
            <div className="member-badge-application-modal__row">
              <label className="member-badge-application-modal__field">
                <span>City *</span>
                <input
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                />
              </label>
              <label className="member-badge-application-modal__field">
                <span>Province / State / Region *</span>
                <input
                  name="provinceStateRegion"
                  autoComplete="address-level1"
                  required
                  value={form.provinceStateRegion}
                  onChange={(event) => updateField("provinceStateRegion", event.target.value)}
                />
              </label>
            </div>
            <div className="member-badge-application-modal__row">
              <label className="member-badge-application-modal__field">
                <span>Postal / ZIP code *</span>
                <input
                  name="postalCode"
                  autoComplete="postal-code"
                  required
                  value={form.postalCode}
                  onChange={(event) => updateField("postalCode", event.target.value)}
                />
              </label>
              <label className="member-badge-application-modal__field">
                <span>Country *</span>
                <input
                  name="country"
                  autoComplete="country-name"
                  required
                  value={form.country}
                  onChange={(event) => updateField("country", event.target.value)}
                />
              </label>
            </div>
            <label className="member-badge-application-modal__field">
              <span>Phone (optional)</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone ?? ""}
                onChange={(event) => updateField("phone", event.target.value || null)}
              />
            </label>

            {error ? (
              <p className="member-badge-application-modal__error" role="alert">
                {error}
              </p>
            ) : null}
            {paymentMessage ? (
              <p className="member-badge-application-modal__status" role="status">
                {paymentMessage}
              </p>
            ) : null}
          </form>
        </div>

        <footer className="member-badge-application-modal__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void handleSaveForLater()}
          >
            {busy === "save" ? "Saving…" : "Save for Later"}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy !== null}
            onClick={() => void handleContinueToPayment()}
          >
            {busy === "payment" ? "Continuing…" : "Continue to Payment"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
