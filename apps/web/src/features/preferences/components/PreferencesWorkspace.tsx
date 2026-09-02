"use client";

import type {
  ContributionWillingness,
  MemberPreferences,
  MemberProfileVisibility,
  NotificationFrequency,
} from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ApiUnavailableState } from "../../../design-system/components/ApiUnavailableState";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import {
  listPriorityLanguages,
  type PriorityLanguageOption,
} from "../../language/translation-api";
import { writeHuLangCookieViaWebRoute } from "../../language/write-hu-lang-cookie";
import { markInterfaceLanguageCookieSynced } from "../../language/components/InterfaceLanguageCookieSync";
import { getMyPreferences, updateMyPreferences } from "../preferences-api";

import { useTranslations } from "next-intl";

import { SurfaceAssistantEntry } from "../../humanity-union-assistant";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { PreferenceOption, PreferenceOptionGrid } from "./PreferenceOption";
import { PreferredGeographyFields } from "./PreferredGeographyFields";

import "./preferences-workspace.css";

const TRANSLATION_PREFERENCE_CODES = ["none", "preferred", "ask"] as const;

const CONTRIBUTION_OPTIONS: ContributionWillingness[] = [
  "analysis",
  "proposals",
  "implementation",
  "evidence",
  "translation",
  "coordination",
];

const NOTIFICATION_FREQUENCIES: NotificationFrequency[] = [
  "immediate",
  "daily_digest",
  "weekly_digest",
  "platform_only",
];

const VISIBILITY_OPTIONS: MemberProfileVisibility[] = ["public", "members_only", "private"];

const GEOGRAPHIC_SCOPES = ["world", "country", "region", "community"] as const;

const CONTENT_DENSITY_OPTIONS = ["compact", "comfortable", "spacious"] as const;

const VISIBILITY_FIELDS = [
  "profileVisibility",
  "skillsVisibility",
  "interestsVisibility",
  "participationVisibility",
] as const;

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function formatCommaList(values: string[]): string {
  return values.join(", ");
}

function toggleValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }

  return values.filter((entry) => entry !== value);
}

export function PreferencesWorkspace() {
  const t = useTranslations("preferences");
  const tAuth = useTranslations("auth");
  const tExperience = useTranslations("initiativeExperience");
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null);
  const [languageOptions, setLanguageOptions] = useState<readonly PriorityLanguageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  /** UX Completion Pack 04 Part 9 — the same delayed Save feedback used on `/member` (Profile, Skills, Privacy, ...). */
  const savePhase = useSaveButtonPhase();

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getMyPreferences(), listPriorityLanguages()])
      .then(([loaded, languages]) => {
        if (!cancelled) {
          setPreferences(loaded);
          setLanguageOptions(languages);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          if (isAuthenticationRequiredError(loadError)) {
            setAuthRequired(true);
          } else if (isApiUnavailableError(loadError)) {
            setApiUnavailable(true);
          } else {
            setError(
              loadError instanceof Error ? loadError.message : t("loadError"),
            );
          }
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
    // Load once on mount; localized fallbacks use the active catalog at catch time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot fetch
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!preferences) {
      return;
    }

    setError(null);

    try {
      await savePhase.runSave(async () => {
        const updated = await updateMyPreferences({
          experiencePreferences: preferences.experiencePreferences,
          participationPreferences: preferences.participationPreferences,
          communicationPreferences: preferences.communicationPreferences,
          accessibilityPreferences: preferences.accessibilityPreferences,
          workspacePreferences: preferences.workspacePreferences,
          visibilityPreferences: preferences.visibilityPreferences,
        });
        setPreferences(updated);
        // Pack 02C Task 03 — keep Web-origin hu_lang aligned with interfaceLanguage.
        await writeHuLangCookieViaWebRoute(
          updated.experiencePreferences.interfaceLanguage,
        );
        markInterfaceLanguageCookieSynced(updated.experiencePreferences.interfaceLanguage);
      });
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        setAuthRequired(true);
      } else {
        setError(saveError instanceof Error ? saveError.message : t("saveError"));
      }
    }
  }

  if (loading) {
    return <p>{t("loading")}</p>;
  }

  if (apiUnavailable) {
    return (
      <ApiUnavailableState
        title={t("unavailableTitle")}
        explanation={t("unavailableExplanation")}
        retryHref="/preferences"
      />
    );
  }

  if (authRequired) {
    return (
      <ProfileSection title={t("title")}>
        <p>{t("signInPrompt")}</p>
        <Button href="/login?returnTo=/preferences">{tAuth("logIn")}</Button>
      </ProfileSection>
    );
  }

  if (!preferences) {
    return (
      <ProfileSection title={t("title")}>
        <p>{error ?? t("unavailable")}</p>
      </ProfileSection>
    );
  }

  return (
    <form className="preferences-workspace" onSubmit={(event) => void handleSubmit(event)}>
      {error ? (
        <p className="preferences-workspace__error" role="alert">
          {error}
        </p>
      ) : null}

      <SurfaceAssistantEntry
        surfaceId="preferences"
        label={tExperience("assistant.entry.preferencesLauncher")}
      />

      <ProfileSection title={t("sections.language")} id="language">
        <p className="preferences-workspace__help">{t("language.help")}</p>
        <label className="preferences-workspace__field">
          <span>{t("language.interfaceLanguage")}</span>
          <select
            value={
              languageOptions.some(
                (option) => option.code === preferences.experiencePreferences.interfaceLanguage,
              )
                ? preferences.experiencePreferences.interfaceLanguage
                : (languageOptions[0]?.code ?? "en")
            }
            onChange={(event) =>
              setPreferences({
                ...preferences,
                experiencePreferences: {
                  ...preferences.experiencePreferences,
                  interfaceLanguage: event.target.value,
                },
              })
            }
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName} ({option.code})
              </option>
            ))}
          </select>
        </label>
        <label className="preferences-workspace__field">
          <span>{t("language.preferredReadingLanguage")}</span>
          {(() => {
            const persistedReading =
              preferences.experiencePreferences.readingLanguages[0]?.trim() || "";
            const readingInOptions =
              persistedReading.length > 0 &&
              languageOptions.some((option) => option.code === persistedReading);
            return (
              <>
                <select
                  value={readingInOptions ? persistedReading : persistedReading || ""}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      experiencePreferences: {
                        ...preferences.experiencePreferences,
                        readingLanguages: [event.target.value],
                      },
                    })
                  }
                >
                  {!readingInOptions && persistedReading ? (
                    <option value={persistedReading}>
                      {t("language.savedUnavailable", { code: persistedReading })}
                    </option>
                  ) : null}
                  {!persistedReading ? (
                    <option value="" disabled>
                      {t("language.noReadingLanguage")}
                    </option>
                  ) : null}
                  {languageOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.nativeName} ({option.code})
                    </option>
                  ))}
                </select>
                {!readingInOptions && persistedReading ? (
                  <p className="preferences-workspace__help">
                    {t("language.savedReadingHelp", { code: persistedReading })}
                  </p>
                ) : null}
              </>
            );
          })()}
        </label>
        <label className="preferences-workspace__field">
          <span>{t("language.writingLanguages")}</span>
          <input
            value={formatCommaList(preferences.experiencePreferences.writingLanguages)}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                experiencePreferences: {
                  ...preferences.experiencePreferences,
                  writingLanguages: parseCommaList(event.target.value),
                },
              })
            }
            placeholder={t("language.writingLanguagesPlaceholder")}
          />
        </label>
        <label className="preferences-workspace__field">
          <span>{t("language.translationPreference")}</span>
          <select
            value={preferences.experiencePreferences.translationPreference || "none"}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                experiencePreferences: {
                  ...preferences.experiencePreferences,
                  translationPreference: event.target.value,
                },
              })
            }
          >
            {TRANSLATION_PREFERENCE_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`translationPreferences.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </ProfileSection>

      <ProfileSection title={t("sections.experience")} id="experience">
        <div className="preferences-workspace__field">
          <span className="preferences-workspace__field-label">
            {t("experience.expertiseAreas")}
          </span>
          <PreferenceOptionGrid columns={2}>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((area) => (
              <PreferenceOption
                key={area}
                label={resolveActivityAreaDisplayLabel(area, tExperience)}
                checked={preferences.experiencePreferences.expertiseAreas.includes(area)}
                onChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    experiencePreferences: {
                      ...preferences.experiencePreferences,
                      expertiseAreas: toggleValue(
                        preferences.experiencePreferences.expertiseAreas,
                        area,
                        checked,
                      ),
                    },
                  })
                }
              />
            ))}
          </PreferenceOptionGrid>
        </div>
        <label className="preferences-workspace__field">
          <span>{t("experience.skills")}</span>
          <input
            value={formatCommaList(preferences.experiencePreferences.skills)}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                experiencePreferences: {
                  ...preferences.experiencePreferences,
                  skills: parseCommaList(event.target.value),
                },
              })
            }
          />
        </label>
        <label className="preferences-workspace__field">
          <span>{t("experience.experienceLevel")}</span>
          <input
            value={preferences.experiencePreferences.experienceLevel ?? ""}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                experiencePreferences: {
                  ...preferences.experiencePreferences,
                  experienceLevel: event.target.value || undefined,
                },
              })
            }
          />
        </label>
      </ProfileSection>

      <ProfileSection title={t("sections.participation")} id="participation">
        <div className="preferences-workspace__field">
          <span className="preferences-workspace__field-label">
            {t("participation.preferredActivityAreas")}
          </span>
          <PreferenceOptionGrid columns={2}>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((area) => (
              <PreferenceOption
                key={`participation-${area}`}
                label={resolveActivityAreaDisplayLabel(area, tExperience)}
                checked={preferences.participationPreferences.preferredActivityAreas.includes(area)}
                onChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    participationPreferences: {
                      ...preferences.participationPreferences,
                      preferredActivityAreas: toggleValue(
                        preferences.participationPreferences.preferredActivityAreas,
                        area,
                        checked,
                      ),
                    },
                  })
                }
              />
            ))}
          </PreferenceOptionGrid>
        </div>
        <div className="preferences-workspace__field">
          <span className="preferences-workspace__field-label">
            {t("participation.preferredGeographicScopes")}
          </span>
          <PreferenceOptionGrid>
            {GEOGRAPHIC_SCOPES.map((scope) => (
              <PreferenceOption
                key={scope}
                label={tExperience(`geography.${scope}`)}
                checked={preferences.participationPreferences.preferredGeographicScopes.includes(
                  scope,
                )}
                onChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    participationPreferences: {
                      ...preferences.participationPreferences,
                      preferredGeographicScopes: toggleValue(
                        preferences.participationPreferences.preferredGeographicScopes,
                        scope,
                        checked,
                      ),
                    },
                  })
                }
              />
            ))}
          </PreferenceOptionGrid>
        </div>
        <PreferredGeographyFields
          participationPreferences={preferences.participationPreferences}
          onChange={(participationPreferences) =>
            setPreferences({
              ...preferences,
              participationPreferences,
            })
          }
        />
        <label className="preferences-workspace__field">
          <span>{t("participation.initiativeInterests")}</span>
          <input
            value={formatCommaList(
              preferences.participationPreferences.initiativeParticipationInterests,
            )}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                participationPreferences: {
                  ...preferences.participationPreferences,
                  initiativeParticipationInterests: parseCommaList(event.target.value),
                },
              })
            }
          />
        </label>
        <fieldset className="preferences-workspace__fieldset">
          <legend>{t("participation.contributionWillingness")}</legend>
          <PreferenceOptionGrid>
            {CONTRIBUTION_OPTIONS.map((option) => (
              <PreferenceOption
                key={option}
                label={t(`contribution.${option}`)}
                checked={preferences.participationPreferences.contributionWillingness.includes(
                  option,
                )}
                onChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    participationPreferences: {
                      ...preferences.participationPreferences,
                      contributionWillingness: toggleValue(
                        preferences.participationPreferences.contributionWillingness,
                        option,
                        checked,
                      ),
                    },
                  })
                }
              />
            ))}
          </PreferenceOptionGrid>
        </fieldset>
      </ProfileSection>

      <ProfileSection title={t("sections.communication")} id="communication">
        <label className="preferences-workspace__field">
          <span>{t("communication.notificationFrequency")}</span>
          <select
            value={preferences.communicationPreferences.notificationFrequency}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                communicationPreferences: {
                  ...preferences.communicationPreferences,
                  notificationFrequency: event.target.value as NotificationFrequency,
                },
              })
            }
          >
            {NOTIFICATION_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {t(`notificationFrequencies.${frequency}`)}
              </option>
            ))}
          </select>
        </label>
        <PreferenceOption
          label={t("communication.interestMatch")}
          checked={preferences.communicationPreferences.interestMatchNotificationsEnabled}
          onChange={(checked) =>
            setPreferences({
              ...preferences,
              communicationPreferences: {
                ...preferences.communicationPreferences,
                interestMatchNotificationsEnabled: checked,
              },
            })
          }
        />
      </ProfileSection>

      {/*
       * Lifecycle UX Correction Pack 01 Part 8 — a dedicated Notification
       * Preferences section (distinct from the general "Communication"
       * section above), reusing the existing
       * `communicationPreferences.emailNotificationsEnabled` field so this
       * one boolean is never duplicated across two controls. This is only
       * a notification *trigger*: the description below is the exact copy
       * required by Part 8, and the actual content is always read inside
       * Humanity Union, never in the email itself.
       */}
      <ProfileSection title={t("sections.notification")} id="notification-preferences">
        <PreferenceOption
          label={t("notification.emailEnabled")}
          checked={preferences.communicationPreferences.emailNotificationsEnabled}
          onChange={(checked) =>
            setPreferences({
              ...preferences,
              communicationPreferences: {
                ...preferences.communicationPreferences,
                emailNotificationsEnabled: checked,
              },
            })
          }
        />
        <p className="preferences-workspace__helper">{t("notification.emailHelp")}</p>
      </ProfileSection>

      <ProfileSection title={t("sections.accessibility")} id="accessibility">
        <PreferenceOptionGrid>
          <PreferenceOption
            label={t("accessibility.reducedMotion")}
            checked={preferences.accessibilityPreferences.reducedMotion}
            onChange={(checked) =>
              setPreferences({
                ...preferences,
                accessibilityPreferences: {
                  ...preferences.accessibilityPreferences,
                  reducedMotion: checked,
                },
              })
            }
          />
          <PreferenceOption
            label={t("accessibility.highContrast")}
            checked={preferences.accessibilityPreferences.highContrast}
            onChange={(checked) =>
              setPreferences({
                ...preferences,
                accessibilityPreferences: {
                  ...preferences.accessibilityPreferences,
                  highContrast: checked,
                },
              })
            }
          />
          <PreferenceOption
            label={t("accessibility.simplifiedExplanations")}
            checked={preferences.accessibilityPreferences.simplifiedExplanations}
            onChange={(checked) =>
              setPreferences({
                ...preferences,
                accessibilityPreferences: {
                  ...preferences.accessibilityPreferences,
                  simplifiedExplanations: checked,
                },
              })
            }
          />
        </PreferenceOptionGrid>
        <label className="preferences-workspace__field">
          <span>{t("accessibility.contentDensity")}</span>
          <select
            value={preferences.accessibilityPreferences.contentDensity}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                accessibilityPreferences: {
                  ...preferences.accessibilityPreferences,
                  contentDensity: event.target.value as "compact" | "comfortable" | "spacious",
                },
              })
            }
          >
            {CONTENT_DENSITY_OPTIONS.map((density) => (
              <option key={density} value={density}>
                {t(`contentDensity.${density}`)}
              </option>
            ))}
          </select>
        </label>
      </ProfileSection>

      <ProfileSection title={t("sections.visibility")} id="visibility">
        {VISIBILITY_FIELDS.map((field) => (
          <label key={field} className="preferences-workspace__field">
            <span>{t(`visibility.${field}`)}</span>
            <select
              value={preferences.visibilityPreferences[field]}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  visibilityPreferences: {
                    ...preferences.visibilityPreferences,
                    [field]: event.target.value as MemberProfileVisibility,
                  },
                })
              }
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`visibilityOptions.${option}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </ProfileSection>

      <div className="preferences-workspace__actions">
        <Button type="submit" variant="primary" disabled={savePhase.isBusy} ariaLive="polite">
          {resolveSaveButtonLabel(savePhase.phase, t("save"), {
            saving: t("saving"),
            success: t("saved"),
          })}
        </Button>
      </div>
    </form>
  );
}
