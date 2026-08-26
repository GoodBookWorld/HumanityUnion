"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "../../../design-system/components/Button";
import { requestPublicBlogSubscription } from "../blog-subscription-api";

type FormState = "idle" | "submitting" | "success" | "error";

/**
 * Pack 21A — Blog header subscribe form (email + Subscribe).
 */
export function BlogSubscriptionForm() {
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
      setMessage(result.message);
      setEmail("");
    } catch (error: unknown) {
      setState("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to start subscription. Please try again.",
      );
    }
  }

  return (
    <form className="blog-subscribe" onSubmit={(event) => void onSubmit(event)} noValidate>
      <p className="blog-subscribe__label" id={`${emailId}-label`}>
        Subscribe to Blog publications
      </p>
      <div className="blog-subscribe__row">
        <label className="hu-visually-hidden" htmlFor={emailId}>
          Email address
        </label>
        <input
          id={emailId}
          className="hu-form-control blog-subscribe__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Email address"
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
          {state === "submitting" ? "Subscribing…" : "Subscribe"}
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
