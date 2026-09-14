"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { verifyEmail } from "../auth-api";

import "./auth-form.css";

export function VerifyEmailPanel() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t("verificationTokenMissing"));
      setLoading(false);
      return;
    }

    void verifyEmail(token)
      .then(() => {
        setMessage(t("emailVerified"));
        setError(null);
      })
      .catch((verifyError) => {
        setError(
          verifyError instanceof Error ? verifyError.message : t("invalidVerificationToken"),
        );
      })
      .finally(() => {
        setLoading(false);
      });
    // Intentionally token-only: avoid re-running verification when translator identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth verify once per token
  }, [token]);

  return (
    <Card>
      <div className="auth-form">
        {loading ? <p>{t("verifyingEmail")}</p> : null}
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button href="/account" variant="primary">
            {t("goToAccount")}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/login")}>
            {t("logIn")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
