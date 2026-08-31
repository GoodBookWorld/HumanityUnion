"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import {
  cancelLoginTwoStep,
  confirmLoginTwoStepCode,
  getLoginTwoStepStatus,
  resendLoginTwoStepCode,
} from "../auth-api";
import { clearPendingLoginTwoStepToken } from "../auth-pending-login-two-step-store";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { AuthCodeVerificationFields } from "./AuthCodeVerificationFields";

import "./auth-form.css";

function LoginVerifyFormFields() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), "/workspace");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getLoginTwoStepStatus();
      setMaskedEmail(status.maskedEmail);
      setEmailSent(status.emailSent);
      setResendAvailableAt(status.resendAvailableAt);
    } catch {
      // Status refresh errors are surfaced on submit/resend.
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleSubmit(code: string) {
    await confirmLoginTwoStepCode(code);
    clearPendingLoginTwoStepToken();
    router.push(returnTo);
    router.refresh();
  }

  async function handleResend() {
    const status = await resendLoginTwoStepCode();
    setMaskedEmail(status.maskedEmail);
    setEmailSent(status.emailSent);
    setResendAvailableAt(status.resendAvailableAt);
    return {
      emailSent: status.emailSent,
      resendAvailableAt: status.resendAvailableAt,
    };
  }

  async function handleCancel() {
    await cancelLoginTwoStep();
    clearPendingLoginTwoStepToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <Card>
      <AuthCodeVerificationFields
        copy={{
          title: t("checkYourEmail"),
          introPrefix: t("enterLoginCodeIntro"),
          codeLabel: t("emailCode"),
          submitLabel: t("completeLogin"),
          submittingLabel: t("completing"),
          resendSuccessMessage: t("newLoginCodeSent"),
          resendSuccessWithInvalidationMessage: t("newLoginCodeSentInvalidated"),
          deliveryFailureMessage: t("couldNotSendLoginCode"),
          resendDeliveryFailureMessage: t("couldNotSendNewLoginCode"),
          cancelLabel: t("cancelReturnToLogin"),
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

function LoginVerifyFormFallback() {
  const t = useTranslations("auth");
  return <Card>{t("loadingLoginVerification")}</Card>;
}

export function LoginVerifyForm() {
  return (
    <Suspense fallback={<LoginVerifyFormFallback />}>
      <LoginVerifyFormFields />
    </Suspense>
  );
}
