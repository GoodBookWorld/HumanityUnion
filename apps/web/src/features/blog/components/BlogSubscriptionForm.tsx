"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { requestPublicBlogSubscription } from "../blog-subscription-api";

type FormState = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onHuBlogTurnstileLoad?: () => void;
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onHuBlogTurnstileLoad";

function resolveTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

/**
 * Pack 21A / EMAIL SECURITY 02B — Blog header subscribe form (email + Turnstile + Subscribe).
 */
export function BlogSubscriptionForm() {
  const t = useTranslations("blogPublic.subscribe");
  const emailId = useId();
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const siteKey = resolveTurnstileSiteKey();

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Widget may already be gone.
      }
    }
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey || !widgetHostRef.current || !window.turnstile) {
      return;
    }
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // ignore
      }
      widgetIdRef.current = null;
    }
    widgetHostRef.current.innerHTML = "";
    widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      "expired-callback": () => {
        setTurnstileToken(null);
      },
      "error-callback": () => {
        setTurnstileToken(null);
      },
      theme: "auto",
    });
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    window.onHuBlogTurnstileLoad = () => {
      renderWidget();
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (window.turnstile) {
      renderWidget();
    } else if (!existing) {
      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget]);

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
      {siteKey ? (
        <div
          className="blog-subscribe__turnstile"
          ref={widgetHostRef}
          data-testid="blog-subscribe-turnstile"
        />
      ) : null}
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
