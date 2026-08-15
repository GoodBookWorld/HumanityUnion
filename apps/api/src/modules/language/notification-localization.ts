import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

/**
 * Pack 01 foundation for Notification localization.
 *
 * Today many notifications still persist fully rendered English title/message
 * at create-time. This module introduces template-key resolution so future packs
 * can stop treating English-only bodies as the only canonical representation.
 *
 * Private Direct Messages are out of scope — do not route them here.
 */

export type NotificationTemplateKey = string;

export interface LocalizedNotificationTemplate {
  readonly templateKey: NotificationTemplateKey;
  readonly title: string;
  readonly message: string;
}

/** Minimal Pack 01 locale packs — English is complete; others fall back. */
const EN_TEMPLATES: Record<string, LocalizedNotificationTemplate> = {
  "lifecycle.stage_published": {
    templateKey: "lifecycle.stage_published",
    title: "Lifecycle stage published",
    message: "A Lifecycle stage was published for an Initiative you follow.",
  },
  "collaboration.invitation": {
    templateKey: "collaboration.invitation",
    title: "Collaboration invitation",
    message: "You have a new collaboration invitation.",
  },
};

const LOCALE_PACKS: Partial<Record<string, Record<string, LocalizedNotificationTemplate>>> = {
  en: EN_TEMPLATES,
  uk: {
    "lifecycle.stage_published": {
      templateKey: "lifecycle.stage_published",
      title: "Опубліковано етап життєвого циклу",
      message: "Опубліковано етап життєвого циклу Ініціативи, яку ви відстежуєте.",
    },
  },
  fr: {
    "lifecycle.stage_published": {
      templateKey: "lifecycle.stage_published",
      title: "Étape du cycle de vie publiée",
      message: "Une étape du cycle de vie a été publiée pour une Initiative que vous suivez.",
    },
  },
};

export function resolveNotificationTemplate(input: {
  readonly templateKey: NotificationTemplateKey;
  readonly preferredLanguage?: LanguageCode | null;
}): LocalizedNotificationTemplate {
  const preferred = normalizeLanguageCode(input.preferredLanguage, DEFAULT_PLATFORM_LANGUAGE);
  const preferredPack = LOCALE_PACKS[preferred];
  const fromPreferred = preferredPack?.[input.templateKey];
  if (fromPreferred) {
    return fromPreferred;
  }

  const fromDefault = EN_TEMPLATES[input.templateKey];
  if (fromDefault) {
    return fromDefault;
  }

  return {
    templateKey: input.templateKey,
    title: input.templateKey,
    message: input.templateKey,
  };
}
