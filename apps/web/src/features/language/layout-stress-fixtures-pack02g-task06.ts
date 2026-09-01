/**
 * Pack 02G Task 06 — deterministic multilingual layout stress fixtures.
 * No live provider / machine translation calls.
 */

export const LAYOUT_STRESS_VIEWPORTS = {
  mobile: 375,
  tablet: 900,
  desktop: 1280,
} as const;

export const LAYOUT_STRESS_FIXTURES = {
  en: {
    locale: "en",
    title: "Community water quality monitoring initiative",
    summary:
      "Residents measure local water quality and publish verified findings for civic follow-up.",
    narrative:
      "The initiative coordinated volunteer sampling, laboratory verification, and public reporting across three neighborhoods.",
    label: "View Original",
    url: "https://example.org/reports/water-quality",
  },
  uk: {
    locale: "uk",
    title:
      "Громадська ініціатива з моніторингу якості питної води та відкритої публікації перевірених результатів для громадянського контролю",
    summary:
      "Мешканці спільно вимірюють якість місцевої питної води, перевіряють лабораторні дані та публікують підтверджені результати для подальших громадських і інституційних дій, щоб посилити підзвітність і захист здоровʼя громади.",
    narrative:
      "Ініціатива організувала волонтерський відбір проб, лабораторну верифікацію та публічну звітність у трьох районах міста, забезпечивши доступні пояснення для мешканців і зрозумілі наступні кроки для місцевої влади.",
    label: "Переглянути оригінал",
    url: "https://example.org/reports/water-quality",
  },
  zhHant: {
    locale: "zh-Hant",
    title: "社區飲用水品質監測與公開驗證結果公民倡議計畫",
    summary:
      "居民共同量測在地飲用水品質並公開經驗證的發現以供後續公民與機構追蹤行動強化公共健康與問責",
    narrative:
      "此倡議協調志工採樣實驗室驗證與跨三個社區的公開報告並提供清楚說明與後續行動建議給居民與地方機關",
    label: "查看原文",
    url: "https://example.org/reports/water-quality",
  },
  ar: {
    locale: "ar",
    dir: "rtl" as const,
    title:
      "مبادرة مجتمعية لرصد جودة مياه الشرب ونشر النتائج المتحقق منها من أجل المتابعة المدنية والمؤسسية",
    summary:
      "يقوم السكان بقياس جودة المياه المحلية ونشر النتائج الموثقة لدعم المتابعة المدنية وحماية الصحة العامة وتعزيز المساءلة في المجتمعات المحلية.",
    narrative:
      "نسّقت المبادرة أخذ العينات التطوعي والتحقق المخبري والتقارير العامة عبر ثلاثة أحياء، مع توضيحات واضحة للسكان وخطوات عملية للسلطات المحلية.",
    label: "عرض النص الأصلي",
    url: "https://example.org/reports/water-quality",
  },
  pathologicalTitle:
    "Pathological-but-valid civic title repeating expansion markers for layout stress " +
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa " +
    "verylongcompoundwordwithoutbreakopportunityfortestingoverflowwrapbehaviorinthetitlecontainer",
  pathologicalSummary:
    "Pathological summary intended to force multi-line growth without escaping its semantic container. " +
    "It repeats civic narrative cues while remaining a single valid human-readable field value for layout contracts.",
  longUnbrokenUrl:
    "https://example.org/civic/archive/records/initiative-implementation-commitment-tracking-official-response-public-impact/reference/abcdefghijklmnopqrstuvwxyz0123456789/path/without/spaces/or/hyphen-breaks/document.pdf?query=very_long_unbroken_token_for_overflow_wrap_anywhere_contract",
} as const;

export type LayoutStressLocaleKey = "en" | "uk" | "zhHant" | "ar";
