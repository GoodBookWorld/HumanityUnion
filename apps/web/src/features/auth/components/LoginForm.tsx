"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import { login } from "../auth-api";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./auth-form.css";

function LoginFormFields() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), "/workspace");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await login({ email, password });

      if ("emailConfirmationRequired" in result && result.emailConfirmationRequired) {
        router.push("/confirm-email");
        router.refresh();
        return;
      }

      if ("twoStepRequired" in result && result.twoStepRequired) {
        router.push(`/login/verify?returnTo=${encodeURIComponent(returnTo)}`);
        router.refresh();
        return;
      }

      router.push(returnTo);
      router.refresh();
    } catch (submitError) {
      setError(formatAuthFormError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-form__field">
          <span>
            {t("email")} <span aria-hidden="true">*</span>
            <span className="hu-visually-hidden">{t("required")}</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="auth-form__field">
          <span>
            {t("password")} <span aria-hidden="true">*</span>
            <span className="hu-visually-hidden">{t("required")}</span>
          </span>
          <PasswordInput
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
        </label>
        {error ? (
          <AuthFeedbackMessage variant="error" title={t("signInFailed")}>
            <p>{error}</p>
          </AuthFeedbackMessage>
        ) : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t("signingIn") : t("logIn")}
          </Button>
          <Button href="/register">{t("createAccount")}</Button>
          <Button href="/password-reset">{t("forgotPassword")}</Button>
        </div>
      </form>
    </Card>
  );
}

function LoginFormFallback() {
  const t = useTranslations("auth");
  return <Card>{t("loadingLoginForm")}</Card>;
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormFields />
    </Suspense>
  );
}
