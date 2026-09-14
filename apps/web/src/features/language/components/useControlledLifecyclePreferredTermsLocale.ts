"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

import {
  ensureControlledLifecyclePreferredTermsForLocale,
  getControlledLifecyclePreferredTermsRevision,
  subscribeControlledLifecyclePreferredTerms,
} from "../controlled-lifecycle-preferred-terms";

/**
 * Simplification Step 04A — load + subscribe to Terminology preferredTerms
 * for the current presentation/document locale so controlled lifecycle labels
 * re-resolve when the glossary map arrives.
 */
export function useControlledLifecyclePreferredTermsLocale(): string {
  const locale = useLocale();
  useSyncExternalStore(
    subscribeControlledLifecyclePreferredTerms,
    getControlledLifecyclePreferredTermsRevision,
    () => 0,
  );

  useEffect(() => {
    void ensureControlledLifecyclePreferredTermsForLocale(locale);
  }, [locale]);

  return locale;
}
