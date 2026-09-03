"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { requestPublicBlogSubscription } from "../blog-subscription-api";

type FormState = "idle" | "submitting" | "success" | "error";

/**
 * Pack 21A — Blog header subscribe form (email + Subscribe).
 */
export function BlogSubscriptionForm() {
  const t = useTranslations("blogPublic.subscribe");
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage(null);
    try {
      const result = await requestPublicBlogSubscription(email);
      setState("success");
      // API_OPAQUE — success copy comes from the API response.
      setMessage(result.message);
      setEmail("");
    } catch (error: unknown) {
      setState("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("errorFallback"),
      );
    }
  }

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
        <Button type="submit" variant="primary" disabled={state === "submitting" || !email.trim()}>
          {state === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </div>
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
