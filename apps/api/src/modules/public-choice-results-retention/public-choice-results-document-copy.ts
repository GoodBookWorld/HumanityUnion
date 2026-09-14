/**
 * Pack 02G Task 08G — plain locale→string maps for Public Choice Results PDF chrome.
 * No next-intl. Defaults to English. Same Helvetica/WinAnsi glyph limits as Archive PDF.
 */

import { PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER } from "@hu/types";

export type PublicChoiceResultsCopyLocale = "en" | "uk" | "zh-Hant" | "ar";

export interface PublicChoiceResultsPdfCopy {
  readonly brand: string;
  readonly finalResults: string;
  readonly geographyLabel: string;
  readonly votingClosedLabel: string;
  readonly totalEffectiveVotersLabel: string;
  readonly initiativeUrlLabel: string;
  readonly downloadedLabel: string;
  readonly candidateRanking: string;
  readonly tieSuffix: string;
  readonly votesWord: string;
  readonly abstainLabel: string;
  readonly participation: string;
  readonly totalVotersLabel: string;
  readonly visitorsLabel: string;
  readonly participantsLabel: string;
  readonly membersLabel: string;
  readonly supportOppose: string;
  readonly supportLabel: string;
  readonly doNotSupportLabel: string;
  readonly totalLabel: string;
  readonly disclaimerTitle: string;
  readonly disclaimer: string;
}

const COPY: Record<PublicChoiceResultsCopyLocale, PublicChoiceResultsPdfCopy> = {
  en: {
    brand: "Humanity Union",
    finalResults: "FINAL RESULTS",
    geographyLabel: "Geography",
    votingClosedLabel: "Voting closed",
    totalEffectiveVotersLabel: "Total effective voters",
    initiativeUrlLabel: "Initiative URL",
    downloadedLabel: "Downloaded",
    candidateRanking: "Candidate ranking",
    tieSuffix: " (tie)",
    votesWord: "votes",
    abstainLabel: "Abstain",
    participation: "Participation",
    totalVotersLabel: "Total voters",
    visitorsLabel: "Visitors",
    participantsLabel: "Participants",
    membersLabel: "Members",
    supportOppose: "Support / Oppose",
    supportLabel: "Support",
    doNotSupportLabel: "Do not support",
    totalLabel: "Total",
    disclaimerTitle: "Community voting results",
    disclaimer: PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER,
  },
  uk: {
    brand: "Humanity Union",
    finalResults: "ПІДСУМКОВІ РЕЗУЛЬТАТИ",
    geographyLabel: "Географія",
    votingClosedLabel: "Голосування закрито",
    totalEffectiveVotersLabel: "Усього ефективних виборців",
    initiativeUrlLabel: "URL ініціативи",
    downloadedLabel: "Завантажено",
    candidateRanking: "Рейтинг кандидатів",
    tieSuffix: " (нічия)",
    votesWord: "голосів",
    abstainLabel: "Утриматися",
    participation: "Участь",
    totalVotersLabel: "Усього виборців",
    visitorsLabel: "Відвідувачі",
    participantsLabel: "Учасники",
    membersLabel: "Члени",
    supportOppose: "Підтримка / Проти",
    supportLabel: "Підтримка",
    doNotSupportLabel: "Не підтримую",
    totalLabel: "Усього",
    disclaimerTitle: "Результати голосування спільноти",
    disclaimer:
      "Це результати голосування спільноти Humanity Union. Вони не є офіційними результатами виборів, статистично репрезентативним опитуванням чи сертифікованими урядом результатами.",
  },
  "zh-Hant": {
    brand: "Humanity Union",
    finalResults: "最終結果",
    geographyLabel: "地理範圍",
    votingClosedLabel: "投票已結束",
    totalEffectiveVotersLabel: "有效投票總數",
    initiativeUrlLabel: "倡議網址",
    downloadedLabel: "下載時間",
    candidateRanking: "候選人排名",
    tieSuffix: "（平手）",
    votesWord: "票",
    abstainLabel: "棄權",
    participation: "參與",
    totalVotersLabel: "投票總數",
    visitorsLabel: "訪客",
    participantsLabel: "參與者",
    membersLabel: "會員",
    supportOppose: "支持／反對",
    supportLabel: "支持",
    doNotSupportLabel: "不支持",
    totalLabel: "總計",
    disclaimerTitle: "社群投票結果",
    disclaimer:
      "這些是 Humanity Union 社群投票結果。它們不是官方選舉結果、具統計代表性的民調，或經政府認證的結果。",
  },
  ar: {
    brand: "Humanity Union",
    finalResults: "النتائج النهائية",
    geographyLabel: "الجغرافيا",
    votingClosedLabel: "أُغلق التصويت",
    totalEffectiveVotersLabel: "إجمالي الناخبين الفعليين",
    initiativeUrlLabel: "رابط المبادرة",
    downloadedLabel: "تاريخ التنزيل",
    candidateRanking: "ترتيب المرشحين",
    tieSuffix: " (تعادل)",
    votesWord: "أصوات",
    abstainLabel: "امتناع",
    participation: "المشاركة",
    totalVotersLabel: "إجمالي الناخبين",
    visitorsLabel: "الزوار",
    participantsLabel: "المشاركون",
    membersLabel: "الأعضاء",
    supportOppose: "تأييد / معارضة",
    supportLabel: "تأييد",
    doNotSupportLabel: "لا أؤيد",
    totalLabel: "الإجمالي",
    disclaimerTitle: "نتائج تصويت المجتمع",
    disclaimer:
      "هذه نتائج تصويت مجتمع Humanity Union. وهي ليست نتائج انتخابات رسمية ولا استطلاعات ممثلة إحصائياً ولا نتائج معتمدة من الحكومة.",
  },
};

export function resolvePublicChoiceResultsCopyLocale(
  locale: string | null | undefined,
): PublicChoiceResultsCopyLocale {
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

export function getPublicChoiceResultsPdfCopy(
  locale: string | null | undefined,
): PublicChoiceResultsPdfCopy {
  return COPY[resolvePublicChoiceResultsCopyLocale(locale)];
}
