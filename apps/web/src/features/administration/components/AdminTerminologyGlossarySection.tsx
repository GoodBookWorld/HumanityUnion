"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AuthUserPublic,
  LanguageRegistryAdmin,
  TerminologyConcept,
  TerminologyConceptCategory,
  TerminologyConceptStatus,
  TerminologyLocaleTranslation,
} from "@hu/types";
import { TERMINOLOGY_CONCEPT_CATEGORIES, TERMINOLOGY_CONCEPT_STATUSES } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { fetchAdminLanguages } from "../admin-languages-api";
import {
  fetchAdminTerminologyGlossary,
  updateAdminTerminologyConcept,
} from "../admin-terminology-glossary-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-terminology-glossary.css";

interface AdminTerminologyGlossarySectionProps {
  user: AuthUserPublic;
}

interface LocaleDraft {
  preferredTerm: string;
  aliasesText: string;
  guidance: string;
}

const IDENTITY_CONCEPT_IDS = new Set(["participant", "member", "membership"]);

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function coverageSummary(
  concept: TerminologyConcept,
  languages: readonly LanguageRegistryAdmin[],
): string {
  if (languages.length === 0) {
    return `${Object.keys(concept.translations).length} locales`;
  }
  const filled = languages.filter((language) => {
    const preferred = concept.translations[language.locale]?.preferredTerm?.trim();
    return Boolean(preferred);
  }).length;
  return `${filled}/${languages.length} Registry locales`;
}

function toLocaleDraft(
  translation: TerminologyLocaleTranslation | undefined,
): LocaleDraft {
  return {
    preferredTerm: translation?.preferredTerm ?? "",
    aliasesText: (translation?.aliases ?? []).join("\n"),
    guidance: translation?.guidance ?? "",
  };
}

function parseAliasesText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function draftsEqual(a: LocaleDraft, b: LocaleDraft): boolean {
  return (
    a.preferredTerm.trim() === b.preferredTerm.trim() &&
    a.guidance.trim() === b.guidance.trim() &&
    JSON.stringify(parseAliasesText(a.aliasesText)) ===
      JSON.stringify(parseAliasesText(b.aliasesText))
  );
}

function identityHelp(conceptId: string): string | null {
  if (conceptId === "participant") {
    return "Participant is the universal civic actor. A Participant is not necessarily a Member.";
  }
  if (conceptId === "member") {
    return "Member is a Participant with an active Membership — a derived designation, not a separate primary identity.";
  }
  if (conceptId === "membership") {
    return "Membership is an optional civic status associated with a Participant. It does not define Participant identity.";
  }
  return null;
}

function brandHelp(conceptId: string): string | null {
  if (conceptId === "humanity_union") {
    return "Humanity Union is constrained brand terminology. Prefer careful, consistent presentation — do not invent informal synonyms here.";
  }
  return null;
}

function linkedRefsLabel(concept: TerminologyConcept): string {
  const refs = concept.linkedRefs;
  if (!refs) {
    return "—";
  }
  const parts: string[] = [];
  if (refs.stageId) {
    parts.push(`stageId=${refs.stageId}`);
  }
  if (refs.civicEntityType) {
    parts.push(`entity=${refs.civicEntityType}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function AdminTerminologyGlossarySection({ user: _user }: AdminTerminologyGlossarySectionProps) {
  const [concepts, setConcepts] = useState<TerminologyConcept[]>([]);
  const [languages, setLanguages] = useState<LanguageRegistryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<TerminologyConceptStatus>("published");
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, LocaleDraft>>({});
  const [baselineStatus, setBaselineStatus] = useState<TerminologyConceptStatus>("published");
  const [baselineLocales, setBaselineLocales] = useState<Record<string, LocaleDraft>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | TerminologyConceptCategory>("");
  const [statusFilter, setStatusFilter] = useState<"" | TerminologyConceptStatus>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [glossary, languageResponse] = await Promise.all([
        fetchAdminTerminologyGlossary(),
        fetchAdminLanguages(),
      ]);
      setConcepts([...glossary.concepts]);
      setLanguages([...languageResponse.languages]);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setConcepts([]);
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => concepts.find((concept) => concept.conceptId === selectedId) ?? null,
    [concepts, selectedId],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return concepts.filter((concept) => {
      if (categoryFilter && concept.category !== categoryFilter) {
        return false;
      }
      if (statusFilter && concept.status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        concept.conceptId.toLowerCase().includes(needle) ||
        concept.canonicalEnglishTerm.toLowerCase().includes(needle)
      );
    });
  }, [concepts, search, categoryFilter, statusFilter]);

  function openConcept(concept: TerminologyConcept) {
    const drafts: Record<string, LocaleDraft> = {};
    for (const language of languages) {
      drafts[language.locale] = toLocaleDraft(concept.translations[language.locale]);
    }
    setSelectedId(concept.conceptId);
    setStatusDraft(concept.status);
    setBaselineStatus(concept.status);
    setLocaleDrafts(drafts);
    setBaselineLocales(structuredClone(drafts));
    setStatusMessage(null);
    setError(null);
  }

  function closeEditor() {
    setSelectedId(null);
    setLocaleDrafts({});
    setBaselineLocales({});
    setStatusMessage(null);
  }

  function updateLocaleDraft(locale: string, patch: Partial<LocaleDraft>) {
    setLocaleDrafts((current) => ({
      ...current,
      [locale]: {
        ...(current[locale] ?? { preferredTerm: "", aliasesText: "", guidance: "" }),
        ...patch,
      },
    }));
  }

  async function handleSave() {
    if (!selected) {
      return;
    }

    const translationsPatch: Record<string, TerminologyLocaleTranslation> = {};
    for (const language of languages) {
      const draft = localeDrafts[language.locale];
      const baseline = baselineLocales[language.locale];
      if (!draft || !baseline || draftsEqual(draft, baseline)) {
        continue;
      }
      const preferredTerm = draft.preferredTerm.trim();
      if (!preferredTerm) {
        setError(`Preferred term is required for locale ${language.locale} when editing that locale.`);
        return;
      }
      translationsPatch[language.locale] = {
        preferredTerm,
        aliases: parseAliasesText(draft.aliasesText),
        ...(draft.guidance.trim() ? { guidance: draft.guidance.trim() } : {}),
      };
    }

    const statusChanged = statusDraft !== baselineStatus;
    if (!statusChanged && Object.keys(translationsPatch).length === 0) {
      setStatusMessage("No changes to save.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const updated = await updateAdminTerminologyConcept(selected.conceptId, {
        ...(statusChanged ? { status: statusDraft } : {}),
        ...(Object.keys(translationsPatch).length > 0
          ? { translations: translationsPatch }
          : {}),
      });
      setConcepts((current) =>
        current.map((concept) =>
          concept.conceptId === updated.conceptId ? updated : concept,
        ),
      );
      openConcept(updated);
      setStatusMessage("Terminology concept saved.");
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Terminology Glossary">
        <p className="hu-caption admin-glossary__lede">
          Manage preferred presentation terms and aliases for seeded Humanity Union concepts.
          This does not rename domain identifiers, lifecycle stages, routes, or API contracts.
          Language enablement stays on{" "}
          <a className="admin-panel__link" href="/admin/languages">
            Languages
          </a>
          .
        </p>

        {error ? <StatusBanner title="Terminology Glossary error" message={error} /> : null}
        {statusMessage ? (
          <StatusBanner title="Terminology Glossary" message={statusMessage} />
        ) : null}

        <div className="admin-glossary__toolbar" role="search" aria-label="Filter glossary concepts">
          <label>
            Search
            <input
              className="admin-panel__input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="English term or conceptId"
            />
          </label>
          <label>
            Category
            <select
              className="admin-panel__input"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as "" | TerminologyConceptCategory)
              }
            >
              <option value="">All</option>
              {TERMINOLOGY_CONCEPT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              className="admin-panel__input"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "" | TerminologyConceptStatus)
              }
            >
              <option value="">All</option>
              {TERMINOLOGY_CONCEPT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {selected ? (
          <div
            className="admin-glossary__editor"
            role="region"
            aria-label={`Edit terminology concept ${selected.canonicalEnglishTerm}`}
          >
            <h3 className="hu-subtitle">{selected.canonicalEnglishTerm}</h3>
            <p className="hu-caption admin-glossary__note">
              Read-only identity fields cannot be changed here. Edit presentation terminology only.
            </p>

            <div className="admin-glossary__readonly-grid">
              <div className="admin-glossary__readonly-field">
                <span>conceptId</span>
                <div className="admin-glossary__readonly-value" data-readonly="conceptId">
                  {selected.conceptId}
                </div>
              </div>
              <div className="admin-glossary__readonly-field">
                <span>Canonical English term</span>
                <div
                  className="admin-glossary__readonly-value"
                  data-readonly="canonicalEnglishTerm"
                >
                  {selected.canonicalEnglishTerm}
                </div>
              </div>
              <div className="admin-glossary__readonly-field">
                <span>Category</span>
                <div className="admin-glossary__readonly-value" data-readonly="category">
                  {selected.category}
                </div>
              </div>
              <div className="admin-glossary__readonly-field">
                <span>Linked refs</span>
                <div className="admin-glossary__readonly-value" data-readonly="linkedRefs">
                  {linkedRefsLabel(selected)}
                </div>
              </div>
            </div>

            {IDENTITY_CONCEPT_IDS.has(selected.conceptId) ? (
              <div
                className="admin-glossary__help"
                data-help="participant-member-membership"
                role="note"
              >
                <strong>Keep Participant / Member / Membership distinct</strong>
                {identityHelp(selected.conceptId)}
              </div>
            ) : null}

            {brandHelp(selected.conceptId) ? (
              <div className="admin-glossary__help" data-help="brand" role="note">
                <strong>Brand terminology</strong>
                {brandHelp(selected.conceptId)}
              </div>
            ) : null}

            {selected.category === "workflow_stage" ? (
              <div className="admin-glossary__help" data-help="workflow-stage" role="note">
                <strong>Workflow / stage presentation only</strong>
                Glossary edits change presentation terminology. Lifecycle structure, stage ordering,
                and linked refs stay code-owned and are not editable here
                {selected.linkedRefs?.stageId
                  ? ` (linked stageId: ${selected.linkedRefs.stageId})`
                  : selected.linkedRefs?.civicEntityType
                    ? ` (linked entity: ${selected.linkedRefs.civicEntityType})`
                    : ""}
                .
              </div>
            ) : null}

            <div className="admin-glossary__status-row">
              <label>
                Status
                <select
                  className="admin-panel__input"
                  value={statusDraft}
                  onChange={(event) =>
                    setStatusDraft(event.target.value as TerminologyConceptStatus)
                  }
                  data-editable="status"
                >
                  {TERMINOLOGY_CONCEPT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-glossary__locales" data-locale-editor="true">
              {languages.map((language) => {
                const draft = localeDrafts[language.locale] ?? {
                  preferredTerm: "",
                  aliasesText: "",
                  guidance: "",
                };
                return (
                  <section
                    key={language.locale}
                    className={`admin-glossary__locale-card${
                      language.enabled ? "" : " admin-glossary__locale-card--disabled"
                    }`}
                    aria-label={`Locale ${language.locale}`}
                    data-locale={language.locale}
                    data-registry-enabled={language.enabled ? "true" : "false"}
                  >
                    <div className="admin-glossary__locale-header">
                      <h4 className="admin-glossary__locale-title">
                        {language.englishName} / {language.nativeName}
                      </h4>
                      <p className="admin-glossary__locale-meta">
                        Canonical locale: <code>{language.locale}</code>
                      </p>
                      <span
                        className={`admin-glossary__locale-badge${
                          language.enabled ? "" : " admin-glossary__locale-badge--disabled"
                        }`}
                      >
                        Registry: {language.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    {!language.enabled ? (
                      <p className="hu-caption admin-glossary__note">
                        Registry language disabled for runtime selection. Glossary translations may
                        still be edited and stored. Language enablement is managed only under
                        Languages — not from this screen.
                      </p>
                    ) : null}
                    <div className="admin-glossary__locale-grid">
                      <label>
                        Preferred term
                        <input
                          className="admin-panel__input"
                          value={draft.preferredTerm}
                          onChange={(event) =>
                            updateLocaleDraft(language.locale, {
                              preferredTerm: event.target.value,
                            })
                          }
                          data-editable="preferredTerm"
                        />
                      </label>
                      <label>
                        Terminology aliases (one per line)
                        <textarea
                          className="admin-panel__input"
                          value={draft.aliasesText}
                          onChange={(event) =>
                            updateLocaleDraft(language.locale, {
                              aliasesText: event.target.value,
                            })
                          }
                          data-editable="aliases"
                          placeholder={"Synonyms for this concept\nNot Language Registry locale aliases"}
                        />
                      </label>
                      <label>
                        Guidance
                        <textarea
                          className="admin-panel__input"
                          value={draft.guidance}
                          onChange={(event) =>
                            updateLocaleDraft(language.locale, {
                              guidance: event.target.value,
                            })
                          }
                          data-editable="guidance"
                        />
                      </label>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="admin-glossary__form-actions">
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save concept"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEditor} disabled={saving}>
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="hu-caption">Loading terminology glossary…</p> : null}

        {!loading ? (
          <div className="admin-glossary__table-wrap">
            <table className="admin-initiatives-table admin-glossary-table">
              <thead>
                <tr>
                  <th scope="col">English term</th>
                  <th scope="col">conceptId</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((concept) => (
                  <tr
                    key={concept.conceptId}
                    className={`admin-glossary-table__row${
                      selectedId === concept.conceptId
                        ? " admin-glossary-table__row--selected"
                        : ""
                    }`}
                    onClick={() => openConcept(concept)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openConcept(concept);
                      }
                    }}
                    tabIndex={0}
                    data-concept-id={concept.conceptId}
                  >
                    <td>{concept.canonicalEnglishTerm}</td>
                    <td>
                      <code>{concept.conceptId}</code>
                    </td>
                    <td>{concept.category}</td>
                    <td>{concept.status}</td>
                    <td>{coverageSummary(concept, languages)}</td>
                    <td>{formatUpdatedAt(concept.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="hu-caption admin-glossary__note">No concepts match the current filters.</p>
            ) : null}
          </div>
        ) : null}
      </ProfileSection>
    </div>
  );
}
