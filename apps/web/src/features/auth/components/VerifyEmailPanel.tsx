"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { verifyEmail } from "../auth-api";

import "./auth-form.css";

export function VerifyEmailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Verification token is missing.");
      setLoading(false);
      return;
    }

    void verifyEmail(token)
      .then(() => {
        setMessage("Your email address has been verified.");
        setError(null);
      })
      .catch((verifyError) => {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Invalid or expired verification token.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <Card>
      <div className="auth-form">
        {loading ? <p>Verifying your email...</p> : null}
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button href="/account" variant="primary">
            Go to account
          </Button>
          <Button variant="secondary" onClick={() => router.push("/login")}>
            Log in
          </Button>
        </div>
      </div>
    </Card>
  );
}
