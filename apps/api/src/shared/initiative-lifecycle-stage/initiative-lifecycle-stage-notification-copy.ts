import type { InitiativeLifecycleStagePublicationKind, LanguageCode } from "@hu/types";

import { resolveNotificationTemplate } from "../../modules/language/notification-localization.js";

/**
 * Initiative Lifecycle Part A Part 15 — universal notification copy for a
 * stage publication event, shared across every stage domain so an Active
 * Ally gets the same wording pattern regardless of which of the 12 stages
 * published.
 *
 * Deliberately NOT registered in `NOTIFICATION_TEMPLATES`
 * (`getNotificationTemplate`), which is static per-`eventType` copy: this
 * needs the concrete stage label and Initiative title interpolated per
 * notification, exactly like existing Collaboration Channel/Session
 * notifications already build their own dynamic title/message before
 * calling `createNotification` directly.
 *
 * Part B, Section 10 requires the Collaborative Analysis stage's own
 * fixed, literal wording ("Collaborative Analysis Published" /
 * "The Initiative Author has published a new Collaborative Analysis.") —
 * intentionally NOT interpolated with the Initiative title, unlike the
 * generic fallback below. `stageId` is optional so this stays backward
 * compatible with any caller that has not been updated to pass it; every
 * future stage that needs its own fixed copy should add another `stageId`
 * case here rather than inventing a second copy-building function.
 */
export function buildInitiativeLifecycleStageNotificationCopy(input: {
  readonly stageId?: string;
  readonly stageLabel: string;
  readonly initiativeTitle: string;
  readonly publicationKind: InitiativeLifecycleStagePublicationKind;
  /** Pack 02 — optional recipient interface/reading language for template localization. */
  readonly preferredLanguage?: LanguageCode | null;
}): { title: string; message: string } {
  const { stageId, stageLabel, initiativeTitle, publicationKind, preferredLanguage } = input;

  if (stageId === "analysis" && publicationKind === "published") {
    return {
      title: "Collaborative Analysis Published",
      message: "The Initiative Author has published a new Collaborative Analysis.",
    };
  }

  /**
   * Initiative Lifecycle — Part D, Section 10. Unlike Analysis's fixed
   * copy above, this one interpolates the Initiative title — Part D's
   * spec requires the notification to name the Initiative explicitly
   * ("Notification includes: Initiative, Improvement Proposals
   * published, ..."), and a single Initiative may accumulate several
   * Improvement Proposals publications over its lifetime, so naming it
   * helps an Active Ally who Allies with multiple Initiatives.
   */
  if (stageId === "proposal" && publicationKind === "published") {
    return {
      title: "Improvement Proposals Published",
      message: `The Initiative Author has published new Improvement Proposals for "${initiativeTitle}".`,
    };
  }

  /**
   * Initiative Lifecycle — Part E, Section 10. Mirrors Part D's naming
   * pattern: interpolates the Initiative title since an Author may publish
   * several Revisions over an Initiative's lifetime, and Part E's spec
   * requires this notification to name the Initiative explicitly.
   */
  if (stageId === "revision" && publicationKind === "published") {
    return {
      title: "Revision Published",
      message: `The Initiative Author has published a new Revision for "${initiativeTitle}".`,
    };
  }

  switch (publicationKind) {
    case "opened":
      return {
        title: "Initiative stage opened",
        message: `The ${stageLabel} stage of "${initiativeTitle}" has been opened.`,
      };
    case "finalized":
      return {
        title: "Initiative stage finalized",
        message: `The ${stageLabel} stage of "${initiativeTitle}" has been finalized.`,
      };
    case "fixed":
      return {
        title: "Initiative stage fixed",
        message: `The ${stageLabel} stage of "${initiativeTitle}" has been fixed.`,
      };
    case "superseded":
      return {
        title: "Initiative stage updated",
        message: `The ${stageLabel} stage of "${initiativeTitle}" was superseded by a newer version.`,
      };
    case "archived":
      return {
        title: "Initiative stage archived",
        message: `The ${stageLabel} stage of "${initiativeTitle}" has been archived.`,
      };
    case "published":
    default: {
      // Pack 02 foundation: localize generic published copy when a non-English
      // template pack exists. Stage-specific fixed English wording above is
      // preserved until a dedicated notification localization pack.
      if (preferredLanguage && preferredLanguage !== "en") {
        const template = resolveNotificationTemplate({
          templateKey: "lifecycle.stage_published",
          preferredLanguage,
        });
        if (template.title !== "lifecycle.stage_published") {
          return {
            title: template.title,
            message: `${template.message} (${stageLabel}: "${initiativeTitle}")`,
          };
        }
      }
      return {
        title: "Initiative stage published",
        message: `The ${stageLabel} stage of "${initiativeTitle}" has been published.`,
      };
    }
  }
}
