"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  AuthUserPublic,
  LanguageActivationAdminView,
  LanguageLocalizationReadinessReport,
  LanguageRegistryAdmin,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  activateAdminLanguageLocalization,
  createAdminLanguage,
  fetchAdminLanguageActivationStatus,
  fetchAdminLanguageLocalizationReadiness,
  fetchAdminLanguages,
  updateAdminLanguage,
  type AdminLanguageCreateInput,
  type AdminLanguagePatchInput,
} from "../admin-languages-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-languages.css";

interface AdminLanguagesSectionProps {
  user: AuthUserPublic;
}

interface LanguageFormState {
  locale: string;
  englishName: string;
  nativeName: string;
  textDirection: LanguageTextDirection;
  fallbackLocale: string;
  enabled: boolean;
  uiTranslationStatus: LanguageUiTranslationStatus;
  contentTranslationEnabled: boolean;
  searchEnabled: boolean;
  seoIndexingEnabled: boolean;
  pwaPersistedReadingEnabled: boolean;
  aliasesText: string;
}

const UI_STATUSES: readonly LanguageUiTranslationStatus[] = ["none", "partial", "complete"];

function emptyForm(fallbackLocale = "en"): LanguageFormState {
  return {
    locale: "",
    englishName: "",
    nativeName: "",
    textDirection: "ltr",
    fallbackLocale,
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
    pwaPersistedReadingEnabled: false,
    aliasesText: "",
  };
}

function toForm(row: LanguageRegistryAdmin): LanguageFormState {
  return {
    locale: row.locale,
    englishName: row.englishName,
    nativeName: row.nativeName,
    textDirection: row.textDirection,
    fallbackLocale: row.fallbackLocale,
    enabled: row.enabled,
    uiTranslationStatus: row.uiTranslationStatus,
    contentTranslationEnabled: row.contentTranslationEnabled,
    searchEnabled: row.searchEnabled,
    seoIndexingEnabled: row.seoIndexingEnabled,
    pwaPersistedReadingEnabled: row.pwaPersistedReadingEnabled,
    aliasesText: row.aliases.join(", "),
  };
}

function parseAliases(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isEnglishLocale(locale: string): boolean {
  return locale.trim().toLowerCase() === "en";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function CountSummary({
  current,
  stale,
  missing,
  failed = 0,
  pending = 0,
  workItemsRequired,
}: {
  readonly current: number;
  readonly stale: number;
  readonly missing: number;
  readonly failed?: number;
  readonly pending?: number;
  readonly workItemsRequired: number;
}) {
  return (
    <span>
      Current={current} · Stale={stale} · Missing={missing} · Blocked={failed}
      {pending > 0 ? ` · Not actionable=${pending}` : ""} · Work remaining=
      {workItemsRequired}
    </span>
  );
}

/**
 * Admin presentation of an already-fetched readiness report.
 * Does not recompute counts, call the provider, or write the Registry.
 */
function LanguageReadinessDetails({
  report,
}: {
  readonly report: LanguageLocalizationReadinessReport;
}) {
  const ctKinds = report.kindRows.filter(
    (row) => row.ownership === "CT_OWNED" && row.counts != null,
  );

  return (
    <div className="admin-languages__readiness">
      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Ordinary reading</h4>
        <div>
          Persisted Reading gate:{" "}
          {report.registry.pwaPersistedReadingEnabled ? "Enabled" : "Disabled"}
        </div>
        <div>
          PWA civic presentation state:{" "}
          <code>{report.pwaCivic.pwaCivicReadinessStatus}</code>
        </div>
        <div>
          Coverage:{" "}
          <CountSummary
            current={report.pwaCivic.coverage.current}
            stale={report.pwaCivic.coverage.stale}
            missing={report.pwaCivic.coverage.missing}
            failed={report.pwaCivic.coverage.failed}
            pending={report.pwaCivic.coverage.pending}
            workItemsRequired={report.pwaCivic.coverage.workItemsRequired}
          />
        </div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Content translation</h4>
        <div>
          CT totals:{" "}
          <CountSummary
            current={report.ct.current}
            stale={report.ct.stale}
            missing={report.ct.missing}
            failed={report.ct.failed}
            pending={report.ct.pending}
            workItemsRequired={report.ct.workItemsRequired}
          />
        </div>
        {ctKinds.length > 0 ? (
          <ul className="admin-languages__readiness-kinds">
            {ctKinds.map((row) => (
              <li key={row.kindId}>
                <code>{row.kindId}</code>{" "}
                <CountSummary
                  current={row.counts!.current}
                  stale={row.counts!.stale}
                  missing={row.counts!.missing}
                  failed={row.counts!.failed}
                  pending={row.counts!.pending}
                  workItemsRequired={row.counts!.workItemsRequired}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div>No measured CT kinds returned.</div>
        )}
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">
          Civic Media PLP (measured editorial coverage)
        </h4>
        <div>
          <CountSummary
            current={report.plpMedia.current}
            stale={report.plpMedia.stale}
            missing={report.plpMedia.missing}
            failed={report.plpMedia.failed}
            pending={report.plpMedia.pending}
            workItemsRequired={report.plpMedia.workItemsRequired}
          />
        </div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Controlled vocabulary</h4>
        <div>Concepts checked={report.controlledVocabulary.conceptsChecked}</div>
        <div>
          Missing localized labels=
          {report.controlledVocabulary.conceptsMissingLocalizedLabel}
        </div>
        <div>
          Terminology preferred-term coverage=
          {report.controlledVocabulary.conceptsWithTerminologyPreferredTerm}
        </div>
        <div>
          WEB_UI fallback-only={report.controlledVocabulary.conceptsWithWebUiFallbackOnly}
        </div>
        <div>
          Presentation ready: {yesNo(report.controlledVocabulary.presentationReady)}
        </div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Extended Localization</h4>
        <p className="admin-languages__readiness-note">
          Extended Localization readiness is separate from Unified Persisted Reading.
        </p>
        <div>
          Extended Localization state: <code>{report.state}</code>
        </div>
        <div>WEB_UI missing={report.webUi.missingKeyCount}</div>
        <div>WEB_UI empty={report.webUi.emptyKeyCount}</div>
        <div>WEB_UI English fallback={report.webUi.englishFallbackKeyCount}</div>
        <div>WEB_UI data ready: {yesNo(report.webUi.dataReady)}</div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Search / SEO</h4>
        <div>Search flag={report.registry.searchEnabled ? "on" : "off"}</div>
        <div>Search-ready={report.searchLocalizationReady ? "yes" : "no"}</div>
        <div>SEO indexable={report.seoReady ? "yes" : "no"}</div>
      </section>

      <details className="admin-languages__readiness-gaps">
        <summary>Gaps ({report.gaps.length})</summary>
        {report.gaps.length === 0 ? (
          <div>None returned.</div>
        ) : (
          <ul>
            {report.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

export function AdminLanguagesSection({ user: _user }: AdminLanguagesSectionProps) {
  const [items, setItems] = useState<LanguageRegistryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [readinessById, setReadinessById] = useState<
    Record<string, LanguageLocalizationReadinessReport | "loading" | "error">
  >({});
  const [activationById, setActivationById] = useState<
    Record<string, LanguageActivationAdminView | "loading" | "error">
  >({});
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LanguageFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminLanguages();
      setItems([...response.languages]);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm("en"));
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  function openEdit(row: LanguageRegistryAdmin) {
    setEditingId(row.languageId);
    setForm(toForm(row));
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  useLayoutEffect(() => {
    if (!formOpen) {
      return;
    }
    formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [formOpen, editingId]);

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const aliases = parseAliases(form.aliasesText);
      if (editingId) {
        const patch: AdminLanguagePatchInput = {
          englishName: form.englishName.trim(),
          nativeName: form.nativeName.trim(),
          textDirection: form.textDirection,
          fallbackLocale: form.fallbackLocale.trim() || "en",
          enabled: form.enabled,
          uiTranslationStatus: form.uiTranslationStatus,
          contentTranslationEnabled: form.contentTranslationEnabled,
          searchEnabled: form.searchEnabled,
          seoIndexingEnabled: form.seoIndexingEnabled,
          pwaPersistedReadingEnabled: form.pwaPersistedReadingEnabled,
          aliases,
        };
        await updateAdminLanguage(editingId, patch);
        setStatus("Language updated.");
      } else {
        const createBody: AdminLanguageCreateInput = {
          locale: form.locale.trim(),
          englishName: form.englishName.trim(),
          nativeName: form.nativeName.trim(),
          textDirection: form.textDirection,
          fallbackLocale: form.fallbackLocale.trim() || "en",
          enabled: form.enabled,
          uiTranslationStatus: form.uiTranslationStatus,
          contentTranslationEnabled: form.contentTranslationEnabled,
          searchEnabled: form.searchEnabled,
          seoIndexingEnabled: form.seoIndexingEnabled,
          pwaPersistedReadingEnabled: form.pwaPersistedReadingEnabled,
          aliases,
        };
        await createAdminLanguage(createBody);
        setStatus("Language created.");
      }
      closeForm();
      await load();
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(row: LanguageRegistryAdmin) {
    if (isEnglishLocale(row.locale) && row.enabled) {
      setError("English (en) cannot be disabled.");
      return;
    }
    setTogglingId(row.languageId);
    setError(null);
    setStatus(null);
    try {
      await updateAdminLanguage(row.languageId, { enabled: !row.enabled });
      setStatus(row.enabled ? `${row.locale} disabled.` : `${row.locale} enabled.`);
      await load();
    } catch (toggleError) {
      setError(formatAuthFormError(toggleError));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCheckReadiness(row: LanguageRegistryAdmin) {
    setReadinessById((prev) => ({ ...prev, [row.languageId]: "loading" }));
    setError(null);
    try {
      const report = await fetchAdminLanguageLocalizationReadiness(row.languageId);
      setReadinessById((prev) => ({ ...prev, [row.languageId]: report }));
      setStatus(
        `${row.locale}: Enabled=${report.registry.enabled ? "yes" : "no"}` +
          `; Search flag=${report.registry.searchEnabled ? "on" : "off"}` +
          `; Search-ready=${report.searchLocalizationReady ? "yes" : "no"}` +
          `; Extended Localization=${report.state}` +
          `; SEO indexable=${report.seoReady ? "yes" : "no"}`,
      );
    } catch (readinessError) {
      setReadinessById((prev) => ({ ...prev, [row.languageId]: "error" }));
      setError(formatAuthFormError(readinessError));
    }
  }

  async function handleActivateLocalization(row: LanguageRegistryAdmin) {
    setActivatingId(row.languageId);
    setActivationById((prev) => ({ ...prev, [row.languageId]: "loading" }));
    setError(null);
    try {
      const view = await activateAdminLanguageLocalization(row.languageId);
      setActivationById((prev) => ({ ...prev, [row.languageId]: view }));
      setReadinessById((prev) => ({ ...prev, [row.languageId]: view.readiness }));
      const jobStatus = view.job?.status ?? "none";
      setStatus(
        `${row.locale} activation: ${jobStatus}` +
          ` · dataReady=${view.languageDataReady}` +
          ` · WEB_UI missing=${view.readiness.webUi.missingKeyCount}` +
          ` · CV missing=${view.readiness.controlledVocabulary.conceptsMissingLocalizedLabel}` +
          ` · CT remaining=${view.readiness.ct.workItemsRequired}` +
          ` · PLP remaining=${view.readiness.plpMedia.workItemsRequired}`,
      );
    } catch (activationError) {
      setActivationById((prev) => ({ ...prev, [row.languageId]: "error" }));
      setError(formatAuthFormError(activationError));
    } finally {
      setActivatingId(null);
    }
  }

  async function handleRefreshActivation(row: LanguageRegistryAdmin) {
    setActivationById((prev) => ({ ...prev, [row.languageId]: "loading" }));
    setError(null);
    try {
      const view = await fetchAdminLanguageActivationStatus(row.languageId);
      setActivationById((prev) => ({ ...prev, [row.languageId]: view }));
      setReadinessById((prev) => ({ ...prev, [row.languageId]: view.readiness }));
      setStatus(
        `${row.locale} activation status: ${view.job?.status ?? "none"}` +
          ` · readiness=${view.readiness.state}`,
      );
    } catch (statusError) {
      setActivationById((prev) => ({ ...prev, [row.languageId]: "error" }));
      setError(formatAuthFormError(statusError));
    }
  }

  const editingEnglish = Boolean(editingId && isEnglishLocale(form.locale));

  return (
    <main className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Languages">
        <p className="hu-caption admin-languages__lede">
          Canonical Language Registry — Admin-managed locales for platform selection, translation,
          and SEO indexing. Runtime pickers use enabled languages only. Locale is immutable after
          creation. Backend policy is authoritative for conflicts and fallbacks. Basic language
          availability (Enabled), Search capability (`searchEnabled`), SEO indexing
          (`seoIndexingEnabled`), and Extended Localization (WEB_UI / CT / PLP) are separate
          concepts — incomplete Extended Localization does not block Search readiness or SEO
          indexability. Use Readiness to inspect Extended Localization state without enabling SEO.
          Use Activate Localization to start the durable async activation job, and use it again
          or Resume to reconcile newly actionable CT/PLP residual work. Refresh status measures
          readiness and does not enqueue. WEB_UI packs are Admin data (
          <code>PUT /api/v1/admin/web-ui-message-packs/:locale</code>
          ), never machine-generated. Search and SEO remain separate opt-in flags.
        </p>

        <div className="admin-languages__toolbar">
          <Button type="button" variant="primary" onClick={openCreate} disabled={saving}>
            Add Language
          </Button>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {status ? <StatusBanner title="Languages" message={status} /> : null}
        {error ? <StatusBanner title="Languages error" message={error} /> : null}

        {formOpen ? (
          <div
            ref={formRef}
            className="admin-languages__form"
            role="region"
            aria-label={editingId ? "Edit language" : "Add language"}
          >
            <h3 className="hu-subtitle">{editingId ? "Edit language" : "Add language"}</h3>
            <div className="admin-languages__form-grid">
              <label>
                Locale {editingId ? "(immutable)" : ""}
                <input
                  className={`admin-panel__input${editingId ? " admin-languages__readonly" : ""}`}
                  value={form.locale}
                  disabled={Boolean(editingId) || saving}
                  onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
                  placeholder="e.g. uk, zh-Hant, ar"
                  autoComplete="off"
                />
              </label>
              <label>
                English name
                <input
                  className="admin-panel__input"
                  value={form.englishName}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, englishName: event.target.value }))
                  }
                />
              </label>
              <label>
                Native name
                <input
                  className="admin-panel__input"
                  value={form.nativeName}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nativeName: event.target.value }))
                  }
                />
              </label>
              <label>
                Direction
                <select
                  className="admin-panel__input"
                  value={form.textDirection}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      textDirection: event.target.value as LanguageTextDirection,
                    }))
                  }
                >
                  <option value="ltr">ltr</option>
                  <option value="rtl">rtl</option>
                </select>
              </label>
              <label>
                Fallback locale
                <input
                  className="admin-panel__input"
                  value={form.fallbackLocale}
                  disabled={saving || editingEnglish}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, fallbackLocale: event.target.value }))
                  }
                />
              </label>
              <label>
                UI translation status
                <select
                  className="admin-panel__input"
                  value={form.uiTranslationStatus}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      uiTranslationStatus: event.target.value as LanguageUiTranslationStatus,
                    }))
                  }
                >
                  {UI_STATUSES.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aliases (comma-separated)
                <input
                  className="admin-panel__input"
                  value={form.aliasesText}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, aliasesText: event.target.value }))
                  }
                  placeholder="zh-TW, zh-HK"
                />
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={saving || (editingEnglish && form.enabled)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.contentTranslationEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contentTranslationEnabled: event.target.checked,
                    }))
                  }
                />
                Content translation
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.searchEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, searchEnabled: event.target.checked }))
                  }
                />
                Search
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.seoIndexingEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seoIndexingEnabled: event.target.checked }))
                  }
                />
                SEO indexing
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.pwaPersistedReadingEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      pwaPersistedReadingEnabled: event.target.checked,
                    }))
                  }
                />
                PWA persisted reading
              </label>
            </div>
            {!editingId ? (
              <p className="hu-caption admin-languages__form-note">
                Locale becomes immutable after creation. Feature flags require Enabled.
              </p>
            ) : null}
            {editingEnglish ? (
              <p className="hu-caption admin-languages__form-note">
                English cannot be disabled and must keep English as fallback.
              </p>
            ) : null}
            <div className="admin-languages__form-actions">
              <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create language"}
              </Button>
              <Button type="button" variant="tertiary" disabled={saving} onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="hu-caption">Loading languages…</p> : null}

        {!loading ? (
          <div className="admin-languages__table-wrap">
            <table className="admin-initiatives-table admin-languages-table">
              <thead>
                <tr>
                  <th>English</th>
                  <th>Native</th>
                  <th>Locale</th>
                  <th>Dir</th>
                  <th>Enabled</th>
                  <th>UI</th>
                  <th>Content</th>
                  <th>Search</th>
                  <th>SEO</th>
                  <th>PWA</th>
                  <th>Localization</th>
                  <th>Fallback</th>
                  <th className="admin-languages__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const english = isEnglishLocale(row.locale);
                  const busy = togglingId === row.languageId || activatingId === row.languageId;
                  const readiness = readinessById[row.languageId];
                  const activation = activationById[row.languageId];
                  const canActivate =
                    row.enabled && row.contentTranslationEnabled && !english;
                  return (
                    <tr key={row.languageId}>
                      <td>{row.englishName}</td>
                      <td>{row.nativeName}</td>
                      <td>
                        <code>{row.locale}</code>
                        {row.aliases.length > 0 ? (
                          <div className="hu-caption">aliases: {row.aliases.join(", ")}</div>
                        ) : null}
                      </td>
                      <td>{row.textDirection}</td>
                      <td>{yesNo(row.enabled)}</td>
                      <td>{row.uiTranslationStatus}</td>
                      <td>{yesNo(row.contentTranslationEnabled)}</td>
                      <td>{yesNo(row.searchEnabled)}</td>
                      <td>{yesNo(row.seoIndexingEnabled)}</td>
                      <td>{yesNo(row.pwaPersistedReadingEnabled)}</td>
                      <td className="admin-languages__localization-col">
                        {activation === "loading" || readiness === "loading" ? (
                          <span className="hu-caption">Checking…</span>
                        ) : activation === "error" || readiness === "error" ? (
                          <span className="hu-caption">Unavailable</span>
                        ) : activation && typeof activation === "object" ? (
                          <div className="hu-caption">
                            <div>
                              job: <code>{activation.job?.status ?? "none"}</code>
                            </div>
                            <LanguageReadinessDetails report={activation.readiness} />
                          </div>
                        ) : readiness && typeof readiness === "object" ? (
                          <LanguageReadinessDetails report={readiness} />
                        ) : (
                          <span className="hu-caption">—</span>
                        )}
                      </td>
                      <td>
                        <code>{row.fallbackLocale}</code>
                      </td>
                      <td className="admin-languages__actions-col">
                        <div className="admin-languages__row-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={saving || busy}
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={saving || busy || readiness === "loading"}
                            onClick={() => {
                              void handleCheckReadiness(row);
                            }}
                          >
                            Readiness
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            disabled={saving || busy || !canActivate}
                            aria-label={`Activate localization for ${row.locale}`}
                            onClick={() => {
                              void handleActivateLocalization(row);
                            }}
                          >
                            {activatingId === row.languageId ? "…" : "Activate Localization"}
                          </Button>
                          {activation && typeof activation === "object" && activation.job ? (
                            <Button
                              type="button"
                              variant="tertiary"
                              disabled={saving || busy}
                              onClick={() => {
                                const status = activation.job?.status;
                                const explicitResume =
                                  status === "waiting_for_data" ||
                                  status === "running" ||
                                  status === "queued";
                                if (explicitResume) {
                                  void handleActivateLocalization(row);
                                  return;
                                }
                                void handleRefreshActivation(row);
                              }}
                            >
                              {activation.job.status === "waiting_for_data" ||
                              activation.job.status === "running" ||
                              activation.job.status === "queued"
                                ? "Resume"
                                : "Refresh status"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={saving || busy || (english && row.enabled)}
                            aria-label={
                              english && row.enabled
                                ? "English cannot be disabled"
                                : row.enabled
                                  ? `Disable ${row.locale}`
                                  : `Enable ${row.locale}`
                            }
                            onClick={() => {
                              void handleToggleEnabled(row);
                            }}
                          >
                            {togglingId === row.languageId ? "…" : row.enabled ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </ProfileSection>
    </main>
  );
}
