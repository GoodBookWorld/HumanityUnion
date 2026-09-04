/**
 * Pack 08I.9 — Lifecycle record card presentation boundary.
 *
 * Prefer:
 * 1. Civic warm content_translations (CivicPublicTranslatedSection) when sourceKind eligible
 * 2. Initiative detail presentation for sourceKind=initiative
 * 3. Catalog titleCode for synthetic titles
 * 4. Canonical title/summary fallback
 *
 * Status: statusCode → semantic label; never raw i18n keys or Title-Case enums as keys.
 */

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, PublicInitiativeLifecycleRecordItem } from "@hu/types";

import { CivicPublicTranslatedSection, PublicTranslatedFields } from "../../language";
import { CIVIC_TRANSLATION_FIELD_META } from "../../language/civic-translation-field-meta";
import {
  formatInitiativeExperienceDate,
  resolveInitiativeStatusDisplayLabel,
  resolveLifecycleStateDisplayLabel,
  resolvePresentationStatusDisplayLabel,
} from "../initiative-experience-i18n";
import { looksLikeRawI18nKey } from "../normalize-initiative-status-code";
import { resolveInitiativeDetailPresentation } from "../resolve-initiative-detail-presentation";
import { resolveInitiativePublicDisplayLanguage } from "../initiative-public-presentation";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { lifecycleRecordUsesWarmTranslation } from "../lifecycle-record-warm-matrix";

type CivicWarmKind = keyof typeof CIVIC_TRANSLATION_FIELD_META;

const TITLE_SUMMARY_KINDS = new Set<string>([
  "collaborative_analysis",
  "petition",
  "implementation_commitment",
  "public_impact",
  "civic_archive",
  "decision_session",
  "collective_decision",
]);

/** Pack 02G kinds that use PublicTranslatedFields (not CIVIC_TRANSLATION_FIELD_META). */
const PUBLIC_TRANSLATED_TITLE_SUMMARY_KINDS = new Set<string>([
  "collaborative_analysis",
  "petition",
]);

function isCivicWarmKind(value: string | undefined): value is CivicWarmKind {
  return Boolean(value && value in CIVIC_TRANSLATION_FIELD_META);
}

function resolveRecordStatusLabel(
  record: PublicInitiativeLifecycleRecordItem,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string | undefined {
  const code = record.statusCode?.trim() || record.status?.trim();
  if (!code) {
    return undefined;
  }

  const candidates = [
    resolveInitiativeStatusDisplayLabel(code, t),
    resolveLifecycleStateDisplayLabel(code, t),
    resolvePresentationStatusDisplayLabel(code, t),
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      candidate !== code &&
      !looksLikeRawI18nKey(candidate) &&
      candidate.replaceAll("_", " ").toLowerCase() !== code.replaceAll("_", " ").toLowerCase()
    ) {
      // Prefer a clearly localized / humanized label over the raw code.
      return candidate;
    }
  }

  // Last resort: humanize without exposing namespaced keys.
  const humanized = code.replaceAll("_", " ");
  return looksLikeRawI18nKey(humanized) ? undefined : humanized;
}

function InitiativeRecordBody({
  record,
}: {
  record: PublicInitiativeLifecycleRecordItem;
}) {
  const interfaceLocale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolveInitiativePublicDisplayLanguage(interfaceLocale);
  const [title, setTitle] = useState(record.title);
  const [summary, setSummary] = useState(record.summary ?? "");

  useEffect(() => {
    setTitle(record.title);
    setSummary(record.summary ?? "");
    if (!readingContext.ready) {
      return;
    }
    let cancelled = false;
    void resolveInitiativeDetailPresentation({
      initiativeId: record.recordId,
      canonical: {
        title: record.title,
        description: record.summary ?? "",
      },
      readingContext: {
        ready: readingContext.ready,
        // Pack 08I.14B — Lifecycle initiative records follow UI locale.
        readingLanguage: displayLanguage,
        translationPreference: readingContext.translationPreference,
      },
    }).then((presentation) => {
      if (cancelled) {
        return;
      }
      if (presentation.activeLanguage !== displayLanguage) {
        return;
      }
      setTitle(presentation.title);
      setSummary(presentation.description);
    });
    return () => {
      cancelled = true;
    };
  }, [
    record.recordId,
    record.title,
    record.summary,
    readingContext.ready,
    displayLanguage,
    readingContext.translationPreference,
  ]);

  return (
    <>
      <h3>{title}</h3>
      {summary ? <p>{summary}</p> : null}
    </>
  );
}

function CatalogOrCanonicalTitle({
  record,
}: {
  record: PublicInitiativeLifecycleRecordItem;
}) {
  const t = useTranslations("initiativeExperience");
  if (record.titleCode) {
    const key = `lifecycleRecordTitles.${record.titleCode}`;
    try {
      const localized = t(key);
      if (localized.trim() && !looksLikeRawI18nKey(localized) && localized !== key) {
        return <h3>{localized}</h3>;
      }
    } catch {
      // fall through
    }
  }
  // Pack 08I.15 — synthetic/WEB_UI titles only; CIVIC_CONTENT titles render via
  // PublicTranslatedFields / CivicPublicTranslatedSection in the card body.
  if (!record.sourceKind || record.sourceKind === "lifecycle_stage") {
    const catalogFallbackTitle = record.title;
    return <h3>{catalogFallbackTitle}</h3>;
  }
  return null;
}

export function LifecycleTranslatedRecordCard({
  record,
}: {
  record: PublicInitiativeLifecycleRecordItem;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const statusLabel = resolveRecordStatusLabel(record, t);
  const sourceKind = record.sourceKind;

  const meta = (
    <p className="pie-record__meta">
      {[statusLabel, record.authorDisplayName, record.detail].filter(Boolean).join(" · ")}
      {record.updatedAt ? ` · ${formatInitiativeExperienceDate(locale, record.updatedAt)}` : ""}
    </p>
  );

  let body: ReactNode;
  if (sourceKind === "initiative") {
    body = (
      <>
        <InitiativeRecordBody record={record} />
        {meta}
      </>
    );
  } else if (sourceKind && PUBLIC_TRANSLATED_TITLE_SUMMARY_KINDS.has(sourceKind)) {
    body = (
      <>
        <PublicTranslatedFields
          sourceKind={sourceKind as "collaborative_analysis" | "petition"}
          sourceRecordId={record.recordId}
          fieldOrder={["title", "summary"]}
          fieldLabels={{
            title: t("lifecycleRecordFields.title"),
            summary: t("lifecycleRecordFields.summary"),
          }}
          fallbackFields={{
            title: record.title,
            summary: record.summary ?? "",
          }}
          className="pie-record__translated"
          enableOnDemandGenerate={true}
        />
        {meta}
      </>
    );
  } else if (sourceKind === "initiative_revision") {
    body = (
      <>
        <CivicPublicTranslatedSection
          sourceKind="initiative_revision"
          sourceRecordId={record.recordId}
          fallbackFields={{
            revisionSummary: record.summary ?? record.title,
            title: record.title,
            description: record.summary ?? "",
            changes: record.detail ?? "",
          }}
          fieldOrder={["revisionSummary", "title", "description"]}
          className="pie-record__translated"
        />
        {meta}
      </>
    );
  } else if (isCivicWarmKind(sourceKind) && TITLE_SUMMARY_KINDS.has(sourceKind)) {
    const fallbackFields: Record<string, string> = {
      title: record.title,
    };
    if (record.summary) {
      fallbackFields.summary = record.summary;
      if (sourceKind === "decision_session") {
        fallbackFields.purpose = record.summary;
        fallbackFields.decisionQuestion = record.title;
      }
      if (sourceKind === "collective_decision") {
        fallbackFields.question = record.title;
        fallbackFields.outcomeSummary = record.summary;
      }
    }

    const fieldOrder =
      sourceKind === "decision_session"
        ? (["title", "purpose"] as const)
        : sourceKind === "collective_decision"
          ? (["question", "outcomeSummary"] as const)
          : sourceKind === "implementation_tracking"
            ? (["summary", "currentStage"] as const)
            : (["title", "summary"] as const);

    body = (
      <>
        <CivicPublicTranslatedSection
          sourceKind={sourceKind}
          sourceRecordId={record.recordId}
          fallbackFields={fallbackFields}
          fieldOrder={[...fieldOrder]}
          className="pie-record__translated"
        />
        {meta}
      </>
    );
  } else if (sourceKind === "implementation_tracking") {
    body = (
      <>
        <CivicPublicTranslatedSection
          sourceKind="implementation_tracking"
          sourceRecordId={record.recordId}
          fallbackFields={{
            summary: record.title,
            currentStage: record.detail ?? record.status ?? "",
            notes: record.summary ?? "",
          }}
          fieldOrder={["summary", "currentStage", "notes"]}
          className="pie-record__translated"
        />
        {meta}
      </>
    );
  } else if (sourceKind === "official_response") {
    body = (
      <>
        <CivicPublicTranslatedSection
          sourceKind="official_response"
          sourceRecordId={record.recordId}
          fallbackFields={{
            subject: record.title,
            summary: record.summary ?? "",
          }}
          fieldOrder={["subject", "summary"]}
          className="pie-record__translated"
        />
        {meta}
      </>
    );
  } else if (sourceKind === "improvement_proposal") {
    body = (
      <>
        <CivicPublicTranslatedSection
          sourceKind="improvement_proposal"
          sourceRecordId={record.recordId}
          fallbackFields={{
            proposedChange: record.title,
            rationale: record.summary ?? "",
            currentIssue: record.summary ?? "",
            targetSection: record.detail ?? "",
          }}
          fieldOrder={["targetSection", "proposedChange", "rationale"]}
          className="pie-record__translated"
        />
        {meta}
      </>
    );
  } else {
    body = (
      <>
        <CatalogOrCanonicalTitle record={record} />
        {record.summary ? <p>{record.summary}</p> : null}
        {meta}
      </>
    );
  }

  if (record.publicHref) {
    return (
      <article className="pie-record" data-source-kind={sourceKind ?? "synthetic"}>
        <Link href={record.publicHref}>{body}</Link>
      </article>
    );
  }

  return (
    <article className="pie-record" data-source-kind={sourceKind ?? "synthetic"}>
      {body}
    </article>
  );
}

export { lifecycleRecordUsesWarmTranslation };

export type { ContentTranslationSourceKind };
