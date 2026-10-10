"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "../../design-system/components/Button";
import { ApiRequestError, apiRequest, isAuthenticationRequiredError } from "../../lib/api-client";

const ATTEMPT_STATE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

type Phase =
  | "loading"
  | "invalid"
  | "anonymous"
  | "ready"
  | "submitting"
  | "confirmed"
  | "cancelled"
  | "error";

interface Preview {
  displayName: string;
  source: string;
}

function confirmationPath(attemptState: string): string {
  return `/connect/integrity-media?state=${encodeURIComponent(attemptState)}`;
}

function loginPath(attemptState: string): string {
  return `/login?returnTo=${encodeURIComponent(confirmationPath(attemptState))}`;
}

function isNavigableHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function IntegrityMediaLinkConfirm() {
  const params = useSearchParams();
  const attemptState = params.get("state") ?? "";
  const [phase, setPhase] = useState<Phase>("loading");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ATTEMPT_STATE_PATTERN.test(attemptState)) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      try {
        const preview = await apiRequest<Preview>(
          `/api/v1/integrity-media/link/preview?state=${encodeURIComponent(attemptState)}`,
        );

        if (cancelled) {
          return;
        }

        setDisplayName(preview.displayName);
        setPhase("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(error)) {
          setPhase("anonymous");
          return;
        }

        setMessage(
          error instanceof ApiRequestError ? error.message : "Confirmation could not be loaded.",
        );
        setPhase("error");
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [attemptState]);

  useEffect(() => {
    if (phase !== "anonymous") {
      return;
    }

    window.location.assign(loginPath(attemptState));
  }, [phase, attemptState]);

  async function confirmConnection() {
    setPhase("submitting");

    try {
      const result = await apiRequest<{ confirmed: boolean; redirectUrl: string | null }>(
        "/api/v1/integrity-media/link/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: attemptState }),
        },
      );

      if (result.redirectUrl && isNavigableHttpUrl(result.redirectUrl)) {
        window.location.assign(result.redirectUrl);
        return;
      }

      setMessage(
        "Humanity Union confirmed this account. Returning to Integrity Media is not configured yet.",
      );
      setPhase("confirmed");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setPhase("anonymous");
        return;
      }

      setMessage(error instanceof ApiRequestError ? error.message : "Confirmation failed.");
      setPhase("error");
    }
  }

  async function cancelConnection() {
    setPhase("submitting");

    try {
      const result = await apiRequest<{ cancelled: boolean; redirectUrl: string | null }>(
        "/api/v1/integrity-media/link/cancel",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: attemptState }),
        },
      );

      if (result.redirectUrl && isNavigableHttpUrl(result.redirectUrl)) {
        window.location.assign(result.redirectUrl);
        return;
      }

      setMessage("Connection cancelled.");
      setPhase("cancelled");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setPhase("anonymous");
        return;
      }

      setMessage(error instanceof ApiRequestError ? error.message : "Cancellation failed.");
      setPhase("error");
    }
  }

  return (
    <section className="auth-form" aria-live="polite">
      <h1 className="auth-page__title">Connect your Humanity Union account to Integrity Media?</h1>
      {phase === "ready" || phase === "submitting" ? (
        <p>
          You are signed in as <strong>{displayName}</strong>. Confirm only if this is the Humanity
          Union account you want to connect.
        </p>
      ) : null}
      {phase === "invalid" ? (
        <p>This confirmation link is incomplete. Start again from Integrity Media.</p>
      ) : null}
      {phase === "anonymous" ? <p>Redirecting to Humanity Union sign in.</p> : null}
      {message ? <p className="auth-feedback">{message}</p> : null}
      {phase === "ready" || phase === "submitting" ? (
        <div className="auth-form__actions">
          <Button
            variant="primary"
            disabled={phase === "submitting"}
            onClick={() => void confirmConnection()}
          >
            Confirm
          </Button>
          <Button disabled={phase === "submitting"} onClick={() => void cancelConnection()}>
            Cancel
          </Button>
        </div>
      ) : null}
      {phase === "anonymous" ? (
        <p>
          <a href={loginPath(attemptState)}>Sign in</a>
        </p>
      ) : null}
      <p>
        If you do not have a Humanity Union account, use the normal{" "}
        <Link href="/register">registration</Link> process. This confirmation will not be kept
        through registration. After you can sign in, start again from Integrity Media.
      </p>
    </section>
  );
}
