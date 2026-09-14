"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { LanguageCode } from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
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
  /**
   * Pack 02G Task 08B.1 — `full` (default) shows meta + toggle;
   * `body` renders text only (parent owns shared chrome).
   */
  readonly chrome?: "full" | "body";
  /** Controlled mode when chrome is coordinated by a parent. */
  readonly mode?: TranslatedContentViewMode;
  readonly onModeChange?: (mode: TranslatedContentViewMode) => void;
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
  chrome = "full",
  mode: controlledMode,
  onModeChange,
}: TranslatedContentViewProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const labelId = useId();
  const hasDistinctTranslation = translatedContentHasDistinctTranslation({
    content,
    originalContent,
    canViewOriginal,
  });
  const [uncontrolledMode, setUncontrolledMode] = useState<TranslatedContentViewMode>(() =>
    hasDistinctTranslation ? "translation" : "original",
  );
  const isControlled = controlledMode !== undefined;
  const mode = isControlled ? controlledMode : uncontrolledMode;
  const setMode = (next: TranslatedContentViewMode | ((current: TranslatedContentViewMode) => TranslatedContentViewMode)) => {
    const resolved = typeof next === "function" ? next(mode) : next;
    if (!isControlled) {
      setUncontrolledMode(resolved);
    }
    onModeChange?.(resolved);
  };

  const lifecycleRef = useRef({
    previouslyHadDistinctTranslation: hasDistinctTranslation,
    userPrefersOriginal: false,
  });

  useEffect(() => {
    if (isControlled) {
      return;
    }
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
      setUncontrolledMode(next.mode);
    }
  }, [hasDistinctTranslation, isControlled, mode]);

  const display = mode === "original" ? originalContent : content;
  const lang = mode === "original" ? originalLanguage : activeLanguage;
  const languageName = formatLanguageDisplayName(locale, lang);

  return (
    <div className={["hu-translated-content", className].filter(Boolean).join(" ")}>
      {chrome === "full" ? (
        <div className="hu-translated-content__meta" id={labelId}>
          <span>
            {mode === "original"
              ? t("translation.original", { language: languageName })
              : t("translation.readingLanguage", { language: languageName })}
          </span>
          {isMachineTranslated && mode === "translation" ? (
            <span className="hu-translated-content__machine">
              {t("translation.machineTranslated")}
            </span>
          ) : null}
          {isStale ? (
            <span className="hu-translated-content__stale" role="status">
              {t("translation.outdatedShowingOriginal")}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className="hu-translated-content__body"
        lang={lang}
        translate="yes"
        aria-describedby={chrome === "full" ? labelId : undefined}
      >
        {display}
      </div>

      {chrome === "full" && hasDistinctTranslation ? (
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
          {mode === "original"
            ? t("translation.viewTranslation")
            : t("translation.viewOriginal")}
        </button>
      ) : null}
    </div>
  );
}

/** Shared chrome for one translated Initiative object (title + description). */
export function TranslatedContentSharedChrome(props: {
  readonly mode: TranslatedContentViewMode;
  readonly onModeChange: (mode: TranslatedContentViewMode) => void;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly canViewOriginal: boolean;
  readonly content: string;
  readonly originalContent: string;
  readonly isMachineTranslated?: boolean;
  readonly isStale?: boolean;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const labelId = useId();
  const hasDistinctTranslation = translatedContentHasDistinctTranslation({
    content: props.content,
    originalContent: props.originalContent,
    canViewOriginal: props.canViewOriginal,
  });
  const lang =
    props.mode === "original" ? props.originalLanguage : props.activeLanguage;
  const languageName = formatLanguageDisplayName(locale, lang);

  return (
    <div className="hu-translated-content__meta" id={labelId}>
      <span>
        {props.mode === "original"
          ? t("translation.original", { language: languageName })
          : t("translation.readingLanguage", { language: languageName })}
      </span>
      {props.isMachineTranslated && props.mode === "translation" ? (
        <span className="hu-translated-content__machine">
          {t("translation.machineTranslated")}
        </span>
      ) : null}
      {props.isStale ? (
        <span className="hu-translated-content__stale" role="status">
          {t("translation.outdatedShowingOriginal")}
        </span>
      ) : null}
      {hasDistinctTranslation ? (
        <button
          type="button"
          className="hu-translated-content__toggle"
          aria-pressed={props.mode === "original"}
          aria-describedby={labelId}
          onClick={() => {
            props.onModeChange(
              props.mode === "original" ? "translation" : "original",
            );
          }}
        >
          {props.mode === "original"
            ? t("translation.viewTranslation")
            : t("translation.viewOriginal")}
        </button>
      ) : null}
    </div>
  );
}
