"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useState } from "react";

import { AuthFeedbackMessage } from "../auth/components/AuthFeedbackMessage";
import { API_BASE_URL } from "../../lib/api-base-url";
import {
  completeSsoGrantOnce,
  holdSsoGrant,
  ssoGrantMessage,
  stripSsoGrantFromBrowserUrl,
} from "./sso-completion";

export function IntegrityMediaSsoComplete() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    const assessment = holdSsoGrant(params.get("grant"));
    stripSsoGrantFromBrowserUrl();

    if (!assessment.ok) {
      setMessage(ssoGrantMessage(assessment.reason));
      return;
    }

    let cancelled = false;
    void completeSsoGrantOnce(assessment.grant, { apiBaseUrl: API_BASE_URL }).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "error") {
        setMessage(result.message);
        return;
      }

      router.replace(result.destination);
      router.refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (!message) {
    return <p className="auth-page__subtitle">Signing you in to Humanity Union.</p>;
  }

  return (
    <section className="auth-form" aria-live="polite">
      <h1 className="auth-page__title">Humanity Union sign-in</h1>
      <AuthFeedbackMessage variant="error">{message}</AuthFeedbackMessage>
    </section>
  );
}
