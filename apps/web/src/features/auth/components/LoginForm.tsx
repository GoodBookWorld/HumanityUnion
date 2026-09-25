"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useCallback, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  TurnstileWidget,
  resolveTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from "../../security/turnstile/TurnstileWidget";
import { login } from "../auth-api";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./auth-form.css";

function LoginFormFields() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), "/workspace");
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKey = resolveTurnstileSiteKey();

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);

    // Submit control is disabled until a token exists; guard for race/expiry.
    if (!siteKey || !turnstileToken) {
      setSubmitting(false);
      resetTurnstile();
      return;
    }

    const tokenForRequest = turnstileToken;
    setTurnstileToken(null);

    try {
      const result = await login({ email, password, turnstileToken: tokenForRequest });

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
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && Boolean(turnstileToken) && Boolean(siteKey);

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
            disabled={submitting}
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
            disabled={submitting}
            onChange={setPassword}
          />
        </label>
        <TurnstileWidget
          ref={turnstileRef}
          className="auth-form__turnstile"
          data-testid="auth-login-turnstile"
          size="flexible"
          onTokenChange={setTurnstileToken}
        />
        {error ? (
          <AuthFeedbackMessage variant="error" title={t("signInFailed")}>
            <p>{error}</p>
          </AuthFeedbackMessage>
        ) : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
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
