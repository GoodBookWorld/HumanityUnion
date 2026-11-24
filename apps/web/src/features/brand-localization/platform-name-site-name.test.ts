/**
 * HU-LOC-BRAND-01B — platform-name sentences use {siteName}.
 * The legal name Humanity Union Society stays literal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTranslator, type AbstractIntlMessages } from "next-intl";

import { getBuiltinEnglishBrand } from "./resolve-localized-brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const LOCALES = ["en", "ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;

const LEGAL_KEYS = [
  "regionalProgramPublic.development.steps.team.body",
  "regionalProgramPublic.presence.notice",
  "regionalProgramPublic.principles.legal",
] as const;

const PLATFORM_KEYS = [
  "auth.loginSubtitle",
  "auth.deleteAccountIntro",
  "membershipPublic.faq.items.what-is-member.question",
  "volunteerPublic.intro.p1",
  "rrpApplication.consent.label",
] as const;

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function load(locale: string): Record<string, unknown> {
  return JSON.parse(read(`apps/web/src/features/i18n/messages/${locale}.json`)) as Record<
    string,
    unknown
  >;
}

function get(tree: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, tree);
}

function siteNameCount(value: string): number {
  return value.match(/\{siteName\}/g)?.length ?? 0;
}

describe("platform name uses published siteName", () => {
  it("replaces the platform name and keeps the surrounding sentence", () => {
    const english = load("en");
    assert.equal(get(english, "auth.loginSubtitle"), "Access your {siteName} workspace.");
    assert.equal(
      get(english, "auth.deleteAccountIntro"),
      "You can schedule deletion of your {siteName} account. The 30-day recovery period starts only after you confirm an email code.",
    );
    assert.match(String(get(english, "volunteerPublic.intro.p1")), /<platform>\{siteName\} platform<\/platform>/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /\{siteName\}/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /<privacy>/);

    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of PLATFORM_KEYS) {
        const value = get(catalog, key);
        if (typeof value !== "string") continue;
        assert.equal(siteNameCount(value), siteNameCount(String(get(english, key))), `${locale} ${key}`);
        const displayed = value.replaceAll("{siteName}", "Союз Людяності");
        assert.doesNotMatch(displayed, /\{siteName\}/, `${locale} ${key}`);
        assert.match(displayed, /Союз Людяності/);
      }
    }
  });

  it("keeps Humanity Union Society as the legal name", () => {
    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of LEGAL_KEYS) {
        const value = String(get(catalog, key));
        assert.match(value, /Humanity Union Society/, `${locale} ${key}`);
      }
    }
    const legal = String(get(load("en"), "regionalProgramPublic.principles.legal"));
    assert.match(legal, /\{siteName\}/);
    assert.match(legal, /Humanity Union Society/);
  });

  it("uses the builtin English siteName when Brand Localization is unavailable", () => {
    const fallback = getBuiltinEnglishBrand("ar");
    assert.equal(fallback.siteName, "Humanity Union");
    assert.equal(fallback.source, "builtin_english");
    const displayed = String(get(load("ar"), "auth.loginSubtitle")).replaceAll(
      "{siteName}",
      fallback.siteName,
    );
    assert.equal(displayed.includes("{siteName}"), false);
    assert.match(displayed, /Humanity Union/);
  });

  it("keeps Arabic and Hebrew RTL on the language registry, not in the catalog", () => {
    const layout = read("apps/web/src/app/layout.tsx");
    const catalog = read("apps/api/src/modules/language/language-catalog.ts");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(catalog, /code: "ar"[\s\S]{0,120}rtl: true/);
    assert.match(catalog, /code: "he"[\s\S]{0,120}rtl: true/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/ar.json"), /dir="ltr"/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/he.json"), /dir="ltr"/);
  });

  it("does not turn the glossary into a runtime replacement system", () => {
    const seed = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.seed.ts",
    );
    assert.match(seed, /conceptId: "humanity_union"/);
    assert.match(seed, /canonicalEnglishTerm: "Humanity Union"/);
    assert.match(seed, /translations: \{\}/);
    const provider = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.provider-context.ts",
    );
    assert.doesNotMatch(provider, /replaceAll\("Humanity Union"/);
  });

  it("protects approved published translations from Add missing overwrites", () => {
    const service = read(
      "apps/api/src/modules/web-ui-message-packs/web-ui-message-pack.service.ts",
    );
    assert.match(service, /Preserves every existing leaf/);
    assert.match(service, /preserveExistingPublishedLeaves: true/);
  });

  it("keeps the published nominative name grammatical", () => {
    const ka = load("ka");
    const georgian = [
      "civicActivity.pageSubtitle",
      "initiativeExperience.civicArchivePublic.pageTitle",
      "membershipPublic.faq.items.what-is-member.question",
      "initiativeExperience.manage.newsSource.disclaimer",
      "workspace.initiativesPage.subtitle",
      "pwa.install.installCta",
      "preferences.language.help",
      "auth.loginSubtitle",
      "auth.registerSubtitle",
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      "notifications.types.member_badge_shipped.message",
      "notifications.types.member_badge_delivered.message",
      "preferences.notification.emailHelp",
      "workspace.publishingPage.editor.seo.huShareHelper",
      "pwa.install.lead",
    ];
    for (const key of georgian) {
      assert.doesNotMatch(String(get(ka, key)), /\{siteName\}[-\u10A0-\u10FF]/, key);
    }
    assert.equal(
      get(ka, "membershipPublic.faq.items.what-is-member.question"),
      "ვინ არის წევრი პლატფორმაზე {siteName}?",
    );
    assert.doesNotMatch(JSON.stringify(ka), /«\{siteName\}»/);
    assert.equal(get(ka, "pwa.install.installCta"), "დააინსტალირეთ {siteName}");
    assert.equal(
      get(ka, "initiativeExperience.author.petition.public.participationTransparencyNote"),
      "ამ პეტიციის ხელმოწერა წარმოადგენს სამოქალაქო მონაწილეობის ფორმას პლატფორმაზე {siteName}. ის არ არის იურიდიულად სავალდებულო პეტიცია და თავისთავად არ ქმნის რაიმე იურიდიულ თუ სამთავრობო ვალდებულებას.",
    );
    assert.doesNotMatch(
      String(get(ka, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /მონაცილ/,
    );
    assert.match(String(get(ka, "auth.registerSubtitle")), /მონაწილის/);
    assert.match(String(get(ka, "memberProfile.membershipNote")), /წევრობა/);
    assert.match(
      String(get(ka, "notifications.types.member_badge_contribution_confirmed.message")),
      /მოთხოვნა წევრის ნივთზე/,
    );
    assert.doesNotMatch(
      String(get(ka, "notifications.types.member_badge_shipped.message")),
      /მოთხოვნა|მონაწილ/,
    );
    assert.match(String(get(ka, "notifications.types.member_badge_delivered.message")), /ნივთი/);
    assert.match(String(get(ka, "preferences.notification.emailHelp")), /შინაარსს/);
    assert.doesNotMatch(String(get(ka, "preferences.notification.emailHelp")), /შიგნიათს/);
    assert.match(
      String(get(ka, "workspace.publishingPage.editor.seo.huShareHelper")),
      /უვლის გვერდს/,
    );
    assert.doesNotMatch(
      String(get(ka, "workspace.publishingPage.editor.seo.huShareHelper")),
      /გვლის გვერდს/,
    );
    assert.match(String(get(ka, "pwa.install.lead")), /კაცობრიობა/);
    assert.doesNotMatch(String(get(ka, "pwa.install.lead")), /Humanity/);

    const french = load("fr");
    assert.match(String(get(french, "auth.twoStepLoginHelp")), /à l''\{siteName\}/);
    assert.match(String(get(french, "authoringPage.application.motivationLabel")), /de l''\{siteName\}/);
    assert.match(String(get(french, "notifications.types.member_badge_delivered.message")), /Membre de l''\{siteName\}/);
    assert.doesNotMatch(JSON.stringify(french), /[^']'\{siteName\}/);
    assert.equal(get(french, "initiativeExperience.author.sidebar.assistantTitle"), "Assistant de l''{siteName}");
    assert.equal(
      get(french, "pwa.install.alreadyInstalled"),
      "L'application de l''{siteName} est déjà installée sur cet appareil.",
    );
    assert.equal(
      get(french, "pwa.install.lead"),
      "Emportez l'humanité avec vous. Installez l'application pour accéder directement à votre Espace de Travail, à vos Initiatives, à vos Notifications et à l'Assistant de l''{siteName}.",
    );
    assert.match(String(get(french, "auth.registerSubtitle")), /Participant de l''\{siteName\}/);
    assert.match(String(get(french, "memberProfile.subtitle")), /Participant de l''\{siteName\}/);
    assert.match(String(get(french, "memberProfile.membershipNote")), /adhésion/);
    assert.doesNotMatch(
      String(get(french, "notifications.types.member_badge_shipped.message")),
      /Participant|adhésion/,
    );
    assert.match(
      String(get(french, "rrpApplication.consent.label")),
      /l''\{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(french, "volunteerPublic.intro.p1")),
      /<platform>plateforme de l''\{siteName\}<\/platform>/,
    );

    const spanish = load("es");
    assert.match(String(get(spanish, "auth.loginSubtitle")), /de la \{siteName\}/);
    assert.doesNotMatch(JSON.stringify(spanish), /la la \{siteName\}/);
    assert.equal(
      get(spanish, "membershipPublic.faq.items.what-is-member.question"),
      "¿Qué es un Miembro de la {siteName}?",
    );
    assert.equal(
      get(spanish, "initiativeExperience.author.sidebar.assistantTitle"),
      "Asistente de la {siteName}",
    );
    assert.doesNotMatch(JSON.stringify(spanish), /Assistant de \{siteName\}/);
    assert.equal(
      get(spanish, "pwa.install.alreadyInstalled"),
      "La aplicación de la {siteName} ya está instalada en este dispositivo.",
    );
    assert.match(
      String(get(spanish, "volunteerPublic.intro.p1")),
      /plataforma de la <platform>\{siteName\}<\/platform>/,
    );
    assert.match(
      String(get(spanish, "rrpApplication.consent.label")),
      /que la \{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(String(get(spanish, "auth.registerSubtitle")), /Participante de la \{siteName\}/);
    assert.match(String(get(spanish, "memberProfile.subtitle")), /Participante de la \{siteName\}/);
    assert.match(String(get(spanish, "memberProfile.membershipNote")), /Membresía/);
    assert.match(
      String(get(spanish, "notifications.types.member_badge_shipped.message")),
      /artículo de Miembro de la \{siteName\}/,
    );
    assert.doesNotMatch(
      String(get(spanish, "notifications.types.member_badge_delivered.message")),
      /Participante|membresía/,
    );
    assert.equal(
      get(spanish, "workspace.publishingPage.editor.seo.huShareLegend"),
      "Distribución en canales sociales de la {siteName}",
    );

    const german = load("de");
    for (const key of [
      "auth.chooseNewPasswordSubtitle",
      "auth.verifyEmailSubtitle",
      "initiativeExperience.author.archive.document.disclaimer",
      "initiativeExperience.publicChoice.election.eyebrow",
      "initiativeExperience.publicChoice.results.disclaimerBody",
      "preferences.unavailableExplanation",
      "pwa.install.androidStep5",
      "workspace.publishingPage.editor.seo.lede",
      "volunteerPublic.meaning.p4",
      "volunteerPublic.takePart.p3",
    ]) {
      assert.doesNotMatch(String(get(german, key)), /\{siteName\}-/, key);
    }
    assert.match(String(get(german, "auth.chooseNewPasswordSubtitle")), /Konto bei \{siteName\}/);
    assert.match(String(get(german, "volunteerPublic.meaning.p4")), /<platform>Plattform \{siteName\}<\/platform>/);
    assert.equal(get(german, "auth.loginSubtitle"), "Greifen Sie auf Ihren Arbeitsbereich bei {siteName} zu.");
    assert.equal(
      get(german, "auth.registerSubtitle"),
      "Erstellen Sie Ihr Teilnehmerkonto bei {siteName}.",
    );
    assert.match(String(get(german, "auth.twoStepLoginHelp")), /Mitgliedschaft bei \{siteName\}/);
    assert.equal(get(german, "membershipPublic.faq.items.what-is-member.question"), "Was ist ein Mitglied von {siteName}?");
    assert.equal(get(german, "memberProfile.subtitle"), "Ihr Teilnehmerprofil bei {siteName}");
    assert.match(
      String(get(german, "notifications.types.member_badge_contribution_confirmed.message")),
      /Mitgliedsartikel von \{siteName\}/,
    );
    assert.doesNotMatch(
      String(get(german, "notifications.types.member_badge_delivered.message")),
      /Teilnehmer|Mitgliedschaft/,
    );
    assert.equal(get(german, "pwa.install.lead"), "Nehmen Sie die Menschlichkeit mit. Installieren Sie die App für den direkten Zugriff auf Ihren Arbeitsbereich, Ihre Initiativen, Benachrichtigungen und den Assistenten von {siteName}.");
    assert.doesNotMatch(String(get(german, "pwa.install.lead")), /Humanity/);
    assert.equal(get(german, "workspace.publishingPage.editor.seo.huShareLegend"), "Social-Media-Verbreitung von {siteName}");
    assert.match(String(get(german, "rrpApplication.consent.label")), /<privacy>[\s\S]*<\/privacy>/);
    assert.doesNotMatch(JSON.stringify(german), /«\{siteName\}»/);

    const arabic = load("ar");
    assert.equal(
      get(arabic, "membershipPublic.faq.items.what-is-member.question"),
      "ما هو العضو في منصة {siteName}؟",
    );
    assert.equal(
      get(arabic, "auth.registerSubtitle"),
      "أنشئ حساب المشارك الخاص بك على منصة {siteName}.",
    );
    assert.match(String(get(arabic, "auth.registerSubtitle")), /المشارك/);
    assert.doesNotMatch(String(get(arabic, "auth.registerSubtitle")), /الخاص بك\.$/);
    assert.equal(
      get(arabic, "initiativeExperience.author.petition.public.participationTransparencyNote"),
      "يُعد التوقيع على هذه العريضة شكلاً من أشكال المشاركة المدنية على منصة {siteName}. وهي ليست عريضة ملزمة قانوناً، ولا تنشئ في حد ذاتها أي التزام قانوني أو حكومي.",
    );
    assert.doesNotMatch(
      String(get(arabic, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /التماس/,
    );
    assert.match(String(get(arabic, "memberProfile.membershipNote")), /العضوية/);
    assert.match(
      String(get(arabic, "notifications.types.member_badge_contribution_confirmed.message")),
      /طلبك للغرض الرسمي للعضو/,
    );
    assert.match(
      String(get(arabic, "notifications.types.member_badge_delivered.message")),
      /تم تسليم الغرض الرسمي للعضو/,
    );
    assert.doesNotMatch(
      String(get(arabic, "notifications.types.member_badge_delivered.message")),
      /طلب/,
    );
    assert.match(
      String(get(arabic, "notifications.types.member_badge_shipped.message")),
      /تم شحن الغرض الرسمي للعضو/,
    );
    assert.doesNotMatch(
      String(get(arabic, "notifications.types.member_badge_shipped.message")),
      /طلب|مشارك/,
    );
    assert.match(String(get(arabic, "preferences.notification.copiesHelp")), /اختياري/);
    assert.match(String(get(arabic, "preferences.notification.copiesHelp")), /لا يُضمن لكل حدث/);
    assert.match(String(get(arabic, "preferences.notification.copiesHelp")), /لا يغيّر بريد تسجيل الدخول/);
    assert.match(String(get(arabic, "preferences.notification.copiesHelp")), /لا يعني أن رسالة بريد قد أُرسلت/);
    assert.match(String(get(arabic, "pwa.install.lead")), /^اصطحب الإنسانية/);
    assert.doesNotMatch(String(get(arabic, "pwa.install.lead")), /Humanity/);
    assert.equal(get(arabic, "pwa.searchLabel"), "البحث في منصة {siteName}");
    assert.match(
      String(get(arabic, "workspace.publishingPage.editor.seo.huShareHelper")),
      /بتوزيع/,
    );
    assert.match(
      String(get(arabic, "workspace.publishingPage.editor.seo.huShareHelper")),
      /لا يكفي رابط الملف الشخصي وحده/,
    );
    assert.doesNotMatch(
      String(get(arabic, "pwa.install.iosA2hsStandaloneNote")),
      /كطبيعة/,
    );
    assert.match(
      String(get(arabic, "rrpApplication.consent.label")),
      /منصة \{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(arabic, "volunteerPublic.intro.p1")),
      /منصة <platform>\{siteName\}<\/platform>/,
    );
    for (const key of [
      "auth.loginSubtitle",
      "auth.registerSubtitle",
      "initiativeExperience.civicArchivePublic.pageTitle",
      "memberProfile.membershipNote",
      "workspace.publishingPage.editor.seo.huShareHelper",
      "workspace.publishingPage.editor.seo.huShareLegend",
    ]) {
      assert.doesNotMatch(String(get(arabic, key)), /ل\{siteName\}/, key);
      assert.doesNotMatch(String(get(arabic, key)), /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/, key);
    }
    const ukrainian = load("uk");
    assert.equal(
      get(ukrainian, "membershipPublic.faq.items.what-is-member.question"),
      "Хто такий Член Союзу на платформі {siteName}?",
    );
    assert.equal(
      get(ukrainian, "pwa.install.lead"),
      "Візьміть Людяність із собою. Встановіть додаток для прямого доступу до вашого Робочого простору, Ініціатив, сповіщень та Помічника платформи {siteName}.",
    );
    assert.doesNotMatch(String(get(ukrainian, "pwa.install.lead")), /Humanity/);
    for (const key of [
      "notifications.types.member_badge_contribution_confirmed.message",
      "notifications.types.member_badge_delivered.message",
      "notifications.types.member_badge_shipped.message",
    ]) {
      assert.match(String(get(ukrainian, key)), /Члена Союзу на платформі \{siteName\}/, key);
      assert.doesNotMatch(String(get(ukrainian, key)), /Учасник|Член платформи|значок|сертифікат|картк/, key);
    }
    assert.match(
      String(get(ukrainian, "notifications.types.member_badge_contribution_confirmed.message")),
      /заявку на отримання/,
    );
    assert.doesNotMatch(
      String(get(ukrainian, "notifications.types.member_badge_delivered.message")),
      /заявк|запит/,
    );
    assert.doesNotMatch(
      String(get(ukrainian, "notifications.types.member_badge_shipped.message")),
      /заявк|запит/,
    );
    assert.match(
      String(get(ukrainian, "initiativeExperience.author.archive.document.disclaimer")),
      /діяльність у межах Ініціативи/,
    );
    assert.match(
      String(get(ukrainian, "initiativeExperience.author.archive.document.disclaimer")),
      /якщо його окремо не визнано відповідною установою/,
    );
    assert.doesNotMatch(
      String(get(ukrainian, "initiativeExperience.author.archive.document.disclaimer")),
      /активність Ініціатива/,
    );
    assert.match(
      String(get(ukrainian, "preferences.notification.emailHelp")),
      /Робочому просторі/,
    );
    assert.match(
      String(get(ukrainian, "preferences.notification.emailHelp")),
      /приватних розмов/,
    );
    assert.match(
      String(get(ukrainian, "preferences.notification.emailHelp")),
      /інформації про Ініціативи/,
    );
    assert.doesNotMatch(
      String(get(ukrainian, "workspace.publishingPage.editor.seo.lede")),
      /платформи платформи|вихідну скриньку/,
    );
    assert.match(
      String(get(ukrainian, "workspace.publishingPage.editor.seo.lede")),
      /черги вихідних повідомлень для офіційних каналів платформи \{siteName\}/,
    );
    assert.match(String(get(ukrainian, "auth.registerSubtitle")), /Учасника платформи \{siteName\}/);
    assert.match(
      String(get(ukrainian, "rrpApplication.consent.label")),
      /платформа \{siteName\} обробляла[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(ukrainian, "initiativeExperience.manage.newsSource.disclaimer")),
      /Платформа \{siteName\} не перевіряла/,
    );
    assert.match(
      String(get(ukrainian, "authoringPage.becomeAuthor.thanks")),
      /долучення до Блогу платформи \{siteName\}/,
    );
    const traditionalChinese = load("zh-Hant");
    assert.equal(
      get(traditionalChinese, "membershipPublic.faq.items.what-is-member.question"),
      "什麼是 {siteName} 的會員？",
    );
    assert.match(String(get(traditionalChinese, "auth.registerSubtitle")), /參與者/);
    assert.match(String(get(traditionalChinese, "memberProfile.membershipNote")), /會員資格/);
    assert.doesNotMatch(String(get(traditionalChinese, "memberProfile.subtitle")), /會員/);
    assert.equal(
      get(traditionalChinese, "initiativeExperience.author.petition.public.participationTransparencyNote"),
      "在 {siteName} 上簽署此請願，是一種公民參與。此請願不具法律約束力，簽署本身也不會產生任何法律或政府義務。",
    );
    assert.doesNotMatch(
      String(get(traditionalChinese, "notifications.types.member_badge_delivered.message")),
      /申請|請求|參與者/,
    );
    assert.match(
      String(get(traditionalChinese, "notifications.types.member_badge_shipped.message")),
      /正式會員物品已寄出/,
    );
    assert.match(
      String(get(traditionalChinese, "notifications.types.member_badge_contribution_confirmed.message")),
      /正式會員物品申請已確認/,
    );
    assert.match(String(get(traditionalChinese, "preferences.notification.copiesHelp")), /不保證每一事件都會送達/);
    assert.match(String(get(traditionalChinese, "preferences.notification.copiesHelp")), /並不代表已經寄出郵件/);
    assert.match(String(get(traditionalChinese, "preferences.notification.emailHelp")), /私人對話內容/);
    assert.doesNotMatch(String(get(traditionalChinese, "pwa.install.androidHintPrimary")), /頁麵/);
    assert.match(String(get(traditionalChinese, "pwa.install.lead")), /^把人性帶在身邊/);
    assert.doesNotMatch(String(get(traditionalChinese, "pwa.install.lead")), /Humanity|隨身攜帶人類/);
    assert.equal(get(traditionalChinese, "pwa.searchLabel"), "在 {siteName} 平台內搜尋");
    assert.match(
      String(get(traditionalChinese, "workspace.publishingPage.editor.seo.huShareHelper")),
      /並不會自動發布/,
    );
    assert.doesNotMatch(
      String(get(traditionalChinese, "workspace.publishingPage.editor.seo.lede")),
      /佇列排入/,
    );
    assert.match(
      String(get(traditionalChinese, "rrpApplication.consent.label")),
      /\{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(traditionalChinese, "volunteerPublic.intro.p1")),
      /<platform>\{siteName\}<\/platform> 平台/,
    );
    const portuguese = load("pt");
    assert.equal(
      get(portuguese, "auth.loginSubtitle"),
      "Aceda ao seu Espaço de Trabalho na plataforma {siteName}.",
    );
    assert.equal(
      get(portuguese, "auth.deleteAccountIntro"),
      "Pode agendar a eliminação da sua conta na plataforma {siteName}. O período de recuperação de 30 dias começa apenas depois de confirmar um código enviado por e-mail.",
    );
    assert.equal(
      get(portuguese, "initiativeExperience.author.sidebar.assistantTitle"),
      "Assistente da plataforma {siteName}",
    );
    assert.doesNotMatch(
      String(get(portuguese, "initiativeExperience.author.sidebar.assistantTitle")),
      /Assistant/,
    );
    assert.match(
      String(get(portuguese, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /esta Petição/,
    );
    assert.match(
      String(get(portuguese, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /juridicamente vinculativa/,
    );
    assert.doesNotMatch(
      String(get(portuguese, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /Participante/,
    );
    assert.match(String(get(portuguese, "auth.registerSubtitle")), /Participante/);
    assert.match(String(get(portuguese, "memberProfile.membershipNote")), /Afiliação/);
    assert.match(
      String(get(portuguese, "notifications.types.member_badge_contribution_confirmed.message")),
      /pedido de item oficial de Membro/,
    );
    assert.match(
      String(get(portuguese, "notifications.types.member_badge_delivered.message")),
      /item oficial de Membro/,
    );
    assert.doesNotMatch(
      String(get(portuguese, "notifications.types.member_badge_delivered.message")),
      /\bpedido\b|solicitação|Participante/,
    );
    assert.match(
      String(get(portuguese, "notifications.types.member_badge_shipped.message")),
      /foi expedido/,
    );
    assert.doesNotMatch(
      String(get(portuguese, "notifications.types.member_badge_shipped.message")),
      /\bpedido\b|solicitação|Participante/,
    );
    assert.equal(get(portuguese, "pwa.searchLabel"), "Pesquisar na plataforma {siteName}");
    assert.match(String(get(portuguese, "pwa.install.lead")), /Humanidade/);
    assert.doesNotMatch(String(get(portuguese, "pwa.install.lead")), /Humanity|você/);
    assert.doesNotMatch(
      String(get(portuguese, "authoringPage.becomeAuthor.encouragement")),
      /Apoiie/,
    );
    assert.match(
      String(get(portuguese, "authoringPage.becomeAuthor.encouragement")),
      /evidências/,
    );
    assert.match(
      String(get(portuguese, "workspace.publishingPage.editor.seo.huShareHelper")),
      /não publica automaticamente/,
    );
    assert.match(
      String(get(portuguese, "workspace.publishingPage.editor.seo.huShareHelper")),
      /nunca contornam/,
    );
    assert.equal(
      get(portuguese, "workspace.publishingPage.editor.seo.huShareLegend"),
      "Distribuição nas redes sociais da plataforma {siteName}",
    );
    assert.doesNotMatch(
      String(get(portuguese, "volunteerPublic.takePart.p3")),
      /utilize-as/,
    );
    assert.match(
      String(get(portuguese, "rrpApplication.consent.label")),
      /plataforma \{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(portuguese, "volunteerPublic.intro.p1")),
      /plataforma <platform>\{siteName\}<\/platform>/,
    );
    const hebrew = load("he");
    assert.match(String(get(hebrew, "auth.loginSubtitle")), /ב\{siteName\}/);
    assert.equal(
      get(hebrew, "initiativeExperience.author.petition.public.participationTransparencyNote"),
      "חתימה על עצומה זו היא צורה של השתתפות אזרחית ב{siteName}. אין זו עצומה מחייבת מבחינה משפטית, והיא אינה יוצרת, כשלעצמה, כל חובה משפטית או ממשלתית.",
    );
    assert.doesNotMatch(
      String(get(hebrew, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /משתתף/,
    );
    assert.match(String(get(hebrew, "auth.registerSubtitle")), /מִשׁתַתֵף/);
    assert.match(String(get(hebrew, "memberProfile.subtitle")), /המִשׁתַתֵף שלך ב\{siteName\}/);
    assert.equal(get(hebrew, "membershipPublic.faq.items.what-is-member.question"), "מהו חָבֵר של {siteName}?");
    assert.match(String(get(hebrew, "memberProfile.membershipNote")), /חֲבֵרוּת/);
    assert.match(
      String(get(hebrew, "notifications.types.member_badge_shipped.message")),
      /פריט החָבֵר הרשמי של \{siteName\} יצא למשלוח/,
    );
    assert.doesNotMatch(
      String(get(hebrew, "notifications.types.member_badge_delivered.message")),
      /משתתף|חֲבֵרוּת/,
    );
    assert.match(String(get(hebrew, "pwa.install.lead")), /האנושות/);
    assert.doesNotMatch(String(get(hebrew, "pwa.install.lead")), /Humanity/);
    assert.match(
      String(get(hebrew, "rrpApplication.consent.label")),
      /\{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );

    const corrected = {
      ka: georgian,
      fr: [
        "auth.twoStepLoginHelp",
        "auth.loginSubtitle",
        "auth.registerSubtitle",
        "authoringPage.application.motivationLabel",
        "initiativeExperience.author.sidebar.assistantTitle",
        "pwa.install.alreadyInstalled",
        "pwa.install.lead",
        "rrpApplication.consent.label",
        "volunteerPublic.intro.p1",
        "notifications.types.member_badge_delivered.message",
        "workspace.publishingPage.editor.seo.huShareLegend",
      ],
      es: [
        "auth.loginSubtitle",
        "auth.deleteAccountIntro",
        "auth.registerSubtitle",
        "membershipPublic.faq.items.what-is-member.question",
        "initiativeExperience.author.sidebar.assistantTitle",
        "pwa.install.alreadyInstalled",
        "pwa.install.lead",
        "volunteerPublic.intro.p1",
        "rrpApplication.consent.label",
        "notifications.types.member_badge_shipped.message",
        "workspace.publishingPage.editor.seo.huShareLegend",
        "preferences.subtitle",
        "authoringPage.application.motivationLabel",
      ],
      he: [
        "auth.loginSubtitle",
        "auth.twoStepLoginHelp",
        "initiativeExperience.author.petition.public.participationTransparencyNote",
        "memberProfile.subtitle",
        "membershipPublic.faq.items.what-is-member.question",
        "notifications.types.member_badge_shipped.message",
        "pwa.install.lead",
        "pwa.install.alreadyInstalled",
        "rrpApplication.consent.label",
        "volunteerPublic.intro.p1",
      ],
      de: ["auth.chooseNewPasswordSubtitle", "volunteerPublic.meaning.p4"],
      pt: [
        "auth.loginSubtitle",
        "auth.deleteAccountIntro",
        "auth.registerSubtitle",
        "initiativeExperience.author.sidebar.assistantTitle",
        "initiativeExperience.author.petition.public.participationTransparencyNote",
        "notifications.types.member_badge_contribution_confirmed.message",
        "notifications.types.member_badge_delivered.message",
        "notifications.types.member_badge_shipped.message",
        "pwa.install.lead",
        "pwa.searchLabel",
        "workspace.publishingPage.editor.seo.huShareHelper",
        "workspace.publishingPage.editor.seo.huShareLegend",
        "volunteerPublic.takePart.p3",
        "rrpApplication.consent.label",
        "authoringPage.becomeAuthor.encouragement",
      ],
      ar: [
        "auth.loginSubtitle",
        "auth.registerSubtitle",
        "auth.deleteAccountIntro",
        "membershipPublic.faq.items.what-is-member.question",
        "initiativeExperience.author.petition.public.participationTransparencyNote",
        "notifications.types.member_badge_shipped.message",
        "notifications.types.member_badge_delivered.message",
        "preferences.notification.copiesHelp",
        "pwa.install.lead",
        "pwa.searchLabel",
        "workspace.publishingPage.editor.seo.huShareHelper",
        "workspace.publishingPage.editor.seo.huShareLegend",
        "rrpApplication.consent.label",
        "volunteerPublic.meaning.p4",
      ],
      uk: [
        "membershipPublic.faq.items.what-is-member.question",
        "initiativeExperience.author.archive.document.disclaimer",
        "preferences.notification.emailHelp",
        "notifications.types.member_badge_contribution_confirmed.message",
        "notifications.types.member_badge_delivered.message",
        "notifications.types.member_badge_shipped.message",
        "workspace.publishingPage.editor.seo.lede",
      ],
      "zh-Hant": [
        "auth.loginSubtitle",
        "auth.registerSubtitle",
        "auth.deleteAccountIntro",
        "membershipPublic.faq.items.what-is-member.question",
        "initiativeExperience.author.petition.public.participationTransparencyNote",
        "notifications.types.member_badge_contribution_confirmed.message",
        "notifications.types.member_badge_delivered.message",
        "notifications.types.member_badge_shipped.message",
        "preferences.notification.copiesHelp",
        "pwa.install.lead",
        "pwa.install.androidHintPrimary",
        "pwa.searchLabel",
        "workspace.publishingPage.editor.seo.huShareHelper",
        "workspace.publishingPage.editor.seo.lede",
        "volunteerPublic.takePart.p3",
      ],
    };
    for (const [locale, keys] of Object.entries(corrected)) {
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      for (const key of keys) {
        assert.equal(get(packaged, key), get(load(locale), key), `${locale} ${key}`);
      }
    }
  });

  it("renders French elision as one apostrophe and the interpolated brand", () => {
    const french = load("fr");
    const t = createTranslator({
      locale: "fr",
      messages: french as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "Union de l'Humanité";
    const rich = (chunks: string) => chunks;
    for (const key of [
      "auth.loginSubtitle",
      "auth.registerSubtitle",
      "initiativeExperience.author.sidebar.assistantTitle",
      "pwa.install.alreadyInstalled",
      "pwa.install.lead",
      "membershipPublic.faq.items.what-is-member.question",
    ]) {
      const rendered = t(key, { siteName });
      assert.equal(typeof rendered, "string", key);
      assert.doesNotMatch(rendered, /\{siteName\}|''/, key);
      assert.match(rendered, /l'Union de l'Humanité/, key);
    }
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /l'humanité/);
    assert.doesNotMatch(lead, /Humanity/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /l'Union de l'Humanité/);
    assert.match(consent, /Politique de confidentialité/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>|''/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.equal(platform, "Le développement de la plateforme de l'Union de l'Humanité est une contribution personnelle que chacun d'entre nous peut apporter à son propre avenir et à celui des générations futures.");
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "Accédez à votre Espace de Travail de l'Humanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}|''/);
    assert.match(t("auth.registerSubtitle", { siteName }), /Participant/);
    assert.match(t("membershipPublic.faq.items.what-is-member.question", { siteName }), /Membre/);
    assert.doesNotMatch(
      t("notifications.types.member_badge_shipped.message", { siteName }),
      /Participant/,
    );
  });

  it("renders Hebrew brand prefixes without unresolved placeholders", () => {
    const hebrew = load("he");
    const t = createTranslator({
      locale: "he",
      messages: hebrew as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "איחוד האנושות";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "גש אל סביבת העבודה שלך באיחוד האנושות.");
    assert.doesNotMatch(login, /\{siteName\}|ב-|ב /);
    const petition = t("initiativeExperience.author.petition.public.participationTransparencyNote", { siteName });
    assert.match(petition, /עצומה זו/);
    assert.doesNotMatch(petition, /משתתף|\{siteName\}/);
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /האנושות/);
    assert.match(lead, /ולעוזר של איחוד האנושות/);
    assert.doesNotMatch(lead, /Humanity|\{siteName\}/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /איחוד האנושות/);
    assert.match(consent, /מדיניות הפרטיות/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.equal(
      platform,
      "פיתוח פלטפורמת איחוד האנושות הוא תרומה אישית שכל אחד מאיתנו יכול לתת לעתיד שלנו ולעתיד הדורות הבאים.",
    );
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "גש אל סביבת העבודה שלך בHumanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}/);
    for (const key of [
      "auth.loginSubtitle",
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      "pwa.install.lead",
      "rrpApplication.consent.label",
      "notifications.types.member_badge_shipped.message",
    ]) {
      assert.doesNotMatch(String(get(hebrew, key)), /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/, key);
    }
  });

  it("renders Georgian platform case without attaching a suffix to the brand", () => {
    const georgian = load("ka");
    const t = createTranslator({
      locale: "ka",
      messages: georgian as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "კაცობრიობის კავშირი";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "შედით თქვენს სამუშაო სივრცეში პლატფორმაზე კაცობრიობის კავშირი.");
    assert.doesNotMatch(login, /\{siteName\}/);
    const petition = t(
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      { siteName },
    );
    assert.match(petition, /ამ პეტიციის ხელმოწერა/);
    assert.match(petition, /იურიდიულად სავალდებულო პეტიცია/);
    assert.doesNotMatch(petition, /მონაცილ|\{siteName\}/);
    const shipped = t("notifications.types.member_badge_shipped.message", { siteName });
    assert.equal(shipped, "წევრის ოფიციალური ნივთი პლატფორმაზე კაცობრიობის კავშირი გაიგზავნა.");
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /^თან იქონიეთ კაცობრიობა/);
    assert.match(lead, /კაცობრიობის კავშირი/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /კაცობრიობის კავშირი/);
    assert.match(consent, /კონფიდენციალურობის პოლიტიკაში/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.match(platform, /კაცობრიობის კავშირი/);
    assert.doesNotMatch(platform, /\{siteName\}/);
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "შედით თქვენს სამუშაო სივრცეში პლატფორმაზე Humanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}/);
  });

  it("renders Portuguese platform grammar for the published brand and the English fallback", () => {
    const portuguese = load("pt");
    const t = createTranslator({
      locale: "pt",
      messages: portuguese as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "União da Humanidade";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "Aceda ao seu Espaço de Trabalho na plataforma União da Humanidade.");
    assert.doesNotMatch(login, /\{siteName\}|da União da/);
    const petition = t(
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      { siteName },
    );
    assert.match(petition, /Assinar esta Petição/);
    assert.match(petition, /petição juridicamente vinculativa/);
    assert.match(petition, /obrigação legal ou governamental/);
    assert.doesNotMatch(petition, /Participante|\{siteName\}/);
    const shipped = t("notifications.types.member_badge_shipped.message", { siteName });
    assert.equal(
      shipped,
      "O seu item oficial de Membro na plataforma União da Humanidade foi expedido.",
    );
    assert.doesNotMatch(shipped, /\bpedido\b|solicitação/);
    const assistant = t("initiativeExperience.author.sidebar.assistantTitle", { siteName });
    assert.equal(assistant, "Assistente da plataforma União da Humanidade");
    assert.equal(t("pwa.searchLabel", { siteName }), "Pesquisar na plataforma União da Humanidade");
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /^Leve a Humanidade/);
    assert.match(lead, /Assistente da plataforma União da Humanidade/);
    assert.doesNotMatch(lead, /Humanity|\{siteName\}/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /União da Humanidade/);
    assert.match(consent, /Política de Privacidade/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.match(platform, /plataforma União da Humanidade/);
    assert.doesNotMatch(platform, /\{siteName\}|<platform>/);
    const helper = t("workspace.publishingPage.editor.seo.huShareHelper", { siteName });
    assert.match(helper, /não publica automaticamente/);
    assert.match(helper, /integração real com o provedor/);
    assert.match(helper, /nunca contornam/);
    assert.doesNotMatch(helper, /\{siteName\}/);
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "Aceda ao seu Espaço de Trabalho na plataforma Humanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}|da Humanity/);
  });

  it("renders Arabic platform grammar for the published brand and the English fallback", () => {
    const arabic = load("ar");
    const t = createTranslator({
      locale: "ar",
      messages: arabic as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "اتحاد الإنسانية";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "ادخل إلى مساحة العمل الخاصة بك على منصة اتحاد الإنسانية.");
    assert.doesNotMatch(login, /\{siteName\}/);
    const petition = t(
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      { siteName },
    );
    assert.match(petition, /هذه العريضة/);
    assert.match(petition, /عريضة ملزمة قانوناً/);
    assert.match(petition, /التزام قانوني أو حكومي/);
    assert.doesNotMatch(petition, /التماس|\{siteName\}/);
    const shipped = t("notifications.types.member_badge_shipped.message", { siteName });
    assert.equal(shipped, "تم شحن الغرض الرسمي للعضو على منصة اتحاد الإنسانية.");
    assert.doesNotMatch(shipped, /طلب/);
    const copies = t("preferences.notification.copiesHelp", { siteName });
    assert.match(copies, /قد ترسل منصة اتحاد الإنسانية/);
    assert.match(copies, /لا يُضمن لكل حدث/);
    assert.match(copies, /حفظ التفضيلات لا يعني/);
    assert.doesNotMatch(copies, /\{siteName\}/);
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /^اصطحب الإنسانية/);
    assert.match(lead, /مساعد اتحاد الإنسانية/);
    assert.doesNotMatch(lead, /Humanity|\{siteName\}/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /تعالج منصة اتحاد الإنسانية/);
    assert.match(consent, /سياسة الخصوصية/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.match(platform, /منصة اتحاد الإنسانية/);
    assert.doesNotMatch(platform, /\{siteName\}|<platform>/);
    const helper = t("workspace.publishingPage.editor.seo.huShareHelper", { siteName });
    assert.match(helper, /بتوزيع/);
    assert.match(helper, /تكاملاً حقيقياً مع المزوّد/);
    assert.doesNotMatch(helper, /\{siteName\}|ل\{siteName\}/);
    assert.equal(t("pwa.searchLabel", { siteName }), "البحث في منصة اتحاد الإنسانية");
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "ادخل إلى مساحة العمل الخاصة بك على منصة Humanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}|على Humanity|في Humanity|لHumanity/);
  });

  it("renders Traditional Chinese platform grammar for the published brand and the English fallback", () => {
    const traditionalChinese = load("zh-Hant");
    const t = createTranslator({
      locale: "zh-Hant",
      messages: traditionalChinese as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "人類聯盟";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "存取您的 人類聯盟 工作區。");
    assert.doesNotMatch(login, /\{siteName\}/);
    const petition = t(
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      { siteName },
    );
    assert.match(petition, /簽署此請願/);
    assert.match(petition, /不具法律約束力/);
    assert.match(petition, /不會產生任何法律或政府義務/);
    assert.doesNotMatch(petition, /\{siteName\}|參與者/);
    const shipped = t("notifications.types.member_badge_shipped.message", { siteName });
    assert.equal(shipped, "您的 人類聯盟 正式會員物品已寄出。");
    assert.doesNotMatch(shipped, /申請|請求/);
    const copies = t("preferences.notification.copiesHelp", { siteName });
    assert.match(copies, /人類聯盟/);
    assert.match(copies, /不保證每一事件都會送達/);
    assert.match(copies, /並不代表已經寄出郵件/);
    assert.doesNotMatch(copies, /\{siteName\}/);
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /^把人性帶在身邊/);
    assert.match(lead, /人類聯盟 助理/);
    assert.doesNotMatch(lead, /Humanity|\{siteName\}|隨身攜帶人類/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /人類聯盟/);
    assert.match(consent, /隱私權政策/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.match(platform, /人類聯盟 平台/);
    assert.doesNotMatch(platform, /\{siteName\}|<platform>/);
    assert.equal(t("pwa.searchLabel", { siteName }), "在 人類聯盟 平台內搜尋");
    const helper = t("workspace.publishingPage.editor.seo.huShareHelper", { siteName });
    assert.match(helper, /並不會自動發布/);
    assert.match(helper, /真實的服務整合/);
    assert.doesNotMatch(helper, /\{siteName\}/);
    const english = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(english, "存取您的 Humanity Union 工作區。");
    assert.doesNotMatch(english, /\{siteName\}/);
    assert.equal(
      t("initiativeExperience.civicArchivePublic.pageTitle", { siteName: "Humanity Union" }),
      "Humanity Union 公共公民檔案",
    );
  });

  it("renders Ukrainian platform grammar for the published brand and the English fallback", () => {
    const ukrainian = load("uk");
    const t = createTranslator({
      locale: "uk",
      messages: ukrainian as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "Союз Людяності";
    const disclaimer = t("initiativeExperience.author.archive.document.disclaimer", { siteName });
    assert.equal(
      disclaimer,
      "Цей документ фіксує громадянську участь і діяльність у межах Ініціативи на платформі Союз Людяності. Він не є офіційним державним або юридично обов'язковим записом, якщо його окремо не визнано відповідною установою.",
    );
    assert.doesNotMatch(disclaimer, /\{siteName\}|активність Ініціатива/);
    const email = t("preferences.notification.emailHelp", { siteName });
    assert.match(email, /платформа Союз Людяності/);
    assert.match(email, /У вашому Робочому просторі є 3 нові сповіщення/);
    assert.match(email, /приватних розмов/);
    assert.match(email, /конфіденційної інформації про Ініціативи/);
    assert.doesNotMatch(email, /\{siteName\}|Робочий простір|про Ініціатива(?!и)/);
    const confirmed = t("notifications.types.member_badge_contribution_confirmed.message", { siteName });
    assert.equal(
      confirmed,
      "Вашу заявку на отримання офіційного предмета Члена Союзу на платформі Союз Людяності підтверджено.",
    );
    const delivered = t("notifications.types.member_badge_delivered.message", { siteName });
    assert.equal(
      delivered,
      "Ваш офіційний предмет Члена Союзу на платформі Союз Людяності доставлено.",
    );
    const shipped = t("notifications.types.member_badge_shipped.message", { siteName });
    assert.equal(
      shipped,
      "Ваш офіційний предмет Члена Союзу на платформі Союз Людяності відправлено.",
    );
    for (const rendered of [confirmed, delivered, shipped]) {
      assert.doesNotMatch(rendered, /\{siteName\}|Учасник|Член платформи/);
    }
    assert.doesNotMatch(delivered, /заявк|запит/);
    assert.doesNotMatch(shipped, /заявк|запит/);
    const lede = t("workspace.publishingPage.editor.seo.lede", { siteName });
    assert.match(lede, /черги вихідних повідомлень для офіційних каналів платформи Союз Людяності/);
    assert.match(lede, /не вигадує зовнішніх облікових даних/);
    assert.match(lede, /не повідомляє про успішне надсилання/);
    assert.doesNotMatch(lede, /\{siteName\}|платформи платформи/);
    const fallback = t("notifications.types.member_badge_shipped.message", { siteName: "Humanity Union" });
    assert.equal(
      fallback,
      "Ваш офіційний предмет Члена Союзу на платформі Humanity Union відправлено.",
    );
    assert.doesNotMatch(fallback, /\{siteName\}|Союз Людяності/);
    const englishDisclaimer = t("initiativeExperience.author.archive.document.disclaimer", {
      siteName: "Humanity Union",
    });
    assert.match(englishDisclaimer, /на платформі Humanity Union/);
    assert.doesNotMatch(englishDisclaimer, /\{siteName\}/);
    const faq = t("membershipPublic.faq.items.what-is-member.question", { siteName });
    assert.equal(faq, "Хто такий Член Союзу на платформі Союз Людяності?");
    assert.doesNotMatch(faq, /\{siteName\}|Член платформи|Учасник/);
    assert.equal(
      t("membershipPublic.faq.items.what-is-member.question", { siteName: "Humanity Union" }),
      "Хто такий Член Союзу на платформі Humanity Union?",
    );
  });

  it("packages the same corrected deletion intro as the WEB catalog", () => {
    for (const locale of LOCALES) {
      const web = get(load(locale), "auth.deleteAccountIntro");
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      assert.equal(get(packaged, "auth.deleteAccountIntro"), web, locale);
    }
  });
});
