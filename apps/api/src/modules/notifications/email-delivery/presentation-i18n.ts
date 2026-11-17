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

/** HU-NOTIF-02C.4 — digest chrome (no event-private wording). */
export interface MemberNotificationEmailDigestChrome {
  subject: string;
  heading: string;
  summary: string;
  openLabel: string;
  preferencesLabel: string;
  privacyNote: string;
  countLabel: (categoryHeading: string, count: number) => string;
}

interface DigestChromeStrings {
  subject: string;
  heading: string;
  summary: string;
}

const EN_DIGEST_DAILY: DigestChromeStrings = {
  subject: "Your daily Humanity Union notification summary",
  heading: "Daily notification summary",
  summary: "Here is a short summary of notification categories from the past day.",
};

const EN_DIGEST_WEEKLY: DigestChromeStrings = {
  subject: "Your weekly Humanity Union notification summary",
  heading: "Weekly notification summary",
  summary: "Here is a short summary of notification categories from the past week.",
};

const DIGEST_CHROME_OVERRIDES: Partial<
  Record<
    MemberNotificationEmailLocale,
    {
      daily?: Partial<DigestChromeStrings>;
      weekly?: Partial<DigestChromeStrings>;
    }
  >
> = {
  ar: {
    daily: {
      subject: "ملخص إشعارات Humanity Union اليومي",
      heading: "ملخص الإشعارات اليومي",
      summary: "هذا ملخص قصير لفئات الإشعارات خلال اليوم الماضي.",
    },
    weekly: {
      subject: "ملخص إشعارات Humanity Union الأسبوعي",
      heading: "ملخص الإشعارات الأسبوعي",
      summary: "هذا ملخص قصير لفئات الإشعارات خلال الأسبوع الماضي.",
    },
  },
  he: {
    daily: {
      subject: "סיכום ההתראות היומי מ-Humanity Union",
      heading: "סיכום התראות יומי",
      summary: "להלן סיכום קצר של קטגוריות התראות מהיום האחרון.",
    },
    weekly: {
      subject: "סיכום ההתראות השבועי מ-Humanity Union",
      heading: "סיכום התראות שבועי",
      summary: "להלן סיכום קצר של קטגוריות התראות מהשבוע האחרון.",
    },
  },
  de: {
    daily: {
      subject: "Ihre tägliche Humanity-Union-Benachrichtigungsübersicht",
      heading: "Tägliche Benachrichtigungsübersicht",
      summary: "Hier ist eine kurze Übersicht der Benachrichtigungskategorien vom letzten Tag.",
    },
    weekly: {
      subject: "Ihre wöchentliche Humanity-Union-Benachrichtigungsübersicht",
      heading: "Wöchentliche Benachrichtigungsübersicht",
      summary: "Hier ist eine kurze Übersicht der Benachrichtigungskategorien der letzten Woche.",
    },
  },
  es: {
    daily: {
      subject: "Tu resumen diario de notificaciones de Humanity Union",
      heading: "Resumen diario de notificaciones",
      summary: "Aquí tienes un resumen breve de categorías de notificación del día pasado.",
    },
    weekly: {
      subject: "Tu resumen semanal de notificaciones de Humanity Union",
      heading: "Resumen semanal de notificaciones",
      summary: "Aquí tienes un resumen breve de categorías de notificación de la semana pasada.",
    },
  },
  fr: {
    daily: {
      subject: "Votre résumé quotidien des notifications Humanity Union",
      heading: "Résumé quotidien des notifications",
      summary: "Voici un court résumé des catégories de notifications de la journée écoulée.",
    },
    weekly: {
      subject: "Votre résumé hebdomadaire des notifications Humanity Union",
      heading: "Résumé hebdomadaire des notifications",
      summary: "Voici un court résumé des catégories de notifications de la semaine écoulée.",
    },
  },
  uk: {
    daily: {
      subject: "Ваш щоденний підсумок сповіщень Humanity Union",
      heading: "Щоденний підсумок сповіщень",
      summary: "Короткий підсумок категорій сповіщень за минулий день.",
    },
    weekly: {
      subject: "Ваш тижневий підсумок сповіщень Humanity Union",
      heading: "Тижневий підсумок сповіщень",
      summary: "Короткий підсумок категорій сповіщень за минулий тиждень.",
    },
  },
  pt: {
    daily: {
      subject: "O seu resumo diário de notificações do Humanity Union",
      heading: "Resumo diário de notificações",
      summary: "Aqui está um breve resumo das categorias de notificação do dia passado.",
    },
    weekly: {
      subject: "O seu resumo semanal de notificações do Humanity Union",
      heading: "Resumo semanal de notificações",
      summary: "Aqui está um breve resumo das categorias de notificação da semana passada.",
    },
  },
  ka: {
    daily: {
      subject: "თქვენი ყოველდღიური Humanity Union შეტყობინებების შეჯამება",
      heading: "ყოველდღიური შეტყობინებების შეჯამება",
      summary: "აქ არის შეტყობინების კატეგორიების მოკლე შეჯამება გასული დღიდან.",
    },
    weekly: {
      subject: "თქვენი ყოველკვირეული Humanity Union შეტყობინებების შეჯამება",
      heading: "ყოველკვირეული შეტყობინებების შეჯამება",
      summary: "აქ არის შეტყობინების კატეგორიების მოკლე შეჯამება გასული კვირიდან.",
    },
  },
  "zh-Hant": {
    daily: {
      subject: "您的 Humanity Union 每日通知摘要",
      heading: "每日通知摘要",
      summary: "以下是過去一天通知類別的簡短摘要。",
    },
    weekly: {
      subject: "您的 Humanity Union 每週通知摘要",
      heading: "每週通知摘要",
      summary: "以下是過去一週通知類別的簡短摘要。",
    },
  },
};

export function resolveMemberNotificationEmailDigestChrome(input: {
  locale: string;
  frequency: "daily" | "weekly";
}): MemberNotificationEmailDigestChrome {
  const { locale } = resolveMemberNotificationEmailLocale(input.locale);
  const override = DIGEST_CHROME_OVERRIDES[locale as MemberNotificationEmailLocale];
  const english = input.frequency === "daily" ? EN_DIGEST_DAILY : EN_DIGEST_WEEKLY;
  const localized =
    input.frequency === "daily" ? override?.daily : override?.weekly;
  const shared = resolveMemberNotificationEmailCopy({
    locale,
    category: "civic_initiative_update",
  });

  return {
    subject: localized?.subject ?? english.subject,
    heading: localized?.heading ?? english.heading,
    summary: localized?.summary ?? english.summary,
    openLabel: shared.openLabel,
    preferencesLabel: shared.preferencesLabel,
    privacyNote: shared.privacyNote,
    countLabel: (categoryHeading, count) => `${categoryHeading}: ${count}`,
  };
}
