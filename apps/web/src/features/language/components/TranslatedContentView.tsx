"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { LanguageCode } from "@hu/types";

import {
  resolveTranslatedContentViewModeLifecycle,
  translatedContentHasDistinctTranslation,
  type TranslatedContentViewMode,
} from "../translated-content-view-mode";

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
 *
 * Pack 02G Task 07B — when a distinct translation arrives asynchronously after
 * mount, auto-select translation mode once. Manual "View Original" is preserved
 * across ordinary rerenders until the translation becomes unavailable.
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
  const hasDistinctTranslation = translatedContentHasDistinctTranslation({
    content,
    originalContent,
    canViewOriginal,
  });
  const [mode, setMode] = useState<TranslatedContentViewMode>(() =>
    hasDistinctTranslation ? "translation" : "original",
  );
  const lifecycleRef = useRef({
    previouslyHadDistinctTranslation: hasDistinctTranslation,
    userPrefersOriginal: false,
  });

  useEffect(() => {
    const next = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation,
      previouslyHadDistinctTranslation: lifecycleRef.current.previouslyHadDistinctTranslation,
      currentMode: mode,
      userPrefersOriginal: lifecycleRef.current.userPrefersOriginal,
    });
    lifecycleRef.current = {
      previouslyHadDistinctTranslation: next.previouslyHadDistinctTranslation,
      userPrefersOriginal: next.userPrefersOriginal,
    };
    if (next.mode !== mode) {
      setMode(next.mode);
    }
  }, [hasDistinctTranslation, mode]);

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
          onClick={() => {
            setMode((current) => {
              const next: TranslatedContentViewMode =
                current === "original" ? "translation" : "original";
              lifecycleRef.current.userPrefersOriginal = next === "original";
              return next;
            });
          }}
        >
          {mode === "original" ? "View translation" : "View Original"}
        </button>
      ) : null}
    </div>
  );
}
