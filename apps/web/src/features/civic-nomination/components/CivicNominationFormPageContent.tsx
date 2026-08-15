"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { CivicNominationExpertiseArea, CivicNominationInstitutionRole } from "@hu/types";

import { Button, Card } from "../../../design-system";
import { GeographySearchSelect } from "../../../design-system/components/GeographySearchSelect";
import {
  fetchCommunitiesByRegion,
  getCountryLabel,
  getRegionLabel,
  OTHER_COMMUNITY_SLUG,
  toGeographyCommunityOptions,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
} from "@hu/geography";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  createCivicNominationDraft,
  submitCivicNomination,
  updateCivicNominationDraft,
} from "../api";
import {
  CIVIC_NOMINATION_MAX_TEXT_LENGTH,
  COUNTRY_REQUIRED_ROLES,
  EVIDENCE_TYPE_LABELS,
  EXPERTISE_AREA_LABELS,
  INSTITUTION_ROLE_LABELS,
  NOMINATABLE_INSTITUTION_ROLES,
  NOMINATION_EVIDENCE_TYPES,
  NOMINATION_EXPERTISE_AREAS,
  civicNominationPosterPath,
  isValidInstitutionRole,
} from "../constants";
import {
  createEmptyEvidenceLink,
  createInitialFormState,
  toCivicNominationPayload,
  validateCivicNominationForm,
  type CivicNominationFormErrors,
  type CivicNominationFormState,
} from "../nomination-form-utils";

import "../civic-nomination.css";

function resolveInitialRole(searchRole: string | null): CivicNominationInstitutionRole {
  if (isValidInstitutionRole(searchRole)) {
    return searchRole;
  }

  return "humanity_council";
}

export function CivicNominationFormPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = useClientAuthStatus();
  const initialRole = useMemo(() => resolveInitialRole(searchParams.get("role")), [searchParams]);

  const [formState, setFormState] = useState<CivicNominationFormState>(() =>
    createInitialFormState(initialRole),
  );
  const [fieldErrors, setFieldErrors] = useState<CivicNominationFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedNominationId, setSavedNominationId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [communityOptions, setCommunityOptions] = useState<
    ReturnType<typeof toGeographyCommunityOptions>
  >([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  const countryOptions = useMemo(() => toGeographyCountryOptions(), []);
  const regionOptions = useMemo(
    () => toGeographyRegionOptions(formState.countryCode, false),
    [formState.countryCode],
  );

  useEffect(() => {
    if (authStatus === "pending") {
      return;
    }

    if (authStatus !== "authenticated") {
      const returnPath = `/institutions/nominations/new?role=${encodeURIComponent(initialRole)}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnPath)}`);
      return;
    }

    setAuthChecked(true);
  }, [authStatus, initialRole, router]);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      institutionRole: initialRole,
    }));
  }, [initialRole]);

  useEffect(() => {
    if (!formState.regionCode) {
      setCommunityOptions([]);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);

    void fetchCommunitiesByRegion(formState.countryCode, formState.regionCode)
      .then((communities) => {
        if (cancelled) {
          return;
        }

        setCommunityOptions(
          toGeographyCommunityOptions(formState.countryCode, formState.regionCode, communities),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityOptions(
            toGeographyCommunityOptions(formState.countryCode, formState.regionCode, []),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommunitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formState.countryCode, formState.regionCode]);

  const countryRequired = COUNTRY_REQUIRED_ROLES.includes(formState.institutionRole);

  function updateField<K extends keyof CivicNominationFormState>(
    key: K,
    value: CivicNominationFormState[K],
  ) {
    setFormState((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function toggleExpertiseArea(area: CivicNominationExpertiseArea) {
    setFormState((current) => {
      const exists = current.expertiseAreas.includes(area);
      return {
        ...current,
        expertiseAreas: exists
          ? current.expertiseAreas.filter((item) => item !== area)
          : [...current.expertiseAreas, area],
      };
    });
    setFieldErrors((current) => ({ ...current, expertiseAreas: undefined }));
  }

  function updateEvidenceLink(
    index: number,
    field: "title" | "url" | "evidenceType" | "summary",
    value: string,
  ) {
    setFormState((current) => ({
      ...current,
      evidenceLinks: current.evidenceLinks.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: value } : link,
      ),
    }));
    setFieldErrors((current) => ({ ...current, evidenceLinks: undefined }));
  }

  function addEvidenceLink() {
    setFormState((current) => ({
      ...current,
      evidenceLinks: [...current.evidenceLinks, createEmptyEvidenceLink()],
    }));
  }

  function removeEvidenceLink(index: number) {
    setFormState((current) => ({
      ...current,
      evidenceLinks: current.evidenceLinks.filter((_, linkIndex) => linkIndex !== index),
    }));
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    setFormError(null);

    try {
      const payload = toCivicNominationPayload(formState);
      const nomination = savedNominationId
        ? await updateCivicNominationDraft(savedNominationId, payload)
        : await createCivicNominationDraft(payload);

      setSavedNominationId(nomination.nominationId);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Unable to save nomination draft.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validateCivicNominationForm(formState);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = toCivicNominationPayload(formState);
      let nominationId = savedNominationId;

      if (nominationId) {
        await updateCivicNominationDraft(nominationId, payload);
      } else {
        const created = await createCivicNominationDraft(payload);
        nominationId = created.nominationId;
      }

      const nomination = await submitCivicNomination(nominationId);

      router.push(civicNominationPosterPath(nomination.nominationId));
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Unable to submit civic nomination.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="civic-nomination-form-page">
        <p>Checking authentication…</p>
      </main>
    );
  }

  return (
    <main className="civic-nomination-form-page">
      <header className="civic-nomination-form-page__header">
        <p className="civic-nomination-form-page__eyebrow">
          <Link href="/institutions">Institutions</Link> / Civic Nomination
        </p>
        <h1>Create Civic Nomination</h1>
        <p>
          Nomination is civic responsibility, not popularity. Focus on experience, evidence,
          achievements, and vision.
        </p>
      </header>

      <Card>
        <form className="civic-nomination-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="civic-nomination-form__section">
            <legend>Nomination Type</legend>
            <label className="civic-nomination-form__radio">
              <input
                type="radio"
                name="nominationType"
                checked={formState.nominationType === "self"}
                onChange={() => updateField("nominationType", "self")}
              />
              <span>I nominate myself</span>
            </label>
            <label className="civic-nomination-form__radio">
              <input
                type="radio"
                name="nominationType"
                checked={formState.nominationType === "other_person"}
                onChange={() => updateField("nominationType", "other_person")}
              />
              <span>I nominate another person</span>
            </label>
          </fieldset>

          <section className="civic-nomination-form__section">
            <h2>Nominee</h2>
            <label className="civic-nomination-form__field">
              <span>Nominee name</span>
              <input
                type="text"
                required
                value={formState.nomineeName}
                onChange={(event) => updateField("nomineeName", event.target.value)}
                aria-invalid={fieldErrors.nomineeName ? true : undefined}
              />
            </label>
            {fieldErrors.nomineeName ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.nomineeName}
              </p>
            ) : null}
            {formState.nominationType === "other_person" ? (
              <p className="civic-nomination-form__notice" role="note">
                The nominee may not yet be registered on the platform. Use their public professional
                name.
              </p>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Role</h2>
            <label className="civic-nomination-form__field">
              <span>Institution role</span>
              <select
                value={formState.institutionRole}
                onChange={(event) =>
                  updateField(
                    "institutionRole",
                    event.target.value as CivicNominationInstitutionRole,
                  )
                }
              >
                {NOMINATABLE_INSTITUTION_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {INSTITUTION_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="civic-nomination-form__section">
            <h2>Civic Scope</h2>
            <GeographySearchSelect
              id="civic-nomination-country"
              label={`Country${countryRequired ? " (required)" : " (optional)"}`}
              helperText="Select the country where civic scope applies."
              value={formState.countryCode}
              options={countryOptions}
              required={countryRequired}
              onChange={(nextCountry) => {
                setFormState((current) => ({
                  ...current,
                  countryCode: nextCountry,
                  countryLabel: getCountryLabel(nextCountry) ?? "",
                  regionCode: "",
                  regionLabel: "",
                  communityCode: "",
                  communityLabel: "",
                }));
                setFieldErrors((current) => ({
                  ...current,
                  countryCode: undefined,
                  form: undefined,
                }));
              }}
            />
            {fieldErrors.countryCode ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.countryCode}
              </p>
            ) : null}
            <GeographySearchSelect
              id="civic-nomination-region"
              label="Region (optional)"
              value={formState.regionCode}
              options={regionOptions}
              disabled={!formState.countryCode}
              onChange={(nextRegion) => {
                setFormState((current) => ({
                  ...current,
                  regionCode: nextRegion,
                  regionLabel: getRegionLabel(current.countryCode, nextRegion) ?? "",
                  communityCode: "",
                  communityLabel: "",
                }));
              }}
            />
            <GeographySearchSelect
              id="civic-nomination-community"
              label="Community (optional)"
              helperText={
                communitiesLoading
                  ? "Loading communities for the selected region…"
                  : "City, municipality, or district within the selected region."
              }
              value={formState.communityCode}
              options={communityOptions}
              disabled={!formState.regionCode || communitiesLoading}
              onChange={(nextCommunity) => {
                setFormState((current) => ({
                  ...current,
                  communityCode: nextCommunity,
                  communityLabel:
                    communityOptions.find((option) => option.slug === nextCommunity)?.label ??
                    (nextCommunity === OTHER_COMMUNITY_SLUG ? "Other / Not listed" : ""),
                }));
              }}
            />
          </section>

          <section className="civic-nomination-form__section">
            <h2>Expertise Areas</h2>
            <div className="civic-nomination-form__checkbox-grid">
              {NOMINATION_EXPERTISE_AREAS.map((area) => (
                <label key={area} className="civic-nomination-form__checkbox">
                  <input
                    type="checkbox"
                    checked={formState.expertiseAreas.includes(area)}
                    onChange={() => toggleExpertiseArea(area)}
                  />
                  <span>{EXPERTISE_AREA_LABELS[area]}</span>
                </label>
              ))}
            </div>
            {fieldErrors.expertiseAreas ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.expertiseAreas}
              </p>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Experience Summary</h2>
            <label className="civic-nomination-form__field">
              <span>Experience summary</span>
              <textarea
                rows={6}
                maxLength={CIVIC_NOMINATION_MAX_TEXT_LENGTH}
                value={formState.experienceSummary}
                onChange={(event) => updateField("experienceSummary", event.target.value)}
                aria-invalid={fieldErrors.experienceSummary ? true : undefined}
              />
            </label>
            {fieldErrors.experienceSummary ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.experienceSummary}
              </p>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Confirmed Achievements</h2>
            <label className="civic-nomination-form__field">
              <span>Confirmed achievements</span>
              <textarea
                rows={6}
                maxLength={CIVIC_NOMINATION_MAX_TEXT_LENGTH}
                value={formState.confirmedAchievements}
                onChange={(event) => updateField("confirmedAchievements", event.target.value)}
                aria-invalid={fieldErrors.confirmedAchievements ? true : undefined}
              />
            </label>
            {fieldErrors.confirmedAchievements ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.confirmedAchievements}
              </p>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Evidence Links</h2>
            {formState.evidenceLinks.map((link, index) => (
              <div key={`evidence-${index}`} className="civic-nomination-form__evidence-row">
                <label className="civic-nomination-form__field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={link.title}
                    onChange={(event) => updateEvidenceLink(index, "title", event.target.value)}
                  />
                </label>
                <label className="civic-nomination-form__field">
                  <span>URL</span>
                  <input
                    type="url"
                    value={link.url}
                    onChange={(event) => updateEvidenceLink(index, "url", event.target.value)}
                  />
                </label>
                <label className="civic-nomination-form__field">
                  <span>Evidence type</span>
                  <select
                    value={link.evidenceType}
                    onChange={(event) =>
                      updateEvidenceLink(index, "evidenceType", event.target.value)
                    }
                  >
                    {NOMINATION_EVIDENCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {EVIDENCE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="civic-nomination-form__field">
                  <span>Summary (optional)</span>
                  <input
                    type="text"
                    value={link.summary ?? ""}
                    onChange={(event) => updateEvidenceLink(index, "summary", event.target.value)}
                  />
                </label>
                <Button type="button" variant="secondary" onClick={() => removeEvidenceLink(index)}>
                  Remove
                </Button>
              </div>
            ))}
            {fieldErrors.evidenceLinks ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.evidenceLinks}
              </p>
            ) : null}
            <Button type="button" variant="secondary" onClick={addEvidenceLink}>
              Add evidence link
            </Button>
          </section>

          <section className="civic-nomination-form__section">
            <h2>Vision Statement</h2>
            <label className="civic-nomination-form__field">
              <span>Vision statement</span>
              <textarea
                rows={6}
                maxLength={CIVIC_NOMINATION_MAX_TEXT_LENGTH}
                value={formState.visionStatement}
                onChange={(event) => updateField("visionStatement", event.target.value)}
                aria-invalid={fieldErrors.visionStatement ? true : undefined}
              />
            </label>
            {fieldErrors.visionStatement ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.visionStatement}
              </p>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Conflict of Interest</h2>
            <label className="civic-nomination-form__radio">
              <input
                type="radio"
                name="conflictStatus"
                checked={formState.conflictStatus === "none_known"}
                onChange={() => updateField("conflictStatus", "none_known")}
              />
              <span>No known conflict</span>
            </label>
            <label className="civic-nomination-form__radio">
              <input
                type="radio"
                name="conflictStatus"
                checked={formState.conflictStatus === "disclosed"}
                onChange={() => updateField("conflictStatus", "disclosed")}
              />
              <span>Potential conflict disclosed</span>
            </label>
            {formState.conflictStatus === "disclosed" ? (
              <>
                <label className="civic-nomination-form__field">
                  <span>Conflict explanation</span>
                  <textarea
                    rows={3}
                    value={formState.conflictSummary}
                    onChange={(event) => updateField("conflictSummary", event.target.value)}
                    aria-invalid={fieldErrors.conflictSummary ? true : undefined}
                  />
                </label>
                {fieldErrors.conflictSummary ? (
                  <p className="civic-nomination-form__field-error" role="alert">
                    {fieldErrors.conflictSummary}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="civic-nomination-form__section">
            <h2>Declarations</h2>
            <label className="civic-nomination-form__checkbox">
              <input
                type="checkbox"
                checked={formState.declarations.supportsUdhr}
                onChange={(event) =>
                  updateField("declarations", {
                    ...formState.declarations,
                    supportsUdhr: event.target.checked,
                  })
                }
              />
              <span>
                I support the Universal Declaration of Human Rights.{" "}
                <a
                  className="civic-nomination-form__review-link"
                  href="https://www.un.org/en/about-us/universal-declaration-of-human-rights"
                  target="same_window"
                  rel="noopener noreferrer"
                >
                  Review
                </a>
              </span>
            </label>
            <label className="civic-nomination-form__checkbox">
              <input
                type="checkbox"
                checked={formState.declarations.supportsHumanityUnionPrinciples}
                onChange={(event) =>
                  updateField("declarations", {
                    ...formState.declarations,
                    supportsHumanityUnionPrinciples: event.target.checked,
                  })
                }
              />
              <span>
                I support the constitutional principles of Humanity Union.{" "}
                <a
                  className="civic-nomination-form__review-link"
                  href="/knowledge/humanity-union-constitution"
                  target="same_window"
                  rel="noopener noreferrer"
                >
                  Review
                </a>
              </span>
            </label>
            <label className="civic-nomination-form__checkbox">
              <input
                type="checkbox"
                checked={formState.declarations.understandsNoAutomaticAppointment}
                onChange={(event) =>
                  updateField("declarations", {
                    ...formState.declarations,
                    understandsNoAutomaticAppointment: event.target.checked,
                  })
                }
              />
              <span>I understand this nomination does not guarantee appointment or selection.</span>
            </label>
            <label className="civic-nomination-form__checkbox">
              <input
                type="checkbox"
                checked={formState.declarations.confirmsAccuracy}
                onChange={(event) =>
                  updateField("declarations", {
                    ...formState.declarations,
                    confirmsAccuracy: event.target.checked,
                  })
                }
              />
              <span>
                I confirm that the submitted information is accurate to the best of my knowledge.
              </span>
            </label>
            {fieldErrors.declarations ? (
              <p className="civic-nomination-form__field-error" role="alert">
                {fieldErrors.declarations}
              </p>
            ) : null}
          </section>

          {formError ? (
            <p className="civic-nomination-form__error" role="alert">
              {formError}
            </p>
          ) : null}
          {savedNominationId ? (
            <p className="civic-nomination-form__notice" role="status">
              Draft saved.
            </p>
          ) : null}

          <div className="civic-nomination-form__actions">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => void handleSaveDraft()}
            >
              Save Draft
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Nomination"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
