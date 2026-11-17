"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import {
  cancelEmailConfirmation,
  confirmEmailCode,
  getEmailConfirmationStatus,
  resendEmailConfirmationCode,
} from "../auth-api";
import {
  clearPendingConfirmationContext,
  getPendingConfirmationMaskedEmail,
} from "../auth-pending-confirmation-store";
import { buildAuthPathWithReturnTo } from "../lib/build-auth-return-path";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { AuthCodeVerificationFields } from "./AuthCodeVerificationFields";

import "./auth-form.css";

function ConfirmEmailFormFields() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo");
  const hasReturnTo = Boolean(rawReturnTo);
  const returnTo = resolveSafeReturnTo(rawReturnTo, "/workspace");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const completedDestination = hasReturnTo ? returnTo : "/account?confirmed=1";
  const cancelDestination = hasReturnTo
    ? buildAuthPathWithReturnTo("/register", returnTo)
    : "/register";

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getEmailConfirmationStatus();

      if (status.status === "confirmed") {
        clearPendingConfirmationContext();
        router.replace(completedDestination);
        router.refresh();
        return;
      }

      setMaskedEmail(status.maskedEmail);
      setEmailSent(status.emailSent);
      setResendAvailableAt(status.resendAvailableAt);
    } catch {
      const storedMaskedEmail = getPendingConfirmationMaskedEmail();
      setMaskedEmail(storedMaskedEmail);
    } finally {
      setLoadingStatus(false);
    }
  }, [completedDestination, router]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleSubmit(code: string) {
    await confirmEmailCode(code);
    clearPendingConfirmationContext();
    router.push(completedDestination);
    router.refresh();
  }

  async function handleResend() {
    const status = await resendEmailConfirmationCode();
    setMaskedEmail(status.maskedEmail);
    setEmailSent(status.emailSent);
    setResendAvailableAt(status.resendAvailableAt);
    return {
      emailSent: status.emailSent,
      resendAvailableAt: status.resendAvailableAt,
    };
  }

  async function handleCancel() {
    await cancelEmailConfirmation();
    clearPendingConfirmationContext();
    router.push(cancelDestination);
    router.refresh();
  }

  return (
    <Card>
      <AuthCodeVerificationFields
        copy={{
          title: t("confirmYourEmail"),
          introPrefix: t("confirmEmailIntro"),
          codeLabel: t("confirmationCode"),
          submitLabel: t("confirmEmail"),
          submittingLabel: t("confirming"),
          resendSuccessMessage: t("newConfirmationCodeSent"),
          resendSuccessWithInvalidationMessage: t("newConfirmationCodeSentInvalidated"),
          deliveryFailureMessage: t("couldNotSendConfirmationCode"),
          resendDeliveryFailureMessage: t("couldNotSendNewConfirmationCode"),
          cancelLabel: t("returnToRegistration"),
        }}
        maskedEmail={maskedEmail}
        emailSent={emailSent}
        resendAvailableAt={resendAvailableAt}
        loadingStatus={loadingStatus}
        onSubmit={handleSubmit}
        onResend={handleResend}
        onCancel={() => void handleCancel()}
        showDevOutboxNote={process.env.NODE_ENV === "development"}
      />
    </Card>
  );
}

function ConfirmEmailFormFallback() {
  const t = useTranslations("auth");
  return <Card>{t("loadingLoginForm")}</Card>;
}

export function ConfirmEmailForm() {
  return (
    <Suspense fallback={<ConfirmEmailFormFallback />}>
      <ConfirmEmailFormFields />
    </Suspense>
  );
}
