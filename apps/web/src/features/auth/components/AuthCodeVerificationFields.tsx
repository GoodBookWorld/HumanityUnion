"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import {
  formatAuthCodeRateLimitMessage,
  formatCountdownLabel,
  getAuthCodeRateLimitDetails,
} from "../lib/auth-code-rate-limit";
import {
  isCooldownMessage,
  isIncorrectCodeMessage,
  normalizeIncorrectCodeMessage,
} from "../lib/auth-feedback-messages";
import { formatAuthFormError } from "../../../lib/api-client";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./auth-form.css";

export interface AuthCodeVerificationCopy {
  title: string;
  introPrefix: string;
  codeLabel: string;
  submitLabel: string;
  submittingLabel: string;
  resendSuccessMessage: string;
  resendSuccessWithInvalidationMessage: string;
  deliveryFailureMessage: string;
  resendDeliveryFailureMessage: string;
  cancelLabel: string;
}

interface AuthCodeVerificationFieldsProps {
  copy: AuthCodeVerificationCopy;
  maskedEmail: string | null;
  emailSent: boolean;
  resendAvailableAt: string | null;
  loadingStatus: boolean;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<{ emailSent: boolean; resendAvailableAt: string | null }>;
  onCancel: () => void | Promise<void>;
  showDevOutboxNote?: boolean;
}

function resolveCooldownUntilMs(
  resendAvailableAt: string | null,
  rateLimitUntilMs: number | null,
): number | null {
  const candidates = [
    rateLimitUntilMs,
    resendAvailableAt ? Date.parse(resendAvailableAt) : null,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function AuthCodeVerificationFields({
  copy,
  maskedEmail,
  emailSent,
  resendAvailableAt,
  loadingStatus,
  onSubmit,
  onResend,
  onCancel,
  showDevOutboxNote = false,
}: AuthCodeVerificationFieldsProps) {
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetail, setSuccessDetail] = useState<string | null>(null);
  const [deliveryFailureDetail, setDeliveryFailureDetail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [rateLimitUntilMs, setRateLimitUntilMs] = useState<number | null>(null);
  const [cooldownDetail, setCooldownDetail] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const cooldownUntilMs = resolveCooldownUntilMs(resendAvailableAt, rateLimitUntilMs);
  const cooldownActive = Boolean(cooldownUntilMs && cooldownUntilMs > Date.now());

  useEffect(() => {
    if (!cooldownUntilMs) {
      setCountdownLabel(null);
      return;
    }

    const updateCountdown = () => {
      const remainingSeconds = Math.ceil((cooldownUntilMs - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        setCountdownLabel(null);
        setCooldownDetail(null);
        return;
      }

      setCountdownLabel(formatCountdownLabel(remainingSeconds));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownUntilMs]);

  function handleCodeChange(value: string) {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
    setCode(digitsOnly);

    if (fieldError) {
      setFieldError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldError(null);
    setSuccessMessage(null);
    setSuccessDetail(null);
    setDeliveryFailureDetail(null);

    try {
      await onSubmit(code);
    } catch (submitError) {
      const message = normalizeIncorrectCodeMessage(formatAuthFormError(submitError));
      setFieldError(message);
      codeInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setSuccessMessage(null);
    setSuccessDetail(null);
    setDeliveryFailureDetail(null);
    setFieldError(null);
    setCooldownDetail(null);

    try {
      const status = await onResend();
      setRateLimitUntilMs(status.resendAvailableAt ? Date.parse(status.resendAvailableAt) : null);

      if (status.emailSent) {
        setSuccessMessage("A new code has been sent. Use the most recent email.");
        setSuccessDetail("The previous code is no longer valid.");
      } else {
        setFieldError("We could not send a new code. Please try again shortly.");
        setDeliveryFailureDetail("Your previous valid code can still be used.");
      }
    } catch (resendError) {
      const rateLimit = getAuthCodeRateLimitDetails(resendError);
      const message = formatAuthFormError(resendError);

      if (rateLimit) {
        setRateLimitUntilMs(Date.now() + rateLimit.retryAfterSeconds * 1000);
        setCooldownDetail(formatAuthCodeRateLimitMessage(rateLimit));
      } else if (isCooldownMessage(message)) {
        setCooldownDetail(null);
      } else if (isIncorrectCodeMessage(message)) {
        setFieldError(normalizeIncorrectCodeMessage(message));
      } else {
        setFieldError(message);
      }
    } finally {
      setResending(false);
    }
  }

  if (loadingStatus && !maskedEmail) {
    return <p>Loading verification...</p>;
  }

  const resendDisabled = cooldownActive || resending || submitting;

  return (
    <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
      <p>{copy.title}</p>
      <p className="auth-form__intro">
        {emailSent ? copy.introPrefix : "Enter the six-digit code for"}{" "}
        <strong>{maskedEmail ?? "your email address"}</strong>.
      </p>
      {showDevOutboxNote && !emailSent ? (
        <AuthFeedbackMessage variant="info" title="Development mode">
          <p>
            Development email provider is active. Check the local email outbox in API server logs.
          </p>
        </AuthFeedbackMessage>
      ) : null}

      <label className="auth-form__field" htmlFor="auth-code-input">
        <span>{copy.codeLabel}</span>
        <input
          ref={codeInputRef}
          id="auth-code-input"
          className="auth-form__code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "auth-code-error" : undefined}
        />
      </label>

      <div className="auth-form__feedback-stack">
        {fieldError ? (
          <AuthFeedbackMessage id="auth-code-error" variant="error" title="Verification failed">
            <p>{fieldError}</p>
          </AuthFeedbackMessage>
        ) : null}

        {successMessage ? (
          <AuthFeedbackMessage variant="success" title="Code sent">
            <p>{successMessage}</p>
            {successDetail ? <p>{successDetail}</p> : null}
          </AuthFeedbackMessage>
        ) : null}

        {fieldError && deliveryFailureDetail ? (
          <AuthFeedbackMessage variant="info" title="Previous code still valid">
            <p>{deliveryFailureDetail}</p>
          </AuthFeedbackMessage>
        ) : null}

        {cooldownActive ? (
          <AuthFeedbackMessage
            variant="warning"
            title="Please wait before requesting another code."
          >
            {countdownLabel ? <p>You can request another code in {countdownLabel}.</p> : null}
            {cooldownDetail ? <p>{cooldownDetail}</p> : null}
            {!countdownLabel && !cooldownDetail ? (
              <p>Please wait before requesting another code.</p>
            ) : null}
          </AuthFeedbackMessage>
        ) : null}
      </div>

      <div className="auth-form__actions">
        <Button type="submit" variant="primary" disabled={submitting || code.length !== 6}>
          {submitting ? copy.submittingLabel : copy.submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={resendDisabled}
          onClick={() => void handleResend()}
        >
          {resending ? "Sending..." : "Resend Code"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onCancel()}>
          {copy.cancelLabel}
        </Button>
      </div>
    </form>
  );
}
