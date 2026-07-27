"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { confirmEmailChange } from "../auth-api";

import "./auth-form.css";

export function ConfirmEmailChangePanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Email change token is missing.");
      setLoading(false);
      return;
    }

    void confirmEmailChange(token)
      .then(() => {
        setMessage("Your email address has been updated.");
        setError(null);
      })
      .catch((confirmError) => {
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : "Invalid or expired email change token.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <Card>
      <div className="auth-form">
        {loading ? <p>Confirming your email change...</p> : null}
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button href="/account" variant="primary">
            Go to account
          </Button>
        </div>
      </div>
    </Card>
  );
}
