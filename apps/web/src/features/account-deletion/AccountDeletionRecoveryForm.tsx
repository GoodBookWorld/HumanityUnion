"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../design-system/components/Button";
import { Card } from "../../design-system/components/Card";
import { PasswordInput } from "../../design-system/components/PasswordInput";
import { AuthFeedbackMessage } from "../auth/components/AuthFeedbackMessage";
import {
  confirmAccountDeletionRecovery,
  requestAccountDeletionRecovery,
} from "../auth/auth-api";

/**
 * Public recovery. No session is created. The same message is shown for every
 * email so the form does not reveal whether an account exists.
 */
export function AccountDeletionRecoveryForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeStep, setCodeStep] = useState(false);
  const [restored, setRestored] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestAccountDeletionRecovery(email);
      setCodeStep(true);
      setMessage(t("recoverySent"));
    } catch {
      setError(t("recoveryFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await confirmAccountDeletionRecovery({
        email,
        currentPassword: password,
        code,
      });
      setRestored(true);
    } catch {
      setError(t("recoveryFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (restored) {
    return (
      <Card>
        <AuthFeedbackMessage variant="success" title={t("recoveryTitle")}>
          <p>{t("recoverySuccess")}</p>
        </AuthFeedbackMessage>
        <div className="auth-form__actions">
          <Button href="/login" variant="primary">
            {t("recoverySignIn")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {message ? <p>{message}</p> : null}
      {error ? (
        <AuthFeedbackMessage variant="error" title={t("securityActionFailed")}>
          <p>{error}</p>
        </AuthFeedbackMessage>
      ) : null}
      {!codeStep ? (
        <form className="auth-form" onSubmit={(event) => void handleRequest(event)}>
          <label className="auth-form__field" htmlFor="recovery-email">
            <span>{t("recoveryEmail")}</span>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <div className="auth-form__actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {t("recoverySendCode")}
            </Button>
          </div>
        </form>
      ) : (
        <form className="auth-form" onSubmit={(event) => void handleConfirm(event)}>
          <label className="auth-form__field" htmlFor="recovery-password">
            <span>{t("recoveryPassword")}</span>
            <PasswordInput
              id="recovery-password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />
          </label>
          <label className="auth-form__field" htmlFor="recovery-code">
            <span>{t("recoveryCode")}</span>
            <input
              id="recovery-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          <div className="auth-form__actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {t("recoverySubmit")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
