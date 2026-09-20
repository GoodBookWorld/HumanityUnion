"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  AuthUserPublic,
  LanguageActivationAdminView,
  LanguageLocalizationReadinessReport,
  LanguageRegistryAdmin,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
  WebUiMessagePackPreparation,
  WebUiMessageTree,
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
  fetchAdminWebUiMessagePackPreparation,
  importAdminWebUiMessagePack,
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

function packStatusLabel(preparation: WebUiMessagePackPreparation): string {
  if (!preparation.pack) {
    return "none";
  }
  return `${preparation.pack.status} revision ${preparation.pack.revision}`;
}

function describePreparation(preparation: WebUiMessagePackPreparation): string {
  return (
    `Public required ${preparation.publicRequiredKeyCount}` +
    `, public missing ${preparation.publicReadiness.missingKeyCount}` +
    `, public empty ${preparation.publicReadiness.emptyKeyCount}` +
    `, public data ready ${yesNo(preparation.publicReadiness.dataReady)}` +
    `. Full catalog ${preparation.fullCatalogKeyCount}` +
    `, full missing ${preparation.fullCatalog.missingKeyCount}` +
    `, full data ready ${yesNo(preparation.fullCatalog.dataReady)}` +
    `. Pack: ${packStatusLabel(preparation)}.`
  );
}

function downloadCatalogFile(locale: string, scope: "public" | "full", messages: WebUiMessageTree): void {
  const artifact = {
    locale,
    status: "draft",
    sourceNote: "Prepared from canonical English WEB_UI catalog",
    messages,
  };
  const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `web-ui-${locale}-${scope}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Existing Admin pack contract: English catalog download, then PUT of the same messages tree.
 * Does not call a translation provider and does not write the English source file.
 */
function WebUiPackWorkflow({ locale }: { readonly locale: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishOnImport, setPublishOnImport] = useState(false);

  async function loadPreparation(scope: "public" | "full"): Promise<WebUiMessagePackPreparation> {
    return fetchAdminWebUiMessagePackPreparation(locale, scope);
  }

  async function checkPack(): Promise<void> {
    setBusy(true);
    setNote(null);
    try {
      const preparation = await loadPreparation("public");
      setNote(describePreparation(preparation));
    } catch (error) {
      setNote(formatAuthFormError(error));
    } finally {
      setBusy(false);
    }
  }

  async function download(scope: "public" | "full"): Promise<void> {
    setBusy(true);
    setNote(null);
    try {
      const preparation = await loadPreparation(scope);
      downloadCatalogFile(preparation.locale, scope, preparation.messages);
      setNote(describePreparation(preparation));
    } catch (error) {
      setNote(formatAuthFormError(error));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File): Promise<void> {
    setBusy(true);
    setNote(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setNote("Catalog file must be a JSON object.");
        return;
      }
      const body = parsed as Record<string, unknown>;
      if (typeof body.locale === "string" && body.locale.trim()) {
        if (body.locale.trim().toLowerCase() !== locale.trim().toLowerCase()) {
          setNote(`This file is for ${body.locale.trim()}, not ${locale}. Import was not sent.`);
          return;
        }
      }
      if (!body.messages || typeof body.messages !== "object" || Array.isArray(body.messages)) {
        setNote("Catalog file must include a messages object.");
        return;
      }
      const result = await importAdminWebUiMessagePack(locale, {
        messages: body.messages as WebUiMessageTree,
        status: publishOnImport ? "published" : "draft",
        sourceNote: typeof body.sourceNote === "string" ? body.sourceNote : null,
      });
      const problems = result.validation.placeholderMismatchPaths.length;
      const empty = result.validation.emptyPaths.length;
      setNote(
        `Imported ${result.pack.status} revision ${result.pack.revision}` +
          `. Public missing ${result.readiness.missingKeyCount}` +
          `. Empty values ${empty}` +
          `. Placeholder problems ${problems}` +
          `. ${result.pack.status === "published" ? "Published packs are used at runtime." : "Draft packs are not used at runtime."}`,
      );
    } catch (error) {
      setNote(formatAuthFormError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-languages__pack-actions">
      <div>Catalog pack</div>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void checkPack()}>
        Check catalog pack
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void download("public")}>
        Download public catalog
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void download("full")}>
        Download full catalog
      </Button>
      <label className="admin-languages__form-check">
        <input
          type="checkbox"
          checked={publishOnImport}
          disabled={busy}
          onChange={(event) => setPublishOnImport(event.target.checked)}
        />
        Publish on import
      </label>
      <label>
        Import catalog
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void importFile(file);
            }
          }}
        />
      </label>
      {note ? <div>{note}</div> : null}
    </div>
  );
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
 * Operator-facing blockers when activation is waiting on prepared data.
 * Uses structured job domain progress already measured by readiness.
 */
function formatActivationWaitingGaps(view: LanguageActivationAdminView): string[] {
  const lines: string[] = [];
  const job = view.job;
  if (!job || job.status !== "waiting_for_data") {
    return lines;
  }
  const webUi = job.domains.webUi;
  if (webUi.status === "waiting_for_data") {
    lines.push(
      `Public interface catalog is blocking: missing ${webUi.missingKeyCount} of ${webUi.requiredKeyCount} required strings` +
        (webUi.emptyKeyCount > 0 ? ` (${webUi.emptyKeyCount} empty).` : "."),
    );
  }
  const cv = job.domains.controlledVocabulary;
  if (cv.status === "waiting_for_data") {
    const ids =
      cv.missingConceptIds.length > 0
        ? ` Missing concepts: ${cv.missingConceptIds.join(", ")}.`
        : "";
    lines.push(
      `Controlled Vocabulary is blocking: ${cv.conceptsMissing} of ${cv.conceptsChecked} concepts still need a localized label.${ids}`,
    );
  }
  if (lines.length > 0) {
    lines.push("This is data preparation, not a translation-provider failure.");
  }
  return lines;
}

/**
 * Admin presentation of an already-fetched readiness report.
 * Labels only. Does not recompute counts, call a provider, or write the Registry.
 */
function LanguageReadinessDetails({
  report,
}: {
  readonly report: LanguageLocalizationReadinessReport;
}) {
  const ctKinds = report.kindRows.filter(
    (row) => row.ownership === "CT_OWNED" && row.counts != null,
  );
  const knowledgeDebt = report.kindRows.filter(
    (row) => row.ownership === "NO_TRANSLATION_OWNER",
  );

  return (
    <div className="admin-languages__readiness">
      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Registry</h4>
        <p className="admin-languages__readiness-note">
          These switches allow features. They do not mean translation is finished.
        </p>
        <div>Enabled: {yesNo(report.registry.enabled)}</div>
        <div>Content translation enabled: {yesNo(report.registry.contentTranslationEnabled)}</div>
        <div>
          Persisted reading enabled: {yesNo(report.registry.pwaPersistedReadingEnabled)}
        </div>
        <div>Search enabled: {yesNo(report.registry.searchEnabled)}</div>
        <div>SEO indexing enabled: {yesNo(report.registry.seoIndexingEnabled)}</div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Overall presentation</h4>
        <p className="admin-languages__readiness-note">
          Whether ordinary public presentation data is ready under the localization
          owners that are implemented today.
        </p>
        <div>
          State: <code>{report.state}</code>
        </div>
        {report.state === "DATA_NOT_READY" ? (
          <ul>
            {report.webUi.dataReady ? null : (
              <li>Public interface &amp; platform catalog is not ready.</li>
            )}
            {report.controlledVocabulary.presentationReady ? null : (
              <li>Controlled Vocabulary is not ready.</li>
            )}
          </ul>
        ) : null}
        <p className="admin-languages__readiness-note">
          Civic persisted content can show no remaining work while overall presentation
          is still not ready.
        </p>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Civic persisted content</h4>
        <p className="admin-languages__readiness-note">
          Persisted translations for civic records and other Content Translation-owned
          public content. Work remaining counts those records only.
        </p>
        <div>
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
          <div>No measured civic record kinds returned.</div>
        )}
        <div>
          Persisted reading coverage:{" "}
          <code>{report.pwaCivic.pwaCivicReadinessStatus}</code>
        </div>
        <div>
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
        <h4 className="admin-languages__readiness-heading">Civic Media presentation</h4>
        <p className="admin-languages__readiness-note">
          Published localized presentation content. Public News remains source-original.
          Page controls are part of the public catalog, not this count.
        </p>
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
        <h4 className="admin-languages__readiness-heading">
          Public interface &amp; platform catalog
        </h4>
        <p className="admin-languages__readiness-note">
          Catalog keys needed for ordinary public reading. Author and steward workspace
          strings stay in the catalog and are not required for this line.
        </p>
        <div>Required={report.webUi.requiredKeyCount}</div>
        <div>Missing={report.webUi.missingKeyCount}</div>
        <div>Empty={report.webUi.emptyKeyCount}</div>
        <div>English fallback={report.webUi.englishFallbackKeyCount}</div>
        <div>Data ready: {yesNo(report.webUi.dataReady)}</div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Controlled Vocabulary</h4>
        <div>Concepts checked={report.controlledVocabulary.conceptsChecked}</div>
        <div>
          Missing localized labels=
          {report.controlledVocabulary.conceptsMissingLocalizedLabel}
        </div>
        {report.controlledVocabulary.missingLocalizedLabelConceptIds.length > 0 ? (
          <div>
            Missing concepts=
            {report.controlledVocabulary.missingLocalizedLabelConceptIds.join(", ")}
          </div>
        ) : null}
        <div>
          Preferred-term coverage=
          {report.controlledVocabulary.conceptsWithTerminologyPreferredTerm}
        </div>
        <div>
          Catalog fallback only={report.controlledVocabulary.conceptsWithWebUiFallbackOnly}
        </div>
        <div>
          Presentation ready: {yesNo(report.controlledVocabulary.presentationReady)}
        </div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Knowledge</h4>
        <p className="admin-languages__readiness-note">
          Article localization owner not implemented yet. Knowledge page chrome is part
          of the public catalog. This debt is separate from civic persisted content and
          does not add civic work.
        </p>
        {knowledgeDebt.length === 0 ? (
          <div>Not reported as ready.</div>
        ) : (
          <div>Not ready. Does not block overall presentation.</div>
        )}
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">Search</h4>
        <p className="admin-languages__readiness-note">
          Search is independent of the catalog, civic content, and overall presentation.
        </p>
        <div>Search enabled: {yesNo(report.registry.searchEnabled)}</div>
        <div>Search-ready: {yesNo(report.searchLocalizationReady)}</div>
      </section>

      <section className="admin-languages__readiness-section">
        <h4 className="admin-languages__readiness-heading">SEO</h4>
        <p className="admin-languages__readiness-note">
          SEO indexability is independent of localization completeness.
        </p>
        <div>SEO indexing enabled: {yesNo(report.registry.seoIndexingEnabled)}</div>
        <div>SEO indexable: {yesNo(report.seoReady)}</div>
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
          `; Overall presentation=${report.state}` +
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
      const cvMissingIds =
        view.readiness.controlledVocabulary.missingLocalizedLabelConceptIds;
      setStatus(
        `${row.locale} activation: ${jobStatus}` +
          ` · dataReady=${view.languageDataReady}` +
          ` · Public catalog missing=${view.readiness.webUi.missingKeyCount}` +
          ` · CV missing=${view.readiness.controlledVocabulary.conceptsMissingLocalizedLabel}` +
          (cvMissingIds.length > 0 ? ` [${cvMissingIds.join(", ")}]` : "") +
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
          Canonical Language Registry. Enabled, Search, SEO indexing, and overall
          presentation are separate. Incomplete presentation does not block Search or
          SEO. Use Readiness to inspect presentation without enabling SEO. Activate
          Localization starts the processing job, and Activate again or Resume
          reconciles newly actionable civic work. Refresh status measures readiness
          and does not enqueue. Waiting for data means the public catalog or
          vocabulary is not ready, not a translation provider failure. Download a public
          or full English catalog for the selected locale, replace the values, then
          import. The English source file is not replaced. Catalog packs are Admin
          data (
          <code>PUT /api/v1/admin/web-ui-message-packs/:locale</code>
          ). Search and SEO remain separate switches.
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
                Content translation enabled
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
                Persisted reading enabled
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
                  <th>Persisted reading</th>
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
                              Activation job: <code>{activation.job?.status ?? "none"}</code>
                            </div>
                            {activation.job?.status === "waiting_for_data" ? (
                              <div>
                                {formatActivationWaitingGaps(activation).map((line) => (
                                  <div key={line}>{line}</div>
                                ))}
                              </div>
                            ) : (
                              <div>Job status is processing progress, not full localization.</div>
                            )}
                            <LanguageReadinessDetails report={activation.readiness} />
                            <WebUiPackWorkflow locale={row.locale} />
                          </div>
                        ) : readiness && typeof readiness === "object" ? (
                          <div className="hu-caption">
                            <LanguageReadinessDetails report={readiness} />
                            <WebUiPackWorkflow locale={row.locale} />
                          </div>
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
