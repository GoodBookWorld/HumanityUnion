/**
 * HU-NOTIF-02C.3 — privacy-safe localized email presentation resolver.
 * Never accepts raw notification title/body/metadata into the renderer.
 */

import { isRtlLanguageCode } from "@hu/types";
import { renderEmailTemplate } from "../../email/email.templates.js";
import { findPreferencesByMemberId } from "../../preferences/preferences.repository.js";
import {
  resolveMemberNotificationDeepLink,
  resolveMemberNotificationFallbackDeepLink,
  resolveMemberNotificationPreferencesDeepLink,
} from "./deep-link.js";
import { resolveMemberNotificationEmailPresentationCategory } from "./presentation-categories.js";
import {
  resolveMemberNotificationEmailCopy,
  resolveMemberNotificationEmailLocale,
} from "./presentation-i18n.js";

export type MemberNotificationEmailPresentationErrorCode =
  | "unknown_event"
  | "private_event"
  | "template_resolution_failed";

export interface MemberNotificationEmailPresentationMailFields {
  locale: string;
  dir: "ltr" | "rtl";
  subject: string;
  heading: string;
  body: string;
  openLabel: string;
  preferencesLabel: string;
  privacyNote: string;
  notificationUrl: string;
  preferencesUrl: string;
}

export interface MemberNotificationEmailPresentationSuccess {
  ok: true;
  locale: string;
  localeFallback: boolean;
  dir: "ltr" | "rtl";
  category: string;
  deepLinkPath: string;
  deepLinkFallback: boolean;
  subject: string;
  /** Rendered via MailDeliveryService template conventions. */
  html: string;
  text: string;
  templateId: "member_notification_copy";
  /** Structured fields for MailDeliveryService live send (no HTML/PII extras). */
  mailFields: MemberNotificationEmailPresentationMailFields;
}

export interface MemberNotificationEmailPresentationFailure {
  ok: false;
  errorCode: MemberNotificationEmailPresentationErrorCode;
}

export type MemberNotificationEmailPresentationResult =
  | MemberNotificationEmailPresentationSuccess
  | MemberNotificationEmailPresentationFailure;

/**
 * Build a safe localized email presentation for an allowlisted event.
 * Does not use notification title/message fields.
 */
export async function resolveMemberNotificationEmailPresentation(input: {
  eventType: string;
  relatedUrl?: string | null;
  recipientMemberId?: string | null;
}): Promise<MemberNotificationEmailPresentationResult> {
  const category = resolveMemberNotificationEmailPresentationCategory(input.eventType);
  if (!category) {
    const isKnownPrivate =
      input.eventType === "direct_message_received" ||
      input.eventType.includes("collaboration_channel") ||
      input.eventType.includes("shared_document") ||
      input.eventType.includes("review_requested");
    return {
      ok: false,
      errorCode: isKnownPrivate ? "private_event" : "unknown_event",
    };
  }

  try {
    // Prefer stored reading language for email catalog selection (EN fallback
    // when missing/unsupported). Does not invent locale from Host headers.
    const preferences = input.recipientMemberId
      ? await findPreferencesByMemberId(input.recipientMemberId)
      : null;
    const preferredRaw =
      preferences?.experiencePreferences.readingLanguages?.[0] ??
      preferences?.experiencePreferences.interfaceLanguage ??
      "en";
    const localeResolution = resolveMemberNotificationEmailLocale(preferredRaw);
    const copy = resolveMemberNotificationEmailCopy({
      locale: localeResolution.locale,
      category,
    });

    const deepLink = resolveMemberNotificationDeepLink(input.relatedUrl);
    const notificationLink = deepLink.ok
      ? deepLink
      : {
          absoluteUrl: resolveMemberNotificationFallbackDeepLink().absoluteUrl,
          path: resolveMemberNotificationFallbackDeepLink().path,
          usedFallback: true,
        };
    const preferencesLink = resolveMemberNotificationPreferencesDeepLink();
    const dir = isRtlLanguageCode(localeResolution.locale) ? "rtl" : "ltr";

    const rendered = renderEmailTemplate("member_notification_copy", {
      locale: localeResolution.locale,
      dir,
      subject: copy.subject,
      heading: copy.heading,
      body: copy.body,
      openLabel: copy.openLabel,
      preferencesLabel: copy.preferencesLabel,
      privacyNote: copy.privacyNote,
      notificationUrl: notificationLink.absoluteUrl,
      preferencesUrl: preferencesLink.absoluteUrl,
    });

    // Guard: rendered output must not embed relatedUrl raw if it was rejected.
    if (
      input.relatedUrl &&
      !deepLink.ok &&
      (rendered.html.includes(input.relatedUrl) || rendered.text.includes(input.relatedUrl))
    ) {
      return { ok: false, errorCode: "template_resolution_failed" };
    }

    const mailFields: MemberNotificationEmailPresentationMailFields = {
      locale: localeResolution.locale,
      dir,
      subject: copy.subject,
      heading: copy.heading,
      body: copy.body,
      openLabel: copy.openLabel,
      preferencesLabel: copy.preferencesLabel,
      privacyNote: copy.privacyNote,
      notificationUrl: notificationLink.absoluteUrl,
      preferencesUrl: preferencesLink.absoluteUrl,
    };

    return {
      ok: true,
      locale: localeResolution.locale,
      localeFallback: localeResolution.usedFallback,
      dir,
      category,
      deepLinkPath: notificationLink.path,
      deepLinkFallback: notificationLink.usedFallback || !deepLink.ok,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateId: "member_notification_copy",
      mailFields,
    };
  } catch {
    return { ok: false, errorCode: "template_resolution_failed" };
  }
}
