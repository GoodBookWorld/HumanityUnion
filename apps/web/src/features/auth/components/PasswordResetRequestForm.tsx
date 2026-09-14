"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { requestPasswordReset } from "../auth-api";

import "./auth-form.css";

export function PasswordResetRequestForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      await requestPasswordReset(email);
      setMessage(t("resetEmailSent"));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("unableToRequestReset"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="auth-form__field">
          <span>{t("email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={submitting}>
            {t("sendResetLink")}
          </Button>
          <Button href="/login">{t("backToLogin")}</Button>
        </div>
      </form>
    </Card>
  );
}
