"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { confirmEmailChange } from "../auth-api";

import "./auth-form.css";

export function ConfirmEmailChangePanel() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t("emailChangeTokenMissing"));
      setLoading(false);
      return;
    }

    void confirmEmailChange(token)
      .then(() => {
        setMessage(t("emailChangeUpdated"));
        setError(null);
      })
      .catch((confirmError) => {
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : t("invalidEmailChangeToken"),
        );
      })
      .finally(() => {
        setLoading(false);
      });
    // Intentionally token-only: avoid re-running confirmation when translator identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth confirm once per token
  }, [token]);

  return (
    <Card>
      <div className="auth-form">
        {loading ? <p>{t("confirmingEmailChange")}</p> : null}
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button href="/account" variant="primary">
            {t("goToAccount")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
