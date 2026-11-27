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
import { AccountDeletionSection } from "../../account-deletion/AccountDeletionSection";
import { AuthFeedbackMessage } from "./AuthFeedbackMessage";
import { ContextualActionFeedback } from "./ContextualActionFeedback";
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
  const [passwordFeedback, setPasswordFeedback] = useState<{
    variant: "success" | "error";
    text: string;
  } | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState<{
    variant: "success" | "error";
    text: string;
  } | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<{
    variant: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [sessionsPending, setSessionsPending] = useState(false);

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
    if (submitting) {
      return;
    }
    if (passwordPending) {
      return;
    }
    setSubmitting(true);
    setEmailFeedback(null);

    try {
      const updated = await requestEmailChange(newEmail);
      setUser(updated);
      setNewEmail("");
      setEmailFeedback({ variant: "success", text: t("checkNewEmailInbox") });
    } catch (changeError) {
      setEmailFeedback({
        variant: "error",
        text:
          changeError instanceof Error ? changeError.message : t("unableToRequestEmailChange"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordPending || submitting) {
      return;
    }
    setPasswordPending(true);
    setPasswordFeedback(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ variant: "error", text: t("passwordMismatch") });
      setPasswordPending(false);
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
      setPasswordFeedback({ variant: "success", text: t("passwordChangedSuccess") });
    } catch (changeError) {
      setPasswordFeedback({
        variant: "error",
        text: changeError instanceof Error ? changeError.message : t("unableToChangePassword"),
      });
    } finally {
      setPasswordPending(false);
    }
  }

  async function handleRevokeOtherSessions() {
    if (sessionsPending) {
      return;
    }
    setSessionsPending(true);
    setSessionFeedback(null);

    try {
      const result = await revokeAllOtherSessions();
      setSessionFeedback({
        variant: "success",
        text: t("signedOutOtherSessions", { count: result.revokedCount }),
      });
    } catch (revokeError) {
      setSessionFeedback({
        variant: "error",
        text: revokeError instanceof Error ? revokeError.message : t("unableToRevokeSessions"),
      });
    } finally {
      setSessionsPending(false);
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

      <AccountSecuritySection user={user} onUserUpdated={setUser} />

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
            <Button type="submit" variant="secondary" disabled={submitting || passwordPending}>
              {t("requestEmailChange")}
            </Button>
          </div>
          {emailFeedback ? (
            <ContextualActionFeedback
              variant={emailFeedback.variant}
              title={
                emailFeedback.variant === "success" ? t("accountUpdate") : t("accountActionFailed")
              }
              noticeKey={`${emailFeedback.variant}:${emailFeedback.text}`}
            >
              <p>{emailFeedback.text}</p>
            </ContextualActionFeedback>
          ) : null}
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
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={passwordPending || submitting}>
              {t("updatePassword")}
            </Button>
          </div>
          {passwordFeedback ? (
            <ContextualActionFeedback
              variant={passwordFeedback.variant}
              title={
                passwordFeedback.variant === "success"
                  ? t("passwordUpdated")
                  : t("accountActionFailed")
              }
              noticeKey={`${passwordFeedback.variant}:${passwordFeedback.text}`}
            >
              <p>{passwordFeedback.text}</p>
            </ContextualActionFeedback>
          ) : null}
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
            disabled={sessionsPending}
            onClick={() => void handleRevokeOtherSessions()}
          >
            {t("logOutOtherSessions")}
          </Button>
        </div>
        {sessionFeedback ? (
          <ContextualActionFeedback
            variant={sessionFeedback.variant}
            title={
              sessionFeedback.variant === "success" ? t("accountUpdate") : t("accountActionFailed")
            }
            noticeKey={`${sessionFeedback.variant}:${sessionFeedback.text}`}
          >
            <p>{sessionFeedback.text}</p>
          </ContextualActionFeedback>
        ) : null}
      </ProfileSection>

      <AccountDeletionSection />

      <div className="account-panel__actions">
        <Button variant="primary" onClick={() => void handleLogout()}>
          {t("logOut")}
        </Button>
      </div>
    </div>
  );
}
