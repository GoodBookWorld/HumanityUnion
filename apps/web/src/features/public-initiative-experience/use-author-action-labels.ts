"use client";

import { useTranslations } from "next-intl";

import {
  resolveSaveButtonLabel,
  type SaveButtonPhase,
} from "../member-profile/use-save-button-phase";

/**
 * Pack 02G 08D.3 — shared Author Mode action / sources / save-phase labels.
 * Idle labels that are stage-specific remain owned by stage packs.
 */
export function useAuthorActionLabels() {
  const t = useTranslations("initiativeExperience");

  const phaseLabels = {
    saving: t("author.actions.saving"),
    success: t("author.actions.saved"),
  } as const;

  return {
    t,
    generate: t("author.actions.generate"),
    generateDraft: t("author.actions.generateDraft"),
    generateNewDraft: t("author.actions.generateNewDraft"),
    saveDraft: t("author.actions.saveDraft"),
    preview: t("author.actions.preview"),
    publish: t("author.actions.publish"),
    publishAndContinue: t("author.actions.publishAndContinue"),
    retry: t("author.actions.retry"),
    edit: t("author.actions.edit"),
    autosaveHint: t("author.actions.autosaveHint", {
      action: t("author.actions.saveDraft"),
    }),
    sources: t("author.sources.toggle"),
    hideSources: t("author.sources.hide"),
    sourcesWithCompleteness: t("author.sources.toggleWithCompleteness"),
    hideSourcesWithCompleteness: t("author.sources.hideWithCompleteness"),
    sourcesUsed: t("author.sources.used"),
    phaseLabels,
    saveLabel(phase: SaveButtonPhase, idleLabel: string): string {
      return resolveSaveButtonLabel(phase, idleLabel, phaseLabels);
    },
  };
}

export type AuthorActionLabels = ReturnType<typeof useAuthorActionLabels>;
