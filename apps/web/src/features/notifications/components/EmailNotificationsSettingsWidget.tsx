"use client";

/**
 * HU-NOTIF-02A.1 — Email Notifications settings on Notification Center.
 * Shares MemberPreferences with PreferencesWorkspace; does not activate email delivery.
 */

import type { MemberPreferences, NotificationFrequency } from "@hu/types";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { getMe } from "../../auth/auth-api";
import { PreferenceOption } from "../../preferences/components/PreferenceOption";
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

function resolveOptIn(preferences: MemberPreferences): boolean {
  return preferences.communicationPreferences.notificationEmailCopiesOptIn === true;
}

export function EmailNotificationsSettingsWidget() {
  const t = useTranslations("notifications.emailSettings");
  const tPrefs = useTranslations("preferences");
  const titleId = useId();
  const frequencyId = useId();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null);

  const preferencesRef = useRef<MemberPreferences | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  preferencesRef.current = preferences;

  const applyPreferences = useCallback((next: MemberPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
  }, []);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);

    try {
      const [user, prefs] = await Promise.all([getMe(), getMyPreferences()]);
      setAccountEmail(typeof user.email === "string" && user.email.trim() ? user.email : null);
      setEmailVerified(user.emailVerificationStatus === "verified");
      applyPreferences(prefs);
      setLoadState("ready");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setLoadState("unauthenticated");
        return;
      }
      setLoadError(formatAuthFormError(error));
      setLoadState("error");
    }
  }, [applyPreferences]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onPreferencesChanged() {
      void getMyPreferences()
        .then((prefs) => {
          applyPreferences(prefs);
        })
        .catch(() => {
          // Keep current widget state; next explicit load/save will recover.
        });
    }

    window.addEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    return () => {
      window.removeEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    };
  }, [applyPreferences]);

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
            communicationPreferences: {
              ...baseline.communicationPreferences,
              notificationEmailCopiesOptIn: resolveOptIn(baseline),
              ...patch,
            },
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

  if (loadState === "unauthenticated") {
    return null;
  }

  const optIn = preferences ? resolveOptIn(preferences) : false;
  const frequency = preferences?.communicationPreferences.notificationFrequency ?? "daily_digest";
  const featureEmailEnabled =
    preferences?.communicationPreferences.emailNotificationsEnabled === true;
  const controlsDisabled = saveState === "saving";

  return (
    <section
      className="email-notifications-settings"
      aria-labelledby={titleId}
      data-email-notifications-settings="true"
    >
      <div className="email-notifications-settings__header">
        <h2 id={titleId} className="email-notifications-settings__title">
          {t("title")}
        </h2>
        <p className="email-notifications-settings__lead">{t("preparationNotice")}</p>
        <p className="email-notifications-settings__help">
          <Link className="email-notifications-settings__link" href={PREFERENCES_NOTIFICATION_HREF}>
            {t("openWorkspacePreferences")}
          </Link>
        </p>
      </div>

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
          <button type="button" className="email-notifications-settings__button" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {loadState === "ready" && preferences ? (
        <div className="email-notifications-settings__body">
          <div className="email-notifications-settings__field">
            <span className="email-notifications-settings__label">{t("accountEmail")}</span>
            {emailVerified && accountEmail ? (
              <p className="email-notifications-settings__value">{accountEmail}</p>
            ) : (
              <p className="email-notifications-settings__warning" role="status">
                {t("accountEmailUnverified")}{" "}
                <Link className="email-notifications-settings__link" href="/confirm-email">
                  {t("confirmEmailCta")}
                </Link>
              </p>
            )}
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
            <p className="email-notifications-settings__help">{tPrefs("notification.emailHelp")}</p>
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
            <p className="email-notifications-settings__help">{tPrefs("notification.copiesHelp")}</p>
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
            <p className="email-notifications-settings__help">{t("alternativeEmailUnavailable")}</p>
          </div>

          {saveState === "saving" ? (
            <p className="email-notifications-settings__status" role="status">
              {t("saving")}
            </p>
          ) : null}
          {saveState === "saved" ? (
            <p className="email-notifications-settings__status" role="status">
              {t("saved")}
            </p>
          ) : null}
          {saveState === "error" ? (
            <p className="email-notifications-settings__error" role="alert">
              {saveError ?? t("saveError")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
