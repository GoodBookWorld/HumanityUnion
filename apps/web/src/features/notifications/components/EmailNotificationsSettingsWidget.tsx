"use client";

/**
 * HU-NOTIF-02A/02B/02C.10 — Email Notifications settings on Notification Center.
 * Compact accordion; shares MemberPreferences; alt email never changes login email.
 */

import type { MemberPreferences, NotificationFrequency } from "@hu/types";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  ApiRequestError,
  formatAuthFormError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import { getMe } from "../../auth/auth-api";
import { PreferenceOption } from "../../preferences/components/PreferenceOption";
import {
  confirmAlternativeNotificationEmail,
  getNotificationEmailDestination,
  removeAlternativeNotificationEmail,
  requestAlternativeNotificationEmail,
  useAccountNotificationEmail,
  type NotificationEmailDestinationView,
} from "../../preferences/notification-email-api";
import { buildOrdinaryCommunicationPreferencesUpdate } from "../../preferences/communication-preferences-patch";
import {
  getMyPreferences,
  MEMBER_PREFERENCES_CHANGED_EVENT,
  updateMyPreferences,
} from "../../preferences/preferences-api";

import "./email-notifications-settings-widget.css";

const NOTIFICATION_FREQUENCIES: readonly NotificationFrequency[] = [
  "immediate",
  "daily_digest",
  "weekly_digest",
  "platform_only",
];

const PREFERENCES_NOTIFICATION_HREF = "/preferences#notification-preferences";

type LoadState = "loading" | "ready" | "error" | "unauthenticated";
type SaveState = "idle" | "saving" | "saved" | "error";
type AltActionState = "idle" | "working" | "success" | "error";

function resolveOptIn(preferences: MemberPreferences): boolean {
  return preferences.communicationPreferences.notificationEmailCopiesOptIn === true;
}

function secondsUntil(iso: string | null): number {
  if (!iso) {
    return 0;
  }
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
}

function MailIcon() {
  return (
    <svg
      className="email-notifications-settings__mail-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
      />
    </svg>
  );
}

export function EmailNotificationsSettingsWidget() {
  const t = useTranslations("notifications.emailSettings");
  const tPrefs = useTranslations("preferences");
  const titleId = useId();
  const panelId = useId();
  const frequencyId = useId();
  const altEmailId = useId();
  const codeId = useId();

  /** Default collapsed so Notification Center lists stay above the fold. */
  const [expanded, setExpanded] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null);
  const [destination, setDestination] = useState<NotificationEmailDestinationView | null>(null);

  const [altEmailInput, setAltEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [altActionState, setAltActionState] = useState<AltActionState>("idle");
  const [altActionError, setAltActionError] = useState<string | null>(null);
  const [altActionSuccess, setAltActionSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const preferencesRef = useRef<MemberPreferences | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  preferencesRef.current = preferences;

  const applyPreferences = useCallback((next: MemberPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
  }, []);

  const applyDestination = useCallback((next: NotificationEmailDestinationView) => {
    setDestination(next);
    // Countdown only applies while a pending verification exists.
    setCooldownSeconds(
      next.pendingAlternativeEmail ? secondsUntil(next.resendAvailableAt) : 0,
    );
    if (next.pendingAlternativeEmail) {
      setAltEmailInput(next.pendingAlternativeEmail);
    }
  }, []);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);

    try {
      const [user, prefs, dest] = await Promise.all([
        getMe(),
        getMyPreferences(),
        getNotificationEmailDestination(),
      ]);
      setAccountEmail(typeof user.email === "string" && user.email.trim() ? user.email : null);
      setEmailVerified(user.emailVerificationStatus === "verified");
      applyPreferences(prefs);
      applyDestination(dest);
      setLoadState("ready");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setLoadState("unauthenticated");
        return;
      }
      setLoadError(formatAuthFormError(error));
      setLoadState("error");
    }
  }, [applyDestination, applyPreferences]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onPreferencesChanged() {
      void Promise.all([getMyPreferences(), getNotificationEmailDestination()])
        .then(([prefs, dest]) => {
          applyPreferences(prefs);
          applyDestination(dest);
        })
        .catch(() => {
          // Keep current widget state; next explicit load/save will recover.
        });
    }

    window.addEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    return () => {
      window.removeEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    };
  }, [applyDestination, applyPreferences]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function persistCommunicationPatch(
    patch: Partial<MemberPreferences["communicationPreferences"]>,
  ): void {
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const baseline = preferencesRef.current;
        if (!baseline) {
          return;
        }

        setSaveState("saving");
        setSaveError(null);

        try {
          const updated = await updateMyPreferences({
            communicationPreferences: buildOrdinaryCommunicationPreferencesUpdate({
              baseline: {
                ...baseline.communicationPreferences,
                notificationEmailCopiesOptIn: resolveOptIn(baseline),
              },
              patch,
            }),
          });
          applyPreferences(updated);
          setSaveState("saved");
        } catch (error) {
          setSaveError(formatAuthFormError(error));
          setSaveState("error");
          try {
            const latest = await getMyPreferences();
            applyPreferences(latest);
          } catch {
            // Keep baseline preferencesRef; UI already shows the failure.
          }
        }
      });
  }

  async function runAltAction(
    action: () => Promise<{ preferences: MemberPreferences; destination: NotificationEmailDestinationView }>,
    successKey: "requestSuccess" | "confirmSuccess" | "useAccountSuccess" | "removeSuccess",
  ): Promise<void> {
    setAltActionState("working");
    setAltActionError(null);
    setAltActionSuccess(null);
    try {
      const result = await action();
      applyPreferences(result.preferences);
      applyDestination(result.destination);
      // Clear stale ordinary-save errors so success is not paired with a leftover alert.
      setSaveError(null);
      setSaveState((current) => (current === "error" ? "idle" : current));
      setAltActionState("success");
      setAltActionSuccess(t(successKey));
      if (successKey === "confirmSuccess" || successKey === "removeSuccess") {
        setCodeInput("");
      }
      if (!result.destination.pendingAlternativeEmail) {
        setCooldownSeconds(0);
      }
    } catch (error) {
      setAltActionState("error");
      if (error instanceof ApiRequestError && error.status === 429) {
        setAltActionError(t("rateLimited"));
      } else {
        const message = formatAuthFormError(error);
        if (/expired/i.test(message)) {
          setAltActionError(t("codeExpired"));
        } else if (/incorrect|invalid/i.test(message)) {
          setAltActionError(t("codeInvalid"));
        } else {
          setAltActionError(message || t("altActionError"));
        }
      }
    }
  }

  function toggleExpanded(): void {
    // UI-only: never persist preferences or call APIs on accordion toggle.
    setExpanded((current) => !current);
  }

  if (loadState === "unauthenticated") {
    return null;
  }

  const optIn = preferences ? resolveOptIn(preferences) : false;
  const frequency = preferences?.communicationPreferences.notificationFrequency ?? "daily_digest";
  const featureEmailEnabled =
    preferences?.communicationPreferences.emailNotificationsEnabled === true;
  const controlsDisabled = saveState === "saving" || altActionState === "working";
  const mode = destination?.destinationMode ?? "account";
  const pending = destination?.pendingAlternativeEmail ?? null;
  const verifiedAlt = destination?.alternativeEmail ?? null;

  return (
    <section
      className="email-notifications-settings"
      data-email-notifications-settings="true"
      data-expanded={expanded ? "true" : "false"}
    >
      <h2 className="email-notifications-settings__heading">
        <button
          type="button"
          className="email-notifications-settings__trigger"
          id={titleId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggleExpanded}
        >
          <span className="email-notifications-settings__trigger-main">
            <MailIcon />
            <span className="email-notifications-settings__trigger-text">
              <span className="email-notifications-settings__title">{t("title")}</span>
              <span className="email-notifications-settings__subtitle">{t("collapsedSummary")}</span>
            </span>
          </span>
          <span className="email-notifications-settings__chevron" aria-hidden="true" />
        </button>
      </h2>

      <div
        id={panelId}
        className="email-notifications-settings__panel"
        role="region"
        aria-labelledby={titleId}
        hidden={!expanded}
      >
        {loadState === "loading" ? (
          <p className="email-notifications-settings__status" role="status">
            {t("loading")}
          </p>
        ) : null}

        {loadState === "error" ? (
          <div className="email-notifications-settings__footer">
            <p className="email-notifications-settings__error" role="alert">
              {loadError ?? t("loadError")}
            </p>
            <button
              type="button"
              className="email-notifications-settings__button"
              onClick={() => void load()}
            >
              {t("retry")}
            </button>
          </div>
        ) : null}

        {loadState === "ready" && preferences ? (
          <div className="email-notifications-settings__body">
            <div className="email-notifications-settings__field">
              <span className="email-notifications-settings__label">{t("currentDestination")}</span>
              <p className="email-notifications-settings__value">
                {mode === "alternative" && verifiedAlt
                  ? t("destinationAlternative", { email: verifiedAlt })
                  : accountEmail && emailVerified
                    ? t("destinationAccount", { email: accountEmail })
                    : t("destinationUnavailable")}
              </p>
              {!emailVerified ? (
                <p className="email-notifications-settings__warning" role="status">
                  {t("accountEmailUnverified")}{" "}
                  <Link className="email-notifications-settings__link" href="/confirm-email">
                    {t("confirmEmailCta")}
                  </Link>
                </p>
              ) : null}
              {emailVerified && mode === "alternative" && accountEmail ? (
                <p className="email-notifications-settings__help">
                  {t("loginEmailHint", { email: accountEmail })}
                </p>
              ) : null}
            </div>

            <div className="email-notifications-settings__field">
              <PreferenceOption
                name="emailNotificationsEnabled"
                label={tPrefs("notification.emailEnabled")}
                checked={featureEmailEnabled}
                onChange={(checked) => {
                  if (controlsDisabled) {
                    return;
                  }
                  persistCommunicationPatch({ emailNotificationsEnabled: checked });
                }}
              />
              <p className="email-notifications-settings__help">{t("emailEnabledHelpShort")}</p>
            </div>

            <div className="email-notifications-settings__field">
              <PreferenceOption
                name="notificationEmailCopiesOptIn"
                label={tPrefs("notification.copiesOptIn")}
                checked={optIn}
                onChange={(checked) => {
                  if (controlsDisabled) {
                    return;
                  }
                  persistCommunicationPatch({ notificationEmailCopiesOptIn: checked });
                }}
              />
              <p className="email-notifications-settings__help">{t("copiesHelpShort")}</p>
            </div>

            <div className="email-notifications-settings__field">
              <label className="email-notifications-settings__label" htmlFor={frequencyId}>
                {tPrefs("communication.notificationFrequency")}
              </label>
              <select
                id={frequencyId}
                className="email-notifications-settings__select"
                value={frequency}
                disabled={controlsDisabled}
                onChange={(event) => {
                  persistCommunicationPatch({
                    notificationFrequency: event.target.value as NotificationFrequency,
                  });
                }}
              >
                {NOTIFICATION_FREQUENCIES.map((value) => (
                  <option key={value} value={value}>
                    {tPrefs(`notificationFrequencies.${value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="email-notifications-settings__field email-notifications-settings__field--muted">
              <span className="email-notifications-settings__label">{t("alternativeEmail")}</span>
              <p className="email-notifications-settings__help">{t("alternativeEmailHelp")}</p>

              {verifiedAlt ? (
                <p className="email-notifications-settings__value">
                  {t("verifiedAlternative", { email: verifiedAlt })}
                </p>
              ) : null}

              {pending ? (
                <p className="email-notifications-settings__warning" role="status">
                  {t("pendingAlternative", {
                    email: destination?.pendingMaskedEmail ?? pending,
                  })}
                </p>
              ) : null}

              <label className="email-notifications-settings__label" htmlFor={altEmailId}>
                {t("alternativeEmailInput")}
              </label>
              <input
                id={altEmailId}
                type="email"
                autoComplete="email"
                className="email-notifications-settings__select"
                value={altEmailInput}
                disabled={controlsDisabled || !emailVerified}
                onChange={(event) => setAltEmailInput(event.target.value)}
              />
              <div className="email-notifications-settings__actions">
                <button
                  type="button"
                  className="email-notifications-settings__button email-notifications-settings__button--primary"
                  disabled={
                    controlsDisabled || !emailVerified || cooldownSeconds > 0 || !altEmailInput.trim()
                  }
                  onClick={() =>
                    void runAltAction(
                      () => requestAlternativeNotificationEmail(altEmailInput.trim()),
                      "requestSuccess",
                    )
                  }
                >
                  {cooldownSeconds > 0
                    ? t("resendCooldown", { seconds: cooldownSeconds })
                    : pending
                      ? t("resendCode")
                      : t("requestVerification")}
                </button>
              </div>

              {pending ? (
                <>
                  <label className="email-notifications-settings__label" htmlFor={codeId}>
                    {t("verificationCode")}
                  </label>
                  <input
                    id={codeId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="email-notifications-settings__select"
                    value={codeInput}
                    disabled={controlsDisabled}
                    onChange={(event) => setCodeInput(event.target.value)}
                  />
                  <div className="email-notifications-settings__actions">
                    <button
                      type="button"
                      className="email-notifications-settings__button email-notifications-settings__button--primary"
                      disabled={controlsDisabled || codeInput.trim().length !== 6}
                      onClick={() =>
                        void runAltAction(
                          () => confirmAlternativeNotificationEmail(codeInput.trim()),
                          "confirmSuccess",
                        )
                      }
                    >
                      {t("confirmCode")}
                    </button>
                  </div>
                </>
              ) : null}

              <div className="email-notifications-settings__actions">
                {mode === "alternative" ? (
                  <button
                    type="button"
                    className="email-notifications-settings__button email-notifications-settings__button--secondary"
                    disabled={controlsDisabled}
                    onClick={() =>
                      void runAltAction(() => useAccountNotificationEmail(), "useAccountSuccess")
                    }
                  >
                    {t("useAccountEmail")}
                  </button>
                ) : null}
                {verifiedAlt || pending ? (
                  <button
                    type="button"
                    className="email-notifications-settings__button email-notifications-settings__button--secondary"
                    disabled={controlsDisabled}
                    onClick={() =>
                      void runAltAction(
                        () => removeAlternativeNotificationEmail(),
                        "removeSuccess",
                      )
                    }
                  >
                    {t("removeAlternative")}
                  </button>
                ) : null}
              </div>
            </div>

            <p className="email-notifications-settings__help">
              <Link
                className="email-notifications-settings__link"
                href={PREFERENCES_NOTIFICATION_HREF}
              >
                {t("openWorkspacePreferences")}
              </Link>
            </p>

            {saveState === "saving" || altActionState === "working" ? (
              <p className="email-notifications-settings__status" role="status">
                {t("saving")}
              </p>
            ) : null}
            {saveState === "saved" ? (
              <p className="email-notifications-settings__status" role="status">
                {t("saved")}
              </p>
            ) : null}
            {altActionSuccess ? (
              <p className="email-notifications-settings__status" role="status">
                {altActionSuccess}
              </p>
            ) : null}
            {saveState === "error" ? (
              <p className="email-notifications-settings__error" role="alert">
                {saveError ?? t("saveError")}
              </p>
            ) : null}
            {altActionState === "error" ? (
              <p className="email-notifications-settings__error" role="alert">
                {altActionError ?? t("altActionError")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
