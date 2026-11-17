/**
 * HU-NOTIF-02C.4 — privacy-safe localized digest presentation.
 * Category counts only — never raw title/body/private metadata.
 */

import { isRtlLanguageCode } from "@hu/types";
import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

import { renderMemberNotificationDigestEmail } from "../../email/email.templates.js";
import { findPreferencesByMemberId } from "../../preferences/preferences.repository.js";
import {
  resolveMemberNotificationFallbackDeepLink,
  resolveMemberNotificationPreferencesDeepLink,
} from "./deep-link.js";
import { MEMBER_NOTIFICATION_EMAIL_DIGEST_MAX_CATEGORIES } from "./member-notification-email-delivery.constants.js";
import { resolveMemberNotificationEmailPresentationCategory } from "./presentation-categories.js";
import type { MemberNotificationEmailPresentationCategory } from "./presentation-categories.js";
import {
  resolveMemberNotificationEmailCopy,
  resolveMemberNotificationEmailDigestChrome,
  resolveMemberNotificationEmailLocale,
} from "./presentation-i18n.js";

export type MemberNotificationEmailDigestPresentationErrorCode =
  | "empty_digest"
  | "template_resolution_failed";

export interface MemberNotificationEmailDigestCategoryCount {
  category: MemberNotificationEmailPresentationCategory;
  heading: string;
  count: number;
}

export interface MemberNotificationEmailDigestPresentationSuccess {
  ok: true;
  locale: string;
  localeFallback: boolean;
  dir: "ltr" | "rtl";
  frequency: "daily" | "weekly";
  categoryCounts: MemberNotificationEmailDigestCategoryCount[];
  subject: string;
  html: string;
  text: string;
  templateId: "member_notification_digest";
}

export interface MemberNotificationEmailDigestPresentationFailure {
  ok: false;
  errorCode: MemberNotificationEmailDigestPresentationErrorCode;
}

export type MemberNotificationEmailDigestPresentationResult =
  | MemberNotificationEmailDigestPresentationSuccess
  | MemberNotificationEmailDigestPresentationFailure;

const CATEGORY_ORDER: MemberNotificationEmailPresentationCategory[] = [
  "civic_initiative_update",
  "decision_petition_update",
  "contribution_status",
  "author_publication_status",
  "collaboration_invitation",
  "civic_accountability_update",
  "nomination_update",
];

export async function resolveMemberNotificationEmailDigestPresentation(input: {
  frequency: "daily" | "weekly";
  eligibleRecords: MemberNotificationEmailDeliveryRecord[];
  recipientMemberId?: string | null;
}): Promise<MemberNotificationEmailDigestPresentationResult> {
  try {
    const counts = new Map<MemberNotificationEmailPresentationCategory, number>();
    for (const record of input.eligibleRecords) {
      const category = resolveMemberNotificationEmailPresentationCategory(record.eventType);
      if (!category) {
        continue;
      }
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    const ordered = CATEGORY_ORDER.filter((category) => (counts.get(category) ?? 0) > 0)
      .slice(0, MEMBER_NOTIFICATION_EMAIL_DIGEST_MAX_CATEGORIES)
      .map((category) => ({
        category,
        count: counts.get(category)!,
      }));

    if (ordered.length === 0) {
      return { ok: false, errorCode: "empty_digest" };
    }

    const preferences = input.recipientMemberId
      ? await findPreferencesByMemberId(input.recipientMemberId)
      : null;
    const preferredRaw =
      preferences?.experiencePreferences.readingLanguages?.[0] ??
      preferences?.experiencePreferences.interfaceLanguage ??
      "en";
    const localeResolution = resolveMemberNotificationEmailLocale(preferredRaw);
    const chrome = resolveMemberNotificationEmailDigestChrome({
      locale: localeResolution.locale,
      frequency: input.frequency,
    });

    const categoryCounts: MemberNotificationEmailDigestCategoryCount[] = ordered.map(
      (entry) => {
        const copy = resolveMemberNotificationEmailCopy({
          locale: localeResolution.locale,
          category: entry.category,
        });
        return {
          category: entry.category,
          heading: copy.heading,
          count: entry.count,
        };
      },
    );

    const notificationsLink = resolveMemberNotificationFallbackDeepLink();
    const preferencesLink = resolveMemberNotificationPreferencesDeepLink();
    const dir = isRtlLanguageCode(localeResolution.locale) ? "rtl" : "ltr";

    const lines = categoryCounts.map((entry) =>
      chrome.countLabel(entry.heading, entry.count),
    );

    const rendered = renderMemberNotificationDigestEmail({
      locale: localeResolution.locale,
      dir,
      subject: chrome.subject,
      heading: chrome.heading,
      summary: chrome.summary,
      openLabel: chrome.openLabel,
      preferencesLabel: chrome.preferencesLabel,
      privacyNote: chrome.privacyNote,
      categoryLines: lines,
      notificationsUrl: notificationsLink.absoluteUrl,
      preferencesUrl: preferencesLink.absoluteUrl,
    });

    return {
      ok: true,
      locale: localeResolution.locale,
      localeFallback: localeResolution.usedFallback,
      dir,
      frequency: input.frequency,
      categoryCounts,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateId: "member_notification_digest",
    };
  } catch {
    return { ok: false, errorCode: "template_resolution_failed" };
  }
}
