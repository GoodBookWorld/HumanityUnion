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

import { SurfaceAssistantEntry } from "../../humanity-union-assistant";
import { PreferenceOption, PreferenceOptionGrid } from "./PreferenceOption";
import { PreferredGeographyFields } from "./PreferredGeographyFields";

import "./preferences-workspace.css";

const TRANSLATION_PREFERENCE_OPTIONS = [
  { value: "none", label: "Always show original" },
  { value: "preferred", label: "Prefer translation when available" },
  { value: "ask", label: "Offer translation; keep original by default" },
] as const;

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

const GEOGRAPHIC_SCOPES = ["world", "country", "region", "community"];

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
              loadError instanceof Error ? loadError.message : "Unable to load preferences.",
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
        setError(saveError instanceof Error ? saveError.message : "Unable to save preferences.");
      }
    }
  }

  if (loading) {
    return <p>Loading preferences...</p>;
  }

  if (apiUnavailable) {
    return (
      <ApiUnavailableState
        title="Preferences temporarily unavailable"
        explanation="We couldn't connect to the Humanity Union service. Please try again shortly."
        retryHref="/preferences"
      />
    );
  }

  if (authRequired) {
    return (
      <ProfileSection title="Preferences">
        <p>Sign in to manage your preferences.</p>
        <Button href="/login?returnTo=/preferences">Log in</Button>
      </ProfileSection>
    );
  }

  if (!preferences) {
    return (
      <ProfileSection title="Preferences">
        <p>{error ?? "Preferences are unavailable."}</p>
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
        label="Ask Humanity Union Assistant about Preferences"
      />

      <ProfileSection title="Language & Translation" id="language">
        <p className="preferences-workspace__help">
          Interface Language controls platform navigation. Preferred Reading Language is used for
          translated public content. Writing Languages are languages you commonly write in.
          Translation Preference controls whether translations are shown automatically.
        </p>
        <label className="preferences-workspace__field">
          <span>Interface Language</span>
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
          <span>Preferred Reading Language</span>
          <select
            value={
              languageOptions.some(
                (option) =>
                  option.code === (preferences.experiencePreferences.readingLanguages[0] ?? "en"),
              )
                ? (preferences.experiencePreferences.readingLanguages[0] ?? "en")
                : (languageOptions[0]?.code ?? "en")
            }
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
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName} ({option.code})
              </option>
            ))}
          </select>
        </label>
        <label className="preferences-workspace__field">
          <span>Writing Languages (comma-separated codes)</span>
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
            placeholder="en, uk"
          />
        </label>
        <label className="preferences-workspace__field">
          <span>Translation Preference</span>
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
            {TRANSLATION_PREFERENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </ProfileSection>

      <ProfileSection title="Experience" id="experience">
        <div className="preferences-workspace__field">
          <span className="preferences-workspace__field-label">Expertise / activity areas</span>
          <PreferenceOptionGrid columns={2}>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((area) => (
              <PreferenceOption
                key={area}
                label={area}
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
          <span>Skills (comma-separated)</span>
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
          <span>Experience level (optional)</span>
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

      <ProfileSection title="Participation" id="participation">
        <div className="preferences-workspace__field">
          <span className="preferences-workspace__field-label">Preferred civic activity areas</span>
          <PreferenceOptionGrid columns={2}>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((area) => (
              <PreferenceOption
                key={`participation-${area}`}
                label={area}
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
          <span className="preferences-workspace__field-label">Preferred geographic scopes</span>
          <PreferenceOptionGrid>
            {GEOGRAPHIC_SCOPES.map((scope) => (
              <PreferenceOption
                key={scope}
                label={scope}
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
          <span>Initiative participation interests (comma-separated)</span>
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
          <legend>Willingness to contribute</legend>
          <PreferenceOptionGrid>
            {CONTRIBUTION_OPTIONS.map((option) => (
              <PreferenceOption
                key={option}
                label={option}
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

      <ProfileSection title="Communication" id="communication">
        <label className="preferences-workspace__field">
          <span>Notification frequency</span>
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
                {frequency.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <PreferenceOption
          label="Notify me when a new initiative matches my saved interests"
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
      <ProfileSection title="Notification Preferences" id="notification-preferences">
        <PreferenceOption
          label="Receive email notifications"
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
        <p className="preferences-workspace__helper">
          When enabled, Humanity Union will send simple email notifications when new activity requires
          your attention. Example: &ldquo;You have 3 new notifications in your Workspace.&rdquo; Emails
          never contain private conversation content or confidential Initiative information.
        </p>
      </ProfileSection>

      <ProfileSection title="Accessibility" id="accessibility">
        <PreferenceOptionGrid>
          <PreferenceOption
            label="Reduced motion"
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
            label="Higher contrast preference"
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
            label="Simplified explanations"
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
          <span>Preferred content density</span>
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
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
      </ProfileSection>

      <ProfileSection title="Visibility" id="visibility">
        {(
          [
            ["profileVisibility", "Who can see my public profile"],
            ["skillsVisibility", "Who can see my Skills"],
            ["interestsVisibility", "Who can see my Interests"],
            ["participationVisibility", "Who can see my Participation Areas"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="preferences-workspace__field">
            <span>{label}</span>
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
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </ProfileSection>

      <div className="preferences-workspace__actions">
        <Button type="submit" variant="primary" disabled={savePhase.isBusy} ariaLive="polite">
          {resolveSaveButtonLabel(savePhase.phase, "Save Preferences")}
        </Button>
      </div>
    </form>
  );
}
