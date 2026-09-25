"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import {
  TurnstileWidget,
  resolveTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from "../../security/turnstile/TurnstileWidget";
import { requestPublicBlogSubscription } from "../blog-subscription-api";

type FormState = "idle" | "submitting" | "success" | "error";

/**
 * Pack 21A / EMAIL SECURITY 02B — Blog header subscribe form (email + Turnstile + Subscribe).
 * STEP 15D.8E.3 — Turnstile host extracted to shared TurnstileWidget (behavior preserved).
 */
export function BlogSubscriptionForm() {
  const t = useTranslations("blogPublic.subscribe");
  const emailId = useId();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const siteKey = resolveTurnstileSiteKey();

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage(null);

    if (!siteKey) {
      setState("error");
      setMessage(t("errorFallback"));
      return;
    }

    if (!turnstileToken) {
      setState("error");
      setMessage(t("errorFallback"));
      return;
    }

    const tokenForRequest = turnstileToken;
    // Prevent indefinite reuse of a stale challenge token on the client.
    setTurnstileToken(null);

    try {
      const result = await requestPublicBlogSubscription(email, tokenForRequest);
      setState("success");
      setMessage(result.message);
      setEmail("");
      resetTurnstile();
    } catch (error: unknown) {
      setState("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("errorFallback"),
      );
      resetTurnstile();
    }
  }

  const canSubmit =
    state !== "submitting" && Boolean(email.trim()) && Boolean(turnstileToken) && Boolean(siteKey);

  return (
    <form className="blog-subscribe" onSubmit={(event) => void onSubmit(event)} noValidate>
      <p className="blog-subscribe__label" id={`${emailId}-label`}>
        {t("label")}
      </p>
      <div className="blog-subscribe__row">
        <label className="hu-visually-hidden" htmlFor={emailId}>
          {t("emailLabel")}
        </label>
        <input
          id={emailId}
          className="hu-form-control blog-subscribe__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          disabled={state === "submitting"}
          aria-describedby={message ? `${emailId}-status` : `${emailId}-label`}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state === "error" || state === "success") {
              setState("idle");
              setMessage(null);
            }
          }}
          required
        />
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {state === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </div>
      <TurnstileWidget
        ref={turnstileRef}
        className="blog-subscribe__turnstile"
        data-testid="blog-subscribe-turnstile"
        size="normal"
        onTokenChange={setTurnstileToken}
      />
      {message ? (
        <p
          id={`${emailId}-status`}
          className={
            state === "error" ? "blog-subscribe__status blog-subscribe__status--error" : "blog-subscribe__status"
          }
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
