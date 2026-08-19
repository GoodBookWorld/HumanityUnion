/**
 * Shared hook: listen for Use suggestions + publish draft excerpts for flat stage forms.
 * Looks up the Fix 03B stage Apply contract from stageId.
 */

import { useEffect, useRef } from "react";
import type { InitiativeLifecycleAiAssistSuggestion } from "@hu/types";
import { applyLifecycleAiSuggestionsToFields } from "./lifecycle-ai-apply-suggestions";
import { getLifecycleAiStageApplyContract } from "./lifecycle-ai-stage-apply-contract";
import {
  clearLifecycleAiDraftExcerpt,
  setLifecycleAiDraftExcerpt,
} from "./lifecycle-ai-draft-excerpt-bridge";
import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  type LifecycleAiApplySuggestionsDetail,
} from "./lifecycle-ai-suggestion-events";

export function useLifecycleAiFormApply<TForm extends { [K in keyof TForm]: string }>(options: {
  initiativeId: string;
  stageId: string;
  form: TForm;
  onFormApplied: (next: TForm) => void;
  onAppliedNotice?: (message: string) => void;
}): void {
  const { initiativeId, stageId, form, onFormApplied, onAppliedNotice } = options;

  const formRef = useRef(form);
  const onFormAppliedRef = useRef(onFormApplied);
  const onAppliedNoticeRef = useRef(onAppliedNotice);

  useEffect(() => {
    formRef.current = form;
    onFormAppliedRef.current = onFormApplied;
    onAppliedNoticeRef.current = onAppliedNotice;
  }, [form, onFormApplied, onAppliedNotice]);

  useEffect(() => {
    const excerpt = Object.entries(form as Record<string, string>)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => `${key}:\n${value.trim()}`)
      .join("\n\n");
    if (excerpt) {
      setLifecycleAiDraftExcerpt(stageId, excerpt);
    } else {
      clearLifecycleAiDraftExcerpt(stageId);
    }
    return () => clearLifecycleAiDraftExcerpt(stageId);
  }, [stageId, form]);

  useEffect(() => {
    const onApply = (event: Event) => {
      const detail = (event as CustomEvent<LifecycleAiApplySuggestionsDetail>).detail;
      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== stageId) {
        return;
      }
      const suggestions = Array.isArray(detail.suggestions)
        ? (detail.suggestions as InitiativeLifecycleAiAssistSuggestion[])
        : [];
      if (suggestions.length === 0) {
        return;
      }

      const contract = getLifecycleAiStageApplyContract(stageId);
      if (!contract) {
        return;
      }

      const current = formRef.current;
      const knownKeys = contract.knownKeys.filter((key) =>
        Object.prototype.hasOwnProperty.call(current, key),
      ) as (keyof TForm & string)[];
      if (knownKeys.length === 0) {
        return;
      }

      const fallbackKey = (
        Object.prototype.hasOwnProperty.call(current, contract.fallbackKey)
          ? contract.fallbackKey
          : knownKeys[0]!
      ) as keyof TForm & string;

      const result = applyLifecycleAiSuggestionsToFields({
        current,
        suggestions,
        knownKeys,
        fallbackKey,
        forbiddenKeys: contract.forbiddenKeys,
      });
      if (!result.applied) {
        return;
      }
      onFormAppliedRef.current(result.next);
      onAppliedNoticeRef.current?.(
        `Applied AI suggestions to: ${result.changedKeys.join(", ")}. Review before Save Draft / Preview / Publish.`,
      );
    };
    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, onApply as EventListener);
    return () => window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, onApply as EventListener);
  }, [initiativeId, stageId]);
}
