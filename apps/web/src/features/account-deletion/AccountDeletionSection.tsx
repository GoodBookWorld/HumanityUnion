"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { useBrandSiteName } from "../brand-localization/useLocalizedBrand";

import { ProfileSection } from "../../components/member/ProfileSection";
import { Button } from "../../design-system/components/Button";
import { PasswordInput } from "../../design-system/components/PasswordInput";
import { AuthFeedbackMessage } from "../auth/components/AuthFeedbackMessage";
import {
  confirmAccountDeletion,
  requestAccountDeletion,
} from "../auth/auth-api";
import { isAccountDeletionUiEnabled } from "./account-deletion-availability";
import { accountDeletionErrorMessage } from "./account-deletion-messages";

function deletionControlsEnabled(): boolean {
  // Direct read so the Next.js client build can embed the public flag.
  // The helper remains the runtime check used by the server page and tests.
  return (
    isAccountDeletionUiEnabled() ||
    process.env.NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED === "1"
  );
}

/**
 * Shown only when the release gate is on. Hidden entirely while the
 * Privacy Policy amendment is unpublished, so the page does not offer deletion.
 */
export function AccountDeletionSection() {
  const t = useTranslations("auth");
  const siteName = useBrandSiteName();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!deletionControlsEnabled()) {
    return null;
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const status = await requestAccountDeletion(password);
      if (status.phase === "pending" && status.deadlineAt) {
        setDeadline(status.deadlineAt);
      } else {
        setCodeSent(true);
      }
    } catch (requestError) {
      setError(accountDeletionErrorMessage(requestError, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const status = await confirmAccountDeletion(code);
      setDeadline(status.deadlineAt ?? null);
    } catch (confirmError) {
      setError(accountDeletionErrorMessage(confirmError, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProfileSection title={t("deleteAccountTitle")}>
      <p>{t("deleteAccountIntro", { siteName })}</p>
      <p>{t("deleteAccountConsequences")}</p>
      {deadline ? (
        <AuthFeedbackMessage variant="success" title={t("deleteAccountTitle")}>
          <p>{t("deleteAccountScheduled", { deadline })}</p>
          <p>
            <a href="/account/deletion/cancel">{t("recoveryTitle")}</a>
          </p>
        </AuthFeedbackMessage>
      ) : null}
      {error ? (
        <AuthFeedbackMessage variant="error" title={t("securityActionFailed")}>
          <p>{error}</p>
        </AuthFeedbackMessage>
      ) : null}
      {!open && !deadline ? (
        <div className="account-panel__actions">
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            {t("deleteAccountButton")}
          </Button>
        </div>
      ) : null}
      {open && !codeSent && !deadline ? (
        <form className="account-panel__form" onSubmit={(event) => void handleRequest(event)}>
          <label className="account-panel__field" htmlFor="delete-account-password">
            <span>{t("currentPassword")}</span>
            <PasswordInput
              id="delete-account-password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />
          </label>
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={submitting}>
              {t("deleteAccountSendCode")}
            </Button>
          </div>
        </form>
      ) : null}
      {codeSent && !deadline ? (
        <form className="account-panel__form" onSubmit={(event) => void handleConfirm(event)}>
          <p>{t("deleteAccountCodeSent")}</p>
          <label className="account-panel__field" htmlFor="delete-account-code">
            <span>{t("deleteAccountCodeLabel")}</span>
            <input
              id="delete-account-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          <div className="account-panel__actions">
            <Button type="submit" variant="secondary" disabled={submitting}>
              {t("deleteAccountConfirm")}
            </Button>
          </div>
        </form>
      ) : null}
    </ProfileSection>
  );
}
