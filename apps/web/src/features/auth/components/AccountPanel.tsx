"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("workspace");
  const tAuth = useTranslations("auth");
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
          setLoadError(loadError instanceof Error ? loadError.message : t("unableToLoadAccount"));
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
    // Intentionally load once on mount; avoid re-fetch when translator identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setMessage(t("checkNewEmailInbox"));
    } catch (changeError) {
      setActionError(
        changeError instanceof Error ? changeError.message : t("unableToRequestEmailChange"),
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
      setActionError(t("passwordMismatch"));
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
      setPasswordSuccess(t("passwordChangedSuccess"));
    } catch (changeError) {
      setActionError(
        changeError instanceof Error ? changeError.message : t("unableToChangePassword"),
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
      setMessage(t("signedOutOtherSessions", { count: result.revokedCount }));
    } catch (revokeError) {
      setActionError(
        revokeError instanceof Error ? revokeError.message : t("unableToRevokeSessions"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>{t("loadingAccount")}</p>;
  }

  if (loadError || !user) {
    return (
      <ProfileSection title={t("account")}>
        <p>{loadError ?? t("signInToViewAccount")}</p>
        <Button href="/login" variant="primary">
          {tAuth("logIn")}
        </Button>
      </ProfileSection>
    );
  }

  const verificationLabel =
    user.emailVerificationStatus === "verified"
      ? t("emailConfirmedStatus")
      : t("emailConfirmationPending");

  const accountTiles = [
    { label: t("displayName"), value: user.displayName },
    { label: tAuth("email"), value: user.email },
    { label: t("emailVerification"), value: verificationLabel },
    { label: t("role"), value: user.role },
    { label: t("status"), value: user.status },
  ];

  return (
    <div className="account-panel">
      <ProfileSection title={t("account")}>
        {showCompleteProfileCta ? (
          <div className="account-panel__actions">
            <AuthFeedbackMessage variant="success" title={t("emailConfirmedTitle")}>
              <p>{t("emailConfirmedBody")}</p>
            </AuthFeedbackMessage>
            <Button href="/profile" variant="primary">
              {t("completeYourProfile")}
            </Button>
          </div>
        ) : null}
        <AdminMetricDetailsGrid cells={accountTiles} aria-label={t("accountProfileSummary")} />
        {user.pendingEmail ? (
          <p className="hu-caption account-panel__pending-email">
            {t("pendingEmailChange", { email: user.pendingEmail })}
          </p>
        ) : null}
        {message ? (
          <AuthFeedbackMessage variant="success" title={t("accountUpdate")}>
            <p>{message}</p>
          </AuthFeedbackMessage>
        ) : null}
        {actionError ? (
          <AuthFeedbackMessage variant="error" title={t("accountActionFailed")}>
            <p>{actionError}</p>
          </AuthFeedbackMessage>
        ) : null}
        {user.emailVerificationStatus !== "verified" ? (
          <div className="account-panel__actions">
            <Button href="/confirm-email" variant="secondary">
              {tAuth("confirmEmail")}
            </Button>
          </div>
        ) : null}
        <p className="account-panel__note">
          {t("publicProfileNotePrefix")} <a href="/profile">{t("editProfile")}</a>.
        </p>
      </ProfileSection>

      <AccountSecuritySection
        user={user}
        onUserUpdated={setUser}
        onMessage={setMessage}
        onError={setActionError}
      />

      <ProfileSection title={t("changeEmail")}>
        <form className="account-panel__form" onSubmit={(event) => void handleEmailChange(event)}>
          <label className="account-panel__field" htmlFor="new-email">
            <span>{t("newEmailAddress")}</span>
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
              {t("requestEmailChange")}
            </Button>
          </div>
        </form>
      </ProfileSection>

      <ProfileSection title={t("changePassword")}>
        <form
          className="account-panel__form"
          onSubmit={(event) => void handlePasswordChange(event)}
        >
          <label className="account-panel__field" htmlFor="current-password">
            <span>{tAuth("currentPassword")}</span>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
            />
          </label>
          <label className="account-panel__field" htmlFor="new-password">
            <span>{tAuth("newPassword")}</span>
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
            <span>{t("confirmNewPassword")}</span>
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
            <AuthFeedbackMessage variant="success" title={t("passwordUpdated")}>
              <p>{passwordSuccess}</p>
            </AuthFeedbackMessage>
          ) : null}
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={submitting}>
              {t("updatePassword")}
            </Button>
          </div>
        </form>
        <p className="account-panel__actions">
          <Button href="/password-reset" variant="secondary">
            {tAuth("forgotPassword")}
          </Button>
        </p>
      </ProfileSection>

      <ProfileSection title={t("sessions")}>
        <div className="account-panel__actions">
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => void handleRevokeOtherSessions()}
          >
            {t("logOutOtherSessions")}
          </Button>
        </div>
      </ProfileSection>

      <div className="account-panel__actions">
        <Button variant="primary" onClick={() => void handleLogout()}>
          {t("logOut")}
        </Button>
      </div>
    </div>
  );
}
