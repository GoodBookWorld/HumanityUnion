"use client";

import { useEffect, useId, useState } from "react";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  listPriorityLanguages,
  requestTranslateDraft,
  type PriorityLanguageOption,
} from "../translation-api";

import "./translate-draft-control.css";

export interface TranslateDraftControlProps {
  readonly sourceKind?: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage?: LanguageCode;
  readonly initiativeId?: string;
  readonly draftContent: Record<string, unknown> | string;
  /** Called only when the Author explicitly chooses to apply translation into local editor state. */
  readonly onApplyWorkingTranslation?: (fields: Record<string, string>) => void;
}

/**
 * Explicit Translate Draft control — never silently mutates the canonical draft.
 * Target options come from registry-backed GET /translations/languages (enabled only).
 */
export function TranslateDraftControl({
  sourceKind,
  sourceRecordId,
  sourceVersion,
  sourceLanguage = "en",
  initiativeId,
  draftContent,
  onApplyWorkingTranslation,
}: TranslateDraftControlProps) {
  const statusId = useId();
  const [languageOptions, setLanguageOptions] = useState<readonly PriorityLanguageOption[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [workingText, setWorkingText] = useState<string | null>(null);
  const [workingFields, setWorkingFields] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPriorityLanguages()
      .then((languages) => {
        if (cancelled) {
          return;
        }
        setLanguageOptions(languages);
        const first = languages[0]?.code;
        if (first) {
          setTargetLanguage((current) =>
            languages.some((row) => row.code === current) ? current : first,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTranslate() {
    setBusy(true);
    setError(null);
    setStatus("Translating…");
    try {
      const result = await requestTranslateDraft({
        sourceKind,
        sourceRecordId,
        sourceVersion,
        sourceLanguage,
        targetLanguage,
        draftContent,
        initiativeId,
      });
      const content = result.workingTranslation.translatedContent;
      if (typeof content === "string") {
        setWorkingText(content);
        setWorkingFields(null);
      } else {
        const fields: Record<string, string> = {};
        for (const [key, value] of Object.entries(content)) {
          if (typeof value === "string") {
            fields[key] = value;
          }
        }
        setWorkingFields(fields);
        setWorkingText(JSON.stringify(fields, null, 2));
      }
      setShowOriginal(false);
      setStatus("Translation ready. Original draft is unchanged.");
    } catch (translateError) {
      setWorkingText(null);
      setWorkingFields(null);
      setError(
        translateError instanceof Error
          ? translateError.message
          : "Translation failed. Original draft is unchanged.",
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  const originalPreview =
    typeof draftContent === "string" ? draftContent : JSON.stringify(draftContent, null, 2);

  return (
    <section className="hu-translate-draft" aria-labelledby={statusId}>
      <h3 className="hu-translate-draft__title">Translate Draft</h3>
      <p className="hu-translate-draft__help">
        Creates a working translation. Your original draft fields stay unchanged until you
        explicitly apply a translation.
      </p>

      <div className="hu-translate-draft__controls">
        <label>
          <span>Target language</span>
          <select
            value={targetLanguage}
            disabled={busy || languageOptions.length === 0}
            onChange={(event) => setTargetLanguage(event.target.value as LanguageCode)}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName} ({option.code})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || languageOptions.length === 0}
          onClick={() => void handleTranslate()}
        >
          {busy ? "Translating…" : "Translate Draft"}
        </button>
      </div>

      <p id={statusId} className="hu-translate-draft__status" role="status" aria-live="polite">
        {status}
      </p>
      {error ? (
        <p className="hu-translate-draft__error" role="alert">
          {error}
        </p>
      ) : null}

      {workingText ? (
        <div className="hu-translate-draft__result">
          <div className="hu-translate-draft__result-actions">
            <button type="button" onClick={() => setShowOriginal((value) => !value)}>
              {showOriginal ? "Show translation" : "Show original"}
            </button>
            {workingFields && onApplyWorkingTranslation ? (
              <button
                type="button"
                onClick={() => onApplyWorkingTranslation(workingFields)}
              >
                Apply to draft fields
              </button>
            ) : null}
          </div>
          <pre className="hu-translate-draft__preview">
            {showOriginal ? originalPreview : workingText}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
