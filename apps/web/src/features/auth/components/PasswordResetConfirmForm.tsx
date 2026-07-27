"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { confirmPasswordReset, validatePasswordResetToken } from "../auth-api";

import "./auth-form.css";

export function PasswordResetConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }

    void validatePasswordResetToken(token)
      .then(setTokenValid)
      .catch(() => setTokenValid(false));
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      await confirmPasswordReset(token, password);
      setMessage("Your password has been reset. You can log in with your new password.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenValid === false) {
    return (
      <Card>
        <div className="auth-form">
          <p className="auth-form__error">Invalid or expired reset token.</p>
          <Button href="/password-reset" variant="primary">
            Request a new reset link
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="auth-form__field">
          <span>New password</span>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
          />
        </label>
        {message ? <p>{message}</p> : null}
        {error ? <p className="auth-form__error">{error}</p> : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={submitting || tokenValid === null}>
            Reset password
          </Button>
          {message ? (
            <Button variant="secondary" onClick={() => router.push("/login")}>
              Log in
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
