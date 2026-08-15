"use client";

import { useId, useState } from "react";

import type { LanguageCode } from "@hu/types";

import "./translated-content-view.css";

export interface TranslatedContentViewProps {
  readonly content: string;
  readonly originalContent: string;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly canViewOriginal: boolean;
  readonly isMachineTranslated?: boolean;
  readonly isStale?: boolean;
  readonly className?: string;
}

/**
 * Public reading surface for translated Lifecycle / civic content.
 * Never overwrites the original — View Original toggles display only.
 */
export function TranslatedContentView({
  content,
  originalContent,
  activeLanguage,
  originalLanguage,
  canViewOriginal,
  isMachineTranslated = false,
  isStale = false,
  className,
}: TranslatedContentViewProps) {
  const labelId = useId();
  const hasDistinctTranslation = canViewOriginal && content.trim() !== originalContent.trim();
  const [mode, setMode] = useState<"translation" | "original">(
    hasDistinctTranslation ? "translation" : "original",
  );

  const display = mode === "original" ? originalContent : content;
  const lang = mode === "original" ? originalLanguage : activeLanguage;

  return (
    <div className={["hu-translated-content", className].filter(Boolean).join(" ")}>
      <div className="hu-translated-content__meta" id={labelId}>
        <span>
          {mode === "original"
            ? `Original (${originalLanguage})`
            : `Reading language: ${activeLanguage}`}
        </span>
        {isMachineTranslated && mode === "translation" ? (
          <span className="hu-translated-content__machine">Machine translated</span>
        ) : null}
        {isStale ? (
          <span className="hu-translated-content__stale" role="status">
            Translation outdated — showing original
          </span>
        ) : null}
      </div>

      <div
        className="hu-translated-content__body"
        lang={lang}
        translate="yes"
        aria-describedby={labelId}
      >
        {display}
      </div>

      {hasDistinctTranslation ? (
        <button
          type="button"
          className="hu-translated-content__toggle"
          aria-pressed={mode === "original"}
          onClick={() =>
            setMode((current) => (current === "original" ? "translation" : "original"))
          }
        >
          {mode === "original" ? "View translation" : "View Original"}
        </button>
      ) : null}
    </div>
  );
}
