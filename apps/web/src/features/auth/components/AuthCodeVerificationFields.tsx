"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import {
  formatCountdownLabel,
  getAuthCodeRateLimitDetails,
  type AuthCodeRateLimitDetails,
} from "../lib/auth-code-rate-limit";
import {
  AUTH_INCORRECT_CODE_MESSAGE,
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

function formatRateLimitTimeLabel(
  retryAfterSeconds: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (retryAfterSeconds >= 60) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return minutes === 1 ? t("oneMinute") : t("nMinutes", { count: minutes });
  }

  return t("nSeconds", { count: Math.max(1, retryAfterSeconds) });
}

function formatTranslatedRateLimitMessage(
  details: AuthCodeRateLimitDetails,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (details.limitType === "cooldown") {
    return t("requestAnotherCodeIn", {
      time: formatCountdownLabel(details.retryAfterSeconds),
    });
  }

  return t("tooManyCodesTryAgainIn", {
    time: formatRateLimitTimeLabel(details.retryAfterSeconds, t),
  });
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
  const t = useTranslations("auth");
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

  function displayFieldError(message: string): string {
    if (message === AUTH_INCORRECT_CODE_MESSAGE || isIncorrectCodeMessage(message)) {
      return t("incorrectCode");
    }
    return message;
  }

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
        setSuccessMessage(t("newCodeSentUseRecent"));
        setSuccessDetail(t("previousCodeInvalid"));
      } else {
        setFieldError(t("couldNotSendNewCode"));
        setDeliveryFailureDetail(t("previousCodeStillUsable"));
      }
    } catch (resendError) {
      const rateLimit = getAuthCodeRateLimitDetails(resendError);
      const message = formatAuthFormError(resendError);

      if (rateLimit) {
        setRateLimitUntilMs(Date.now() + rateLimit.retryAfterSeconds * 1000);
        setCooldownDetail(formatTranslatedRateLimitMessage(rateLimit, t));
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
    return <p>{t("loadingVerification")}</p>;
  }

  const resendDisabled = cooldownActive || resending || submitting;

  return (
    <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
      <p>{copy.title}</p>
      <p className="auth-form__intro">
        {emailSent ? copy.introPrefix : t("enterCodeFor")}{" "}
        <strong>{maskedEmail ?? t("yourEmailAddress")}</strong>.
      </p>
      {showDevOutboxNote && !emailSent ? (
        <AuthFeedbackMessage variant="info" title={t("developmentMode")}>
          <p>{t("developmentOutboxNote")}</p>
        </AuthFeedbackMessage>
      ) : null}

      {!loadingStatus && !emailSent && !showDevOutboxNote ? (
        <AuthFeedbackMessage variant="warning" title={t("emailNotDelivered")}>
          <p>{copy.deliveryFailureMessage}</p>
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
          <AuthFeedbackMessage id="auth-code-error" variant="error" title={t("verificationFailed")}>
            <p>{displayFieldError(fieldError)}</p>
          </AuthFeedbackMessage>
        ) : null}

        {successMessage ? (
          <AuthFeedbackMessage variant="success" title={t("codeSent")}>
            <p>{successMessage}</p>
            {successDetail ? <p>{successDetail}</p> : null}
          </AuthFeedbackMessage>
        ) : null}

        {fieldError && deliveryFailureDetail ? (
          <AuthFeedbackMessage variant="info" title={t("previousCodeStillValid")}>
            <p>{deliveryFailureDetail}</p>
          </AuthFeedbackMessage>
        ) : null}

        {cooldownActive ? (
          <AuthFeedbackMessage variant="warning" title={t("waitBeforeAnotherCode")}>
            {countdownLabel ? (
              <p>{t("requestAnotherCodeIn", { time: countdownLabel })}</p>
            ) : null}
            {cooldownDetail ? <p>{cooldownDetail}</p> : null}
            {!countdownLabel && !cooldownDetail ? <p>{t("waitBeforeAnotherCode")}</p> : null}
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
          {resending ? t("sending") : t("resendCode")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onCancel()}>
          {copy.cancelLabel}
        </Button>
      </div>
    </form>
  );
}
