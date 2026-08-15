"use client";

import { useId, useState } from "react";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { PRIORITY_LANGUAGE_CODES } from "@hu/types";

import { requestTranslateDraft } from "../translation-api";

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
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>("uk");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [workingText, setWorkingText] = useState<string | null>(null);
  const [workingFields, setWorkingFields] = useState<Record<string, string> | null>(null);

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
            disabled={busy}
            onChange={(event) => setTargetLanguage(event.target.value as LanguageCode)}
          >
            {PRIORITY_LANGUAGE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void handleTranslate()}>
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
              {showOriginal ? "View Translation" : "View Original"}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(workingText);
                setStatus("Translation copied.");
              }}
            >
              Copy Translation
            </button>
            {onApplyWorkingTranslation && workingFields ? (
              <button
                type="button"
                onClick={() => {
                  onApplyWorkingTranslation(workingFields);
                  setStatus("Working translation applied locally. Save when ready.");
                }}
              >
                Use as Working Translation
              </button>
            ) : null}
          </div>
          <pre className="hu-translate-draft__preview" lang={showOriginal ? sourceLanguage : targetLanguage}>
            {showOriginal ? originalPreview : workingText}
          </pre>
          <p className="hu-translate-draft__machine">Machine translated</p>
        </div>
      ) : null}
    </section>
  );
}
