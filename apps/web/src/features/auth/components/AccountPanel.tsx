"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import {
  changePassword,
  getMe,
  logout,
  requestEmailChange,
  revokeAllOtherSessions,
} from "../auth-api";
import { AdminMetricDetailsGrid } from "../../administration/components/AdminMetricDetailsGrid";

import { AccountSecuritySection } from "./AccountSecuritySection";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";
import "./account-panel.css";
import "../../administration/components/admin-panel.css";

export function AccountPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCompleteProfileCta = searchParams.get("confirmed") === "1";
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getMe()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          setLoadError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setUser(null);
          setLoadError(loadError instanceof Error ? loadError.message : "Unable to load account.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  async function handleEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setActionError(null);
    setPasswordSuccess(null);

    try {
      const updated = await requestEmailChange(newEmail);
      setUser(updated);
      setNewEmail("");
      setMessage("Check your new email inbox to confirm the change.");
    } catch (changeError) {
      setActionError(
        changeError instanceof Error ? changeError.message : "Unable to request email change.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setActionError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setActionError("New password and confirmation must match.");
      setSubmitting(false);
      return;
    }

    try {
      const updated = await changePassword({
        currentPassword,
        newPassword,
      });
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordSuccess(
        "Password changed successfully. Other active sessions were signed out for security.",
      );
    } catch (changeError) {
      setActionError(
        changeError instanceof Error ? changeError.message : "Unable to change password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeOtherSessions() {
    setSubmitting(true);
    setMessage(null);
    setActionError(null);
    setPasswordSuccess(null);

    try {
      const result = await revokeAllOtherSessions();
      setMessage(`Signed out ${result.revokedCount} other session(s).`);
    } catch (revokeError) {
      setActionError(
        revokeError instanceof Error ? revokeError.message : "Unable to revoke other sessions.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>Loading account...</p>;
  }

  if (loadError || !user) {
    return (
      <ProfileSection title="Account">
        <p>{loadError ?? "Sign in to view your account."}</p>
        <Button href="/login" variant="primary">
          Log in
        </Button>
      </ProfileSection>
    );
  }

  const verificationLabel =
    user.emailVerificationStatus === "verified" ? "Email Confirmed" : "Email Confirmation Pending";

  const accountTiles = [
    { label: "Display Name", value: user.displayName },
    { label: "Email", value: user.email },
    { label: "Email Verification", value: verificationLabel },
    { label: "Role", value: user.role },
    { label: "Status", value: user.status },
  ];

  return (
    <div className="account-panel">
      <ProfileSection title="Account">
        {showCompleteProfileCta ? (
          <div className="account-panel__actions">
            <AuthFeedbackMessage variant="success" title="Email confirmed">
              <p>Your email is confirmed. Complete your public profile when you are ready.</p>
            </AuthFeedbackMessage>
            <Button href="/profile" variant="primary">
              Complete Your Profile
            </Button>
          </div>
        ) : null}
        <AdminMetricDetailsGrid cells={accountTiles} aria-label="Account profile summary" />
        {user.pendingEmail ? (
          <p className="hu-caption account-panel__pending-email">
            Pending Email Change: {user.pendingEmail}
          </p>
        ) : null}
        {message ? (
          <AuthFeedbackMessage variant="success" title="Account update">
            <p>{message}</p>
          </AuthFeedbackMessage>
        ) : null}
        {actionError ? (
          <AuthFeedbackMessage variant="error" title="Account action failed">
            <p>{actionError}</p>
          </AuthFeedbackMessage>
        ) : null}
        {user.emailVerificationStatus !== "verified" ? (
          <div className="account-panel__actions">
            <Button href="/confirm-email" variant="secondary">
              Confirm Email
            </Button>
          </div>
        ) : null}
        <p className="account-panel__note">
          Public profile details live on <a href="/profile">Edit Profile</a>.
        </p>
      </ProfileSection>

      <AccountSecuritySection
        user={user}
        onUserUpdated={setUser}
        onMessage={setMessage}
        onError={setActionError}
      />

      <ProfileSection title="Change Email">
        <form className="account-panel__form" onSubmit={(event) => void handleEmailChange(event)}>
          <label className="account-panel__field" htmlFor="new-email">
            <span>New email address</span>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
          </label>
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={submitting}>
              Request email change
            </Button>
          </div>
        </form>
      </ProfileSection>

      <ProfileSection title="Change Password">
        <form
          className="account-panel__form"
          onSubmit={(event) => void handlePasswordChange(event)}
        >
          <label className="account-panel__field" htmlFor="current-password">
            <span>Current password</span>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
            />
          </label>
          <label className="account-panel__field" htmlFor="new-password">
            <span>New password</span>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={setNewPassword}
              required
            />
          </label>
          <label className="account-panel__field" htmlFor="confirm-new-password">
            <span>Confirm new password</span>
            <PasswordInput
              id="confirm-new-password"
              autoComplete="new-password"
              minLength={8}
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              required
            />
          </label>
          {passwordSuccess ? (
            <AuthFeedbackMessage variant="success" title="Password updated">
              <p>{passwordSuccess}</p>
            </AuthFeedbackMessage>
          ) : null}
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={submitting}>
              Update password
            </Button>
          </div>
        </form>
        <p className="account-panel__actions">
          <Button href="/password-reset" variant="secondary">
            Forgot password?
          </Button>
        </p>
      </ProfileSection>

      <ProfileSection title="Sessions">
        <div className="account-panel__actions">
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => void handleRevokeOtherSessions()}
          >
            Log out other sessions
          </Button>
        </div>
      </ProfileSection>

      <div className="account-panel__actions">
        <Button variant="primary" onClick={() => void handleLogout()}>
          Log out
        </Button>
      </div>
    </div>
  );
}
