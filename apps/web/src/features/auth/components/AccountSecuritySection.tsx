"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useBrandSiteName } from "../../brand-localization/useLocalizedBrand";

import type { AuthUserPublic } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { PasswordInput } from "../../../design-system/components/PasswordInput";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  confirmDisableLoginTwoStep,
  confirmEnableLoginTwoStep,
  resendLoginTwoStepSettingCode,
  startDisableLoginTwoStep,
  startEnableLoginTwoStep,
} from "../auth-api";
import {
  AUTH_INCORRECT_CODE_MESSAGE,
  isIncorrectCodeMessage,
  normalizeIncorrectCodeMessage,
} from "../lib/auth-feedback-messages";
import { ContextualActionFeedback } from "./ContextualActionFeedback";

import "./account-panel.css";

interface AccountSecuritySectionProps {
  user: AuthUserPublic;
  onUserUpdated: (user: AuthUserPublic) => void;
}

export function AccountSecuritySection({
  user,
  onUserUpdated,
}: AccountSecuritySectionProps) {
  const t = useTranslations("auth");
  const siteName = useBrandSiteName();
  const tCommon = useTranslations("common");
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailConfirmed = user.emailVerificationStatus === "verified";
  const twoStepEnabled = user.loginEmailTwoStepEnabled === true;

  function displayError(message: string): string {
    if (message === AUTH_INCORRECT_CODE_MESSAGE || isIncorrectCodeMessage(message)) {
      return t("incorrectCode");
    }
    return message;
  }

  function resetFlow() {
    setPendingAction(null);
    setCurrentPassword("");
    setVerificationCode("");
    setLocalMessage(null);
    setLocalError(null);
  }

  async function handleStart(action: "enable" | "disable") {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setLocalMessage(null);
    setLocalError(null);

    try {
      if (action === "enable") {
        await startEnableLoginTwoStep(currentPassword);
      } else {
        await startDisableLoginTwoStep(currentPassword);
      }

      setPendingAction(action);
      setLocalMessage(t("twoStepCodeSent"));
    } catch (startError) {
      setLocalError(formatAuthFormError(startError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!pendingAction) {
      return;
    }

    if (submitting) {
      return;
    }
    setSubmitting(true);
    setLocalMessage(null);
    setLocalError(null);

    try {
      const updated =
        pendingAction === "enable"
          ? await confirmEnableLoginTwoStep(verificationCode)
          : await confirmDisableLoginTwoStep(verificationCode);

      onUserUpdated(updated);
      const message =
        pendingAction === "enable" ? t("twoStepEnabledSuccess") : t("twoStepDisabledSuccess");
      resetFlow();
      setLocalMessage(message);
    } catch (confirmError) {
      setLocalError(normalizeIncorrectCodeMessage(formatAuthFormError(confirmError)));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!pendingAction) {
      return;
    }

    if (submitting) {
      return;
    }
    setSubmitting(true);
    setLocalError(null);

    try {
      await resendLoginTwoStepSettingCode(pendingAction);
      setLocalMessage(t("newVerificationCodeSent"));
    } catch (resendError) {
      setLocalError(formatAuthFormError(resendError));
    } finally {
      setSubmitting(false);
    }
  }

  function actionNotice(placement: "code" | "setting") {
    return (
      <>
        {localError ? (
          <ContextualActionFeedback
            variant="error"
            title={t("securityActionFailed")}
            noticeKey={`${placement}:error:${localError}`}
          >
            <p>{displayError(localError)}</p>
          </ContextualActionFeedback>
        ) : null}
        {localMessage ? (
          <ContextualActionFeedback
            variant="success"
            title={t("verificationCodeSent")}
            noticeKey={`${placement}:success:${localMessage}`}
          >
            <p>{localMessage}</p>
          </ContextualActionFeedback>
        ) : null}
      </>
    );
  }

  return (
    <ProfileSection title={t("accountSecurity")}>
      <ProfileField
        label={t("emailConfirmed")}
        value={emailConfirmed ? t("yes") : t("no")}
      />
      <ProfileField
        label={t("twoStepLoginByEmail")}
        value={twoStepEnabled ? t("enabled") : t("disabled")}
      />
      <p className="account-panel__help">{t("twoStepLoginHelp", { siteName })}</p>

      {!emailConfirmed ? (
        <p className="account-panel__help">{t("confirmEmailBeforeTwoStep")}</p>
      ) : pendingAction ? (
        <div className="account-panel__form">
          <label className="account-panel__field" htmlFor="two-step-setting-code">
            <span>{t("verificationCode")}</span>
            <input
              id="two-step-setting-code"
              className="auth-form__code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => {
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (localError) {
                  setLocalError(null);
                }
              }}
            />
          </label>
          <div className="account-panel__actions">
            <Button
              variant="primary"
              disabled={submitting || verificationCode.length !== 6}
              onClick={() => void handleConfirm()}
            >
              {pendingAction === "enable" ? t("confirmEnable") : t("confirmDisable")}
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => void handleResend()}>
              {t("resendCode")}
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={resetFlow}>
              {tCommon("cancel")}
            </Button>
          </div>
          {actionNotice("code")}
        </div>
      ) : (
        <div className="account-panel__form">
          <label className="account-panel__field" htmlFor="two-step-current-password">
            <span>{t("currentPassword")}</span>
            <PasswordInput
              id="two-step-current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          </label>
          <div className="account-panel__actions">
            {!twoStepEnabled ? (
              <Button
                variant="primary"
                disabled={submitting || !currentPassword}
                onClick={() => void handleStart("enable")}
              >
                {t("enableTwoStepLogin")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={submitting || !currentPassword}
                onClick={() => void handleStart("disable")}
              >
                {t("disableTwoStepLogin")}
              </Button>
            )}
          </div>
          {actionNotice("setting")}
        </div>
      )}
    </ProfileSection>
  );
}
