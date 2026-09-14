"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AuthCodeVerificationFields } from "./AuthCodeVerificationFields";

import "./auth-form.css";

export function ConfirmEmailForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getEmailConfirmationStatus();

      if (status.status === "confirmed") {
        clearPendingConfirmationContext();
        router.replace("/account?confirmed=1");
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
  }, [router]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleSubmit(code: string) {
    await confirmEmailCode(code);
    clearPendingConfirmationContext();
    router.push("/account?confirmed=1");
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
    router.push("/register");
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
