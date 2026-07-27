"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import { register } from "../auth-api";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";

import "./auth-form.css";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [requiresInvite, setRequiresInvite] = useState(false);
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPlatformConfig()
      .then((config) => {
        setRequiresInvite(config.registrationRequiresInvite);
      })
      .catch((configError) => {
        setRequiresInvite(false);
        setConfigWarning(formatAuthFormError(configError));
      });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await register({
        email,
        displayName,
        password,
        inviteCode: requiresInvite ? inviteCode : undefined,
      });

      if ("emailConfirmationRequired" in result && result.emailConfirmationRequired) {
        router.push("/confirm-email");
        router.refresh();
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch (submitError) {
      setError(formatAuthFormError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-form__field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="auth-form__field">
          <span>Display name</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        {requiresInvite ? (
          <label className="auth-form__field">
            <span>Beta invite code</span>
            <input
              type="text"
              autoComplete="off"
              required
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </label>
        ) : null}
        <label className="auth-form__field">
          <span>Password</span>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
          />
        </label>
        {configWarning ? (
          <AuthFeedbackMessage variant="info" title="Registration notice">
            <p>{configWarning}</p>
          </AuthFeedbackMessage>
        ) : null}
        {error ? (
          <AuthFeedbackMessage variant="error" title="Registration failed">
            <p>{error}</p>
          </AuthFeedbackMessage>
        ) : null}
        <div className="auth-form__actions">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Creating account..." : "Register"}
          </Button>
          <Button href="/login">Already have an account?</Button>
        </div>
      </form>
    </Card>
  );
}
