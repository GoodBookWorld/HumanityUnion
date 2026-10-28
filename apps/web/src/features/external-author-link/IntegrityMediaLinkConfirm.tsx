"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "../../design-system/components/Button";
import {
  ApiRequestError,
  apiRequest,
  isAuthenticationRequiredError,
  isNotFoundError,
} from "../../lib/api-client";
import { logout } from "../auth/auth-api";
import {
  canSubmitIntegrityMediaConfirmation,
  isBindingRecoveryPreview,
  ORDINARY_CONFIRMATION_TITLE,
  RECOVERY_ACKNOWLEDGEMENT,
  RECOVERY_CONFIRMATION_TITLE,
  RECOVERY_WARNING,
  type IntegrityMediaLinkPreview,
} from "./integrity-media-link-confirm-model";

const ATTEMPT_STATE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

type Phase =
  | "loading"
  | "invalid"
  | "anonymous"
  | "ready"
  | "submitting"
  | "confirmed"
  | "cancelled"
  | "error"
  | "provision"
  | "provision-submitting"
  | "provision-blocked";

const PROVISION_SENTENCE =
  "Confirmation creates an account on the Humanity Union social education and civic participation platform.";

const PROVISION_COLLISION_NOTICE =
  "This Integrity Media account cannot be linked automatically. No Humanity Union account was created.";

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
  const [accountEmail, setAccountEmail] = useState("");
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!ATTEMPT_STATE_PATTERN.test(attemptState)) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;

    async function loadSessionPreview() {
      try {
        const preview = await apiRequest<IntegrityMediaLinkPreview>(
          `/api/v1/integrity-media/link/preview?state=${encodeURIComponent(attemptState)}`,
        );

        if (cancelled) {
          return;
        }

        const isRecovery = isBindingRecoveryPreview(preview);
        setDisplayName(preview.displayName);
        setRecovery(isRecovery);
        setSessionEmail(isRecovery ? (preview.email ?? "") : "");
        setAcknowledged(false);
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

    async function loadPreview() {
      try {
        const consent = await apiRequest<{ displayName: string; email: string }>(
          `/api/v1/integrity-media/link/provision-consent?state=${encodeURIComponent(attemptState)}`,
        );

        if (cancelled) {
          return;
        }

        setDisplayName(consent.displayName);
        setAccountEmail(consent.email);
        setPhase("provision");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isNotFoundError(error)) {
          await loadSessionPreview();
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

  async function confirmProvision() {
    setPhase("provision-submitting");
    setMessage("");

    try {
      const result = await apiRequest<{ redirectUrl: string | null }>(
        "/api/v1/integrity-media/link/provision-confirm",
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
      if (
        error instanceof ApiRequestError &&
        error.meta?.code === "existing_email_collision"
      ) {
        setAccountEmail("");
        setDisplayName("");
        setMessage(PROVISION_COLLISION_NOTICE);
        setPhase("provision-blocked");
        return;
      }

      setMessage(error instanceof ApiRequestError ? error.message : "Confirmation failed.");
      setPhase("error");
    }
  }

  async function switchAccount() {
    setPhase("submitting");
    await logout();
    window.location.assign(loginPath(attemptState));
  }

  async function confirmConnection() {
    if (!canSubmitIntegrityMediaConfirmation({ phase, recovery, acknowledged })) {
      return;
    }

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
      <h1 className="auth-page__title">
        {recovery ? RECOVERY_CONFIRMATION_TITLE : ORDINARY_CONFIRMATION_TITLE}
      </h1>
      {phase === "provision" || phase === "provision-submitting" ? (
        <>
          <p>{PROVISION_SENTENCE}</p>
          <p>
            You are creating an account for <strong>{displayName}</strong> ({accountEmail}).
          </p>
          <div className="auth-form__actions">
            <Button
              variant="primary"
              disabled={phase === "provision-submitting"}
              onClick={() => void confirmProvision()}
            >
              Confirm & Create Account
            </Button>
          </div>
        </>
      ) : null}
      {phase === "provision-blocked" ? <p>{message}</p> : null}
      {(phase === "ready" || phase === "submitting") && recovery ? (
        <>
          <p>
            You are signed in as <strong>{displayName}</strong>
            {sessionEmail ? <> ({sessionEmail})</> : null}. Confirm only if this is the Humanity
            Union account that should replace the previous connection.
          </p>
          <p className="auth-feedback">{RECOVERY_WARNING}</p>
          <label>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={phase === "submitting"}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />{" "}
            {RECOVERY_ACKNOWLEDGEMENT}
          </label>
        </>
      ) : null}
      {(phase === "ready" || phase === "submitting") && !recovery ? (
        <p>
          You are signed in as <strong>{displayName}</strong>. Confirm only if this is the Humanity
          Union account you want to connect.
        </p>
      ) : null}
      {phase === "invalid" ? (
        <p>This confirmation link is incomplete. Start again from Integrity Media.</p>
      ) : null}
      {phase === "anonymous" ? <p>Redirecting to Humanity Union sign in.</p> : null}
      {phase !== "provision-blocked" && message ? <p className="auth-feedback">{message}</p> : null}
      {phase === "ready" || phase === "submitting" ? (
        <div className="auth-form__actions">
          <Button
            variant="primary"
            disabled={!canSubmitIntegrityMediaConfirmation({ phase, recovery, acknowledged })}
            onClick={() => void confirmConnection()}
          >
            Confirm
          </Button>
          {recovery ? (
            <Button disabled={phase === "submitting"} onClick={() => void switchAccount()}>
              Use a different account
            </Button>
          ) : null}
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
      {phase === "provision" || phase === "provision-submitting" || phase === "provision-blocked" ? null : (
        <p>
          If you do not have a Humanity Union account, use the normal{" "}
          <Link href="/register">registration</Link> process. This confirmation will not be kept
          through registration. After you can sign in, start again from Integrity Media.
        </p>
      )}
    </section>
  );
}
