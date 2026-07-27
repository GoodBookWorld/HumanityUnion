"use client";

import { useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  confirmDisableLoginTwoStep,
  confirmEnableLoginTwoStep,
  resendLoginTwoStepSettingCode,
  startDisableLoginTwoStep,
  startEnableLoginTwoStep,
} from "../auth-api";
import { normalizeIncorrectCodeMessage } from "../lib/auth-feedback-messages";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./account-panel.css";

interface AccountSecuritySectionProps {
  user: AuthUserPublic;
  onUserUpdated: (user: AuthUserPublic) => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function AccountSecuritySection({
  user,
  onUserUpdated,
  onMessage,
  onError,
}: AccountSecuritySectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailConfirmed = user.emailVerificationStatus === "verified";
  const twoStepEnabled = user.loginEmailTwoStepEnabled === true;

  function resetFlow() {
    setPendingAction(null);
    setCurrentPassword("");
    setVerificationCode("");
    setLocalMessage(null);
    setLocalError(null);
  }

  async function handleStart(action: "enable" | "disable") {
    setSubmitting(true);
    onMessage(null);
    onError(null);
    setLocalMessage(null);
    setLocalError(null);

    try {
      if (action === "enable") {
        await startEnableLoginTwoStep(currentPassword);
      } else {
        await startDisableLoginTwoStep(currentPassword);
      }

      setPendingAction(action);
      const message = "We sent a six-digit code to your confirmed email address.";
      setLocalMessage(message);
      onMessage(message);
    } catch (startError) {
      const error = formatAuthFormError(startError);
      setLocalError(error);
      onError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!pendingAction) {
      return;
    }

    setSubmitting(true);
    onMessage(null);
    onError(null);
    setLocalMessage(null);
    setLocalError(null);

    try {
      const updated =
        pendingAction === "enable"
          ? await confirmEnableLoginTwoStep(verificationCode)
          : await confirmDisableLoginTwoStep(verificationCode);

      onUserUpdated(updated);
      resetFlow();
      const message =
        pendingAction === "enable"
          ? "Two-Step Login enabled successfully."
          : "Two-Step Login disabled successfully.";
      setLocalMessage(message);
      onMessage(message);
    } catch (confirmError) {
      const error = normalizeIncorrectCodeMessage(formatAuthFormError(confirmError));
      setLocalError(error);
      onError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!pendingAction) {
      return;
    }

    setSubmitting(true);
    onError(null);
    setLocalError(null);

    try {
      await resendLoginTwoStepSettingCode(pendingAction);
      const message = "A new verification code has been sent.";
      setLocalMessage(message);
      onMessage(message);
    } catch (resendError) {
      const error = formatAuthFormError(resendError);
      setLocalError(error);
      onError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProfileSection title="Account Security">
      <ProfileField label="Email confirmed" value={emailConfirmed ? "Yes" : "No"} />
      <ProfileField
        label="Two-Step Login by Email"
        value={twoStepEnabled ? "Enabled" : "Disabled"}
      />
      <p className="account-panel__help">
        Two-Step Login adds an email code after your password when you sign in. It confirms access
        to your email account. It is not identity verification or Humanity Union membership.
      </p>

      {!emailConfirmed ? (
        <p className="account-panel__help">Confirm your email before enabling Two-Step Login.</p>
      ) : pendingAction ? (
        <div className="account-panel__form">
          <label className="account-panel__field" htmlFor="two-step-setting-code">
            <span>Verification code</span>
            <input
              id="two-step-setting-code"
              className="auth-form__code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => {
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (localError) {
                  setLocalError(null);
                }
              }}
            />
          </label>
          <div className="auth-form__feedback-stack">
            {localError ? (
              <AuthFeedbackMessage variant="error" title="Security action failed">
                <p>{localError}</p>
              </AuthFeedbackMessage>
            ) : null}
            {localMessage ? (
              <AuthFeedbackMessage variant="success" title="Verification code sent">
                <p>{localMessage}</p>
              </AuthFeedbackMessage>
            ) : null}
          </div>
          <div className="account-panel__actions">
            <Button
              variant="primary"
              disabled={submitting || verificationCode.length !== 6}
              onClick={() => void handleConfirm()}
            >
              {pendingAction === "enable" ? "Confirm Enable" : "Confirm Disable"}
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => void handleResend()}>
              Resend Code
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={resetFlow}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="account-panel__form">
          <label className="account-panel__field" htmlFor="two-step-current-password">
            <span>Current password</span>
            <PasswordInput
              id="two-step-current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          </label>
          <div className="account-panel__actions">
            {!twoStepEnabled ? (
              <Button
                variant="primary"
                disabled={submitting || !currentPassword}
                onClick={() => void handleStart("enable")}
              >
                Enable Two-Step Login
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={submitting || !currentPassword}
                onClick={() => void handleStart("disable")}
              >
                Disable Two-Step Login
              </Button>
            )}
          </div>
        </div>
      )}
    </ProfileSection>
  );
}
