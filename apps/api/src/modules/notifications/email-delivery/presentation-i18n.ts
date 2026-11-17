/**
 * HU-NOTIF-02C.3 — localized fixed copy for notification email categories.
 * Installed locales with EN fallback. No event-specific private wording.
 */

import type { MemberNotificationEmailPresentationCategory } from "./presentation-categories.js";

export const MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES = [
  "en",
  "ar",
  "de",
  "es",
  "fr",
  "he",
  "ka",
  "pt",
  "uk",
  "zh-Hant",
] as const;

export type MemberNotificationEmailLocale =
  (typeof MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES)[number];

export interface MemberNotificationEmailCopyStrings {
  subject: string;
  heading: string;
  body: string;
  openLabel: string;
  preferencesLabel: string;
  privacyNote: string;
}

type Catalog = Record<
  MemberNotificationEmailPresentationCategory,
  MemberNotificationEmailCopyStrings
> & {
  shared: Pick<
    MemberNotificationEmailCopyStrings,
    "openLabel" | "preferencesLabel" | "privacyNote"
  >;
};

const EN_SHARED = {
  openLabel: "Open notification",
  preferencesLabel: "Manage email preferences",
  privacyNote: "This email does not include private notification details.",
} as const;

const EN_CATALOG: Catalog = {
  shared: EN_SHARED,
  civic_initiative_update: {
    subject: "Civic initiative update on Humanity Union",
    heading: "Civic initiative update",
    body: "There is a new update related to a civic initiative you follow on Humanity Union.",
    ...EN_SHARED,
  },
  decision_petition_update: {
    subject: "Decision or petition update on Humanity Union",
    heading: "Decision or petition update",
    body: "There is a new update related to a decision or petition on Humanity Union.",
    ...EN_SHARED,
  },
  contribution_status: {
    subject: "Contribution status update on Humanity Union",
    heading: "Contribution status update",
    body: "Your contribution status has been updated on Humanity Union.",
    ...EN_SHARED,
  },
  author_publication_status: {
    subject: "Author publication status on Humanity Union",
    heading: "Author publication status",
    body: "There is a new update about your author or publication status on Humanity Union.",
    ...EN_SHARED,
  },
  collaboration_invitation: {
    subject: "Collaboration invitation on Humanity Union",
    heading: "Collaboration invitation",
    body: "You have a collaboration invitation or response waiting on Humanity Union.",
    ...EN_SHARED,
  },
  civic_accountability_update: {
    subject: "Civic accountability update on Humanity Union",
    heading: "Civic accountability update",
    body: "There is a new civic accountability update on Humanity Union.",
    ...EN_SHARED,
  },
  nomination_update: {
    subject: "Nomination update on Humanity Union",
    heading: "Nomination update",
    body: "There is a new nomination or voting update on Humanity Union.",
    ...EN_SHARED,
  },
};

/** Partial overrides; missing keys fall back to EN. */
const LOCALE_OVERRIDES: Partial<
  Record<MemberNotificationEmailLocale, Partial<Catalog>>
> = {
  ar: {
    shared: {
      openLabel: "فتح الإشعار",
      preferencesLabel: "إدارة تفضيلات البريد الإلكتروني",
      privacyNote: "لا يتضمن هذا البريد تفاصيل إشعار خاصة.",
    },
    civic_initiative_update: {
      subject: "تحديث مبادرة مدنية على Humanity Union",
      heading: "تحديث مبادرة مدنية",
      body: "هناك تحديث جديد يتعلق بمبادرة مدنية تتابعها على Humanity Union.",
      openLabel: "فتح الإشعار",
      preferencesLabel: "إدارة تفضيلات البريد الإلكتروني",
      privacyNote: "لا يتضمن هذا البريد تفاصيل إشعار خاصة.",
    },
  },
  he: {
    shared: {
      openLabel: "פתיחת ההתראה",
      preferencesLabel: "ניהול העדפות דוא״ל",
      privacyNote: "הודעה זו אינה כוללת פרטי התראה פרטיים.",
    },
    civic_initiative_update: {
      subject: "עדכון יוזמה אזרחית ב-Humanity Union",
      heading: "עדכון יוזמה אזרחית",
      body: "יש עדכון חדש הקשור ליוזמה אזרחית במעקב שלך ב-Humanity Union.",
      openLabel: "פתיחת ההתראה",
      preferencesLabel: "ניהול העדפות דוא״ל",
      privacyNote: "הודעה זו אינה כוללת פרטי התראה פרטיים.",
    },
  },
  de: {
    shared: {
      openLabel: "Benachrichtigung öffnen",
      preferencesLabel: "E-Mail-Einstellungen verwalten",
      privacyNote: "Diese E-Mail enthält keine privaten Benachrichtigungsdetails.",
    },
    civic_initiative_update: {
      subject: "Aktualisierung einer zivilen Initiative auf Humanity Union",
      heading: "Aktualisierung einer zivilen Initiative",
      body: "Es gibt ein neues Update zu einer zivilen Initiative, der Sie auf Humanity Union folgen.",
      openLabel: "Benachrichtigung öffnen",
      preferencesLabel: "E-Mail-Einstellungen verwalten",
      privacyNote: "Diese E-Mail enthält keine privaten Benachrichtigungsdetails.",
    },
  },
  es: {
    shared: {
      openLabel: "Abrir notificación",
      preferencesLabel: "Administrar preferencias de correo",
      privacyNote: "Este correo no incluye detalles privados de la notificación.",
    },
    civic_initiative_update: {
      subject: "Actualización de iniciativa cívica en Humanity Union",
      heading: "Actualización de iniciativa cívica",
      body: "Hay una nueva actualización relacionada con una iniciativa cívica que sigues en Humanity Union.",
      openLabel: "Abrir notificación",
      preferencesLabel: "Administrar preferencias de correo",
      privacyNote: "Este correo no incluye detalles privados de la notificación.",
    },
  },
  fr: {
    shared: {
      openLabel: "Ouvrir la notification",
      preferencesLabel: "Gérer les préférences e-mail",
      privacyNote: "Cet e-mail n’inclut pas de détails privés de notification.",
    },
    civic_initiative_update: {
      subject: "Mise à jour d’initiative civique sur Humanity Union",
      heading: "Mise à jour d’initiative civique",
      body: "Il y a une nouvelle mise à jour liée à une initiative civique que vous suivez sur Humanity Union.",
      openLabel: "Ouvrir la notification",
      preferencesLabel: "Gérer les préférences e-mail",
      privacyNote: "Cet e-mail n’inclut pas de détails privés de notification.",
    },
  },
  uk: {
    shared: {
      openLabel: "Відкрити сповіщення",
      preferencesLabel: "Керувати налаштуваннями електронної пошти",
      privacyNote: "Цей лист не містить приватних деталей сповіщення.",
    },
    civic_initiative_update: {
      subject: "Оновлення громадянської ініціативи на Humanity Union",
      heading: "Оновлення громадянської ініціативи",
      body: "Є нове оновлення щодо громадянської ініціативи, яку ви відстежуєте на Humanity Union.",
      openLabel: "Відкрити сповіщення",
      preferencesLabel: "Керувати налаштуваннями електронної пошти",
      privacyNote: "Цей лист не містить приватних деталей сповіщення.",
    },
  },
  pt: {
    shared: {
      openLabel: "Abrir notificação",
      preferencesLabel: "Gerir preferências de e-mail",
      privacyNote: "Este e-mail não inclui detalhes privados da notificação.",
    },
    civic_initiative_update: {
      subject: "Atualização de iniciativa cívica no Humanity Union",
      heading: "Atualização de iniciativa cívica",
      body: "Há uma nova atualização relacionada a uma iniciativa cívica que você acompanha no Humanity Union.",
      openLabel: "Abrir notificação",
      preferencesLabel: "Gerir preferências de e-mail",
      privacyNote: "Este e-mail não inclui detalhes privados da notificação.",
    },
  },
  ka: {
    shared: {
      openLabel: "შეტყობინების გახსნა",
      preferencesLabel: "ელფოსტის პარამეტრების მართვა",
      privacyNote: "ეს ელფოსტა არ შეიცავს შეტყობინების პირად დეტალებს.",
    },
    civic_initiative_update: {
      subject: "სამოქალაქო ინიციატივის განახლება Humanity Union-ზე",
      heading: "სამოქალაქო ინიციატივის განახლება",
      body: "Humanity Union-ზე თქვენს მიერ გამოწერილ სამოქალაქო ინიციატივასთან დაკავშირებით ახალი განახლებაა.",
      openLabel: "შეტყობინების გახსნა",
      preferencesLabel: "ელფოსტის პარამეტრების მართვა",
      privacyNote: "ეს ელფოსტა არ შეიცავს შეტყობინების პირად დეტალებს.",
    },
  },
  "zh-Hant": {
    shared: {
      openLabel: "開啟通知",
      preferencesLabel: "管理電子郵件偏好設定",
      privacyNote: "此電子郵件不包含私人通知詳情。",
    },
    civic_initiative_update: {
      subject: "Humanity Union 公民倡議更新",
      heading: "公民倡議更新",
      body: "您在 Humanity Union 關注的公民倡議有新的更新。",
      openLabel: "開啟通知",
      preferencesLabel: "管理電子郵件偏好設定",
      privacyNote: "此電子郵件不包含私人通知詳情。",
    },
  },
};

function normalizeLocaleTag(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "en";
  }
  if (trimmed.toLowerCase() === "zh-hant" || trimmed.toLowerCase() === "zh-tw") {
    return "zh-Hant";
  }
  const base = trimmed.split("-")[0]?.toLowerCase() ?? trimmed.toLowerCase();
  if (base === "zh") {
    return "zh-Hant";
  }
  return base;
}

export function resolveMemberNotificationEmailLocale(preferred: string | null | undefined): {
  locale: MemberNotificationEmailLocale | string;
  usedFallback: boolean;
} {
  if (!preferred) {
    return { locale: "en", usedFallback: true };
  }
  const normalized = normalizeLocaleTag(preferred);
  const exact = MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES.find(
    (entry) => entry === normalized || entry.toLowerCase() === normalized.toLowerCase(),
  );
  if (exact) {
    return { locale: exact, usedFallback: false };
  }
  return { locale: "en", usedFallback: true };
}

export function resolveMemberNotificationEmailCopy(input: {
  locale: string;
  category: MemberNotificationEmailPresentationCategory;
}): MemberNotificationEmailCopyStrings {
  const { locale } = resolveMemberNotificationEmailLocale(input.locale);
  const override = LOCALE_OVERRIDES[locale as MemberNotificationEmailLocale];
  const localizedCategory = override?.[input.category];
  const localizedShared = override?.shared;
  const english = EN_CATALOG[input.category];

  return {
    subject: localizedCategory?.subject ?? english.subject,
    heading: localizedCategory?.heading ?? english.heading,
    body: localizedCategory?.body ?? english.body,
    openLabel: localizedCategory?.openLabel ?? localizedShared?.openLabel ?? EN_SHARED.openLabel,
    preferencesLabel:
      localizedCategory?.preferencesLabel ??
      localizedShared?.preferencesLabel ??
      EN_SHARED.preferencesLabel,
    privacyNote:
      localizedCategory?.privacyNote ?? localizedShared?.privacyNote ?? EN_SHARED.privacyNote,
  };
}
