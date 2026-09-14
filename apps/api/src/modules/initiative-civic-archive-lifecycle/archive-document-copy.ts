/**
 * Pack 02G Task 08G — plain locale→string maps for Civic Archive PDF chrome.
 * No next-intl. Defaults to English. Helvetica/WinAnsi cannot render full
 * Arabic RTL or CJK glyphs — non-Latin locales may show missing characters.
 */

import type { InitiativeCivicArchiveSectionId } from "@hu/types";
import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

export type ArchiveDocumentCopyLocale = "en" | "uk" | "zh-Hant" | "ar";

export interface ArchiveDocumentPdfCopy {
  readonly untitledArchive: string;
  readonly archiveVersion: (version: number) => string;
  readonly draftPreview: string;
  readonly publishedLabel: string;
  readonly notPublished: string;
  readonly initiativeLabel: string;
  readonly stewardLabel: string;
  readonly publicUrlLabel: string;
  readonly draftWatermark: string;
  readonly tableOfContents: string;
  readonly lifecycleTimeline: string;
  readonly finalSummary: string;
  readonly emptySection: string;
  readonly sourcesLabel: string;
  readonly sourcesAndCitations: string;
  readonly noCitations: string;
  readonly disclaimer: string;
  readonly sectionTitles: Readonly<Record<InitiativeCivicArchiveSectionId, string>>;
}

const SECTION_TITLES_EN: Record<InitiativeCivicArchiveSectionId, string> = {
  archive_overview: "Archive Overview",
  original_initiative: "Original Initiative",
  discussion_and_participation: "Discussion and Participation",
  collaborative_analysis: "Collaborative Analysis",
  improvement_proposals: "Improvement Proposals",
  revision_and_change_history: "Version / revision history",
  petition_and_public_participation: "Petition and Public Participation",
  decision_session: "Decision Session",
  collective_decision: "Collective Decision",
  approved_actions: "Approved Actions",
  implementation_commitments: "Implementation Commitments",
  implementation_tracking: "Implementation Tracking",
  official_responses: "Official Responses",
  public_impact: "Public Impact",
  final_results: "Final Results",
  outstanding_work: "Outstanding Work",
  lessons_learned: "Lessons Learned",
  knowledge_contribution: "Knowledge Contribution",
  lifecycle_timeline: "Lifecycle Timeline",
  sources_and_traceability: "Sources and Traceability",
};

const SECTION_TITLES_UK: Record<InitiativeCivicArchiveSectionId, string> = {
  archive_overview: "Огляд архіву",
  original_initiative: "Оригінальна ініціатива",
  discussion_and_participation: "Обговорення та участь",
  collaborative_analysis: "Спільний аналіз",
  improvement_proposals: "Пропозиції щодо покращення",
  revision_and_change_history: "Історія версій / ревізій",
  petition_and_public_participation: "Петиція та громадська участь",
  decision_session: "Сесія рішення",
  collective_decision: "Колективне рішення",
  approved_actions: "Схвалені дії",
  implementation_commitments: "Зобов’язання з реалізації",
  implementation_tracking: "Супровід реалізації",
  official_responses: "Офіційні відповіді",
  public_impact: "Громадський вплив",
  final_results: "Підсумкові результати",
  outstanding_work: "Незавершена робота",
  lessons_learned: "Набутий досвід",
  knowledge_contribution: "Внесок у знання",
  lifecycle_timeline: "Хронологія життєвого циклу",
  sources_and_traceability: "Джерела та простежуваність",
};

const SECTION_TITLES_ZH: Record<InitiativeCivicArchiveSectionId, string> = {
  archive_overview: "典藏總覽",
  original_initiative: "原始倡議",
  discussion_and_participation: "討論與參與",
  collaborative_analysis: "協作分析",
  improvement_proposals: "改進提案",
  revision_and_change_history: "版本／修訂歷史",
  petition_and_public_participation: "請願與公眾參與",
  decision_session: "決策會議",
  collective_decision: "集體決策",
  approved_actions: "已核准行動",
  implementation_commitments: "執行承諾",
  implementation_tracking: "執行追蹤",
  official_responses: "官方回應",
  public_impact: "公共影響",
  final_results: "最終結果",
  outstanding_work: "未完成工作",
  lessons_learned: "經驗教訓",
  knowledge_contribution: "知識貢獻",
  lifecycle_timeline: "生命週期時間軸",
  sources_and_traceability: "來源與可追溯性",
};

const SECTION_TITLES_AR: Record<InitiativeCivicArchiveSectionId, string> = {
  archive_overview: "نظرة عامة على الأرشيف",
  original_initiative: "المبادرة الأصلية",
  discussion_and_participation: "النقاش والمشاركة",
  collaborative_analysis: "التحليل التعاوني",
  improvement_proposals: "مقترحات التحسين",
  revision_and_change_history: "تاريخ الإصدارات / المراجعات",
  petition_and_public_participation: "العريضة والمشاركة العامة",
  decision_session: "جلسة القرار",
  collective_decision: "القرار الجماعي",
  approved_actions: "الإجراءات المعتمدة",
  implementation_commitments: "التزامات التنفيذ",
  implementation_tracking: "متابعة التنفيذ",
  official_responses: "الردود الرسمية",
  public_impact: "الأثر العام",
  final_results: "النتائج النهائية",
  outstanding_work: "العمل المتبقي",
  lessons_learned: "الدروس المستفادة",
  knowledge_contribution: "المساهمة المعرفية",
  lifecycle_timeline: "الجدول الزمني لدورة الحياة",
  sources_and_traceability: "المصادر وإمكانية التتبع",
};

const COPY: Record<ArchiveDocumentCopyLocale, ArchiveDocumentPdfCopy> = {
  en: {
    untitledArchive: "Civic Archive",
    archiveVersion: (version) => `Archive Version ${version}`,
    draftPreview: "Draft Preview",
    publishedLabel: "Published",
    notPublished: "Not published",
    initiativeLabel: "Initiative",
    stewardLabel: "Steward",
    publicUrlLabel: "Public URL",
    draftWatermark: "Draft Preview — Not Published",
    tableOfContents: "Table of Contents",
    lifecycleTimeline: "Lifecycle Timeline",
    finalSummary: "Final Summary",
    emptySection: "(No content recorded for this section.)",
    sourcesLabel: "Sources",
    sourcesAndCitations: "Sources and Citations",
    noCitations: "No citations recorded.",
    disclaimer: INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
    sectionTitles: SECTION_TITLES_EN,
  },
  uk: {
    untitledArchive: "Громадянський архів",
    archiveVersion: (version) => `Версія архіву ${version}`,
    draftPreview: "Попередній перегляд чернетки",
    publishedLabel: "Опубліковано",
    notPublished: "Не опубліковано",
    initiativeLabel: "Ініціатива",
    stewardLabel: "Стюард",
    publicUrlLabel: "Публічна URL-адреса",
    draftWatermark: "Попередній перегляд чернетки — не опубліковано",
    tableOfContents: "Зміст",
    lifecycleTimeline: "Хронологія життєвого циклу",
    finalSummary: "Підсумковий опис",
    emptySection: "(Для цього розділу не записано вмісту.)",
    sourcesLabel: "Джерела",
    sourcesAndCitations: "Джерела та цитати",
    noCitations: "Цитат не записано.",
    disclaimer:
      "Цей документ фіксує громадянську участь і діяльність Ініціативи на платформі Humanity Union. Він не є офіційним урядовим чи юридично зобов’язувальним записом, якщо його окремо не визнала відповідна установа.",
    sectionTitles: SECTION_TITLES_UK,
  },
  "zh-Hant": {
    untitledArchive: "公民典藏",
    archiveVersion: (version) => `典藏版本 ${version}`,
    draftPreview: "草稿預覽",
    publishedLabel: "已發布",
    notPublished: "尚未發布",
    initiativeLabel: "倡議",
    stewardLabel: "管理人",
    publicUrlLabel: "公開網址",
    draftWatermark: "草稿預覽 — 尚未發布",
    tableOfContents: "目錄",
    lifecycleTimeline: "生命週期時間軸",
    finalSummary: "最終摘要",
    emptySection: "（本節尚無內容紀錄。）",
    sourcesLabel: "來源",
    sourcesAndCitations: "來源與引用",
    noCitations: "尚無引用紀錄。",
    disclaimer:
      "本文件記錄 Humanity Union 平台上的公民參與與倡議活動。除非經相關機構獨立認可，否則它不是官方政府文件或具法律約束力的紀錄。",
    sectionTitles: SECTION_TITLES_ZH,
  },
  ar: {
    untitledArchive: "الأرشيف المدني",
    archiveVersion: (version) => `إصدار الأرشيف ${version}`,
    draftPreview: "معاينة المسودة",
    publishedLabel: "نُشر",
    notPublished: "غير منشور",
    initiativeLabel: "المبادرة",
    stewardLabel: "الوصي",
    publicUrlLabel: "الرابط العام",
    draftWatermark: "معاينة المسودة — غير منشورة",
    tableOfContents: "جدول المحتويات",
    lifecycleTimeline: "الجدول الزمني لدورة الحياة",
    finalSummary: "الملخص النهائي",
    emptySection: "(لا يوجد محتوى مسجّل لهذا القسم.)",
    sourcesLabel: "المصادر",
    sourcesAndCitations: "المصادر والاستشهادات",
    noCitations: "لا توجد استشهادات مسجّلة.",
    disclaimer:
      "تسجّل هذه الوثيقة المشاركة المدنية ونشاط المبادرة على منصة Humanity Union. وهي ليست سجلاً حكومياً رسمياً أو ملزماً قانونياً ما لم تعترف بها المؤسسة المعنية بشكل مستقل.",
    sectionTitles: SECTION_TITLES_AR,
  },
};

export function resolveArchiveDocumentCopyLocale(
  locale: string | null | undefined,
): ArchiveDocumentCopyLocale {
  const trimmed = typeof locale === "string" ? locale.trim() : "";
  if (trimmed === "uk" || trimmed === "uk-UA") {
    return "uk";
  }
  if (trimmed === "zh-Hant" || trimmed.toLowerCase() === "zh-hant") {
    return "zh-Hant";
  }
  if (trimmed === "ar" || trimmed.startsWith("ar-")) {
    return "ar";
  }
  return "en";
}

export function getArchiveDocumentPdfCopy(
  locale: string | null | undefined,
): ArchiveDocumentPdfCopy {
  return COPY[resolveArchiveDocumentCopyLocale(locale)];
}

export function resolveArchivePdfSectionTitle(
  sectionId: string,
  fallbackTitle: string,
  copy: ArchiveDocumentPdfCopy,
): string {
  if (Object.prototype.hasOwnProperty.call(copy.sectionTitles, sectionId)) {
    return copy.sectionTitles[sectionId as InitiativeCivicArchiveSectionId];
  }
  return fallbackTitle || sectionId;
}
