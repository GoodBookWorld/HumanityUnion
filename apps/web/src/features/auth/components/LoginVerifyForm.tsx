"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), "/workspace");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(true);
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
          title: "Check your email",
          introPrefix: "Enter the six-digit code sent to",
          codeLabel: "Email code",
          submitLabel: "Complete Login",
          submittingLabel: "Completing...",
          resendSuccessMessage: "A new login code has been sent.",
          resendSuccessWithInvalidationMessage:
            "A new login code has been sent. The previous code is no longer valid.",
          deliveryFailureMessage:
            "We could not send the confirmation code. Please try again shortly.",
          resendDeliveryFailureMessage:
            "We could not send a new login code. Your previous valid code remains available.",
          cancelLabel: "Cancel and return to Login",
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

export function LoginVerifyForm() {
  return (
    <Suspense fallback={<Card>Loading login verification...</Card>}>
      <LoginVerifyFormFields />
    </Suspense>
  );
}
