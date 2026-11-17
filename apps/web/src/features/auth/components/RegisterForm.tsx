"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  TurnstileWidget,
  resolveTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from "../../security/turnstile/TurnstileWidget";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import { register } from "../auth-api";
import { buildAuthPathWithReturnTo } from "../lib/build-auth-return-path";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./auth-form.css";

function RegisterFormFields() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo");
  const hasReturnTo = Boolean(rawReturnTo);
  const returnTo = resolveSafeReturnTo(rawReturnTo, "/workspace");
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [requiresInvite, setRequiresInvite] = useState(false);
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKey = resolveTurnstileSiteKey();

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  useEffect(() => {
    void getPlatformConfig()
      .then((config) => {
        setRequiresInvite(config.registrationRequiresInvite);
      })
      .catch((configError) => {
        setRequiresInvite(false);
        setConfigWarning(formatAuthFormError(configError));
      });
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
      const result = await register({
        email,
        displayName,
        password,
        inviteCode: requiresInvite ? inviteCode : undefined,
        turnstileToken: tokenForRequest,
      });

      if ("emailConfirmationRequired" in result && result.emailConfirmationRequired) {
        router.push(
          hasReturnTo ? buildAuthPathWithReturnTo("/confirm-email", returnTo) : "/confirm-email",
        );
        router.refresh();
        return;
      }

      // Preserve Join Program intent when present; otherwise keep profile onboarding.
      router.push(hasReturnTo ? returnTo : "/profile");
      router.refresh();
    } catch (submitError) {
      setError(formatAuthFormError(submitError));
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && Boolean(turnstileToken) && Boolean(siteKey);
  const loginHref = hasReturnTo ? buildAuthPathWithReturnTo("/login", returnTo) : "/login";

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
            {t("displayName")} <span aria-hidden="true">*</span>
            <span className="hu-visually-hidden">{t("required")}</span>
          </span>
          <input
            type="text"
            autoComplete="name"
            required
            aria-required="true"
            value={displayName}
            disabled={submitting}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        {requiresInvite ? (
          <label className="auth-form__field">
            <span>
              {t("betaInviteCode")} <span aria-hidden="true">*</span>
              <span className="hu-visually-hidden">{t("required")}</span>
            </span>
            <input
              type="text"
              autoComplete="off"
              required
              aria-required="true"
              value={inviteCode}
              disabled={submitting}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </label>
        ) : null}
        <label className="auth-form__field">
          <span>
            {t("password")} <span aria-hidden="true">*</span>
            <span className="hu-visually-hidden">{t("required")}</span>
          </span>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            disabled={submitting}
            onChange={setPassword}
          />
        </label>
        <TurnstileWidget
          ref={turnstileRef}
          className="auth-form__turnstile"
          data-testid="auth-register-turnstile"
          size="flexible"
          onTokenChange={setTurnstileToken}
        />
        {configWarning ? (
          <AuthFeedbackMessage variant="info" title={t("registrationNotice")}>
            <p>{configWarning}</p>
          </AuthFeedbackMessage>
        ) : null}
        {error ? (
          <AuthFeedbackMessage variant="error" title={t("registrationFailed")}>
            <p>{error}</p>
          </AuthFeedbackMessage>
        ) : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {submitting ? t("creatingAccount") : t("createAccount")}
          </Button>
          <Button href={loginHref}>{t("alreadyHaveAccount")}</Button>
        </div>
      </form>
    </Card>
  );
}

function RegisterFormFallback() {
  const t = useTranslations("auth");
  return <Card>{t("loadingLoginForm")}</Card>;
}

export function RegisterForm() {
  return (
    <Suspense fallback={<RegisterFormFallback />}>
      <RegisterFormFields />
    </Suspense>
  );
}
