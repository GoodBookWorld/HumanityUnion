export const TRUSTED_MEDIA_CATEGORY_LABELS: Record<string, string> = {
  "international-wire-service": "International Wire Service",
  "public-broadcaster": "Public Broadcaster",
  "independent-investigative": "Independent Investigative",
  "regional-public-media": "Regional Public Media",
  "scientific-publisher": "Scientific Publisher",
  "academic-resource": "Academic Resource",
};

export const TRUSTED_MEDIA_CATEGORY_ICONS: Record<string, string> = {
  "international-wire-service": "🌐",
  "public-broadcaster": "📡",
  "independent-investigative": "🔍",
  "regional-public-media": "🗺",
  "scientific-publisher": "🧪",
  "academic-resource": "📚",
};

export const PRINCIPLE_WHY_IT_MATTERS: Record<string, string> = {
  "editorial-transparency": "Readers can evaluate possible bias before trusting a report.",
  "correction-policy": "Mistakes can be identified and corrected with public accountability.",
  "professional-standards": "Reporting follows recognized journalistic or academic review practices.",
  "evidence-based": "Claims can be traced to verifiable documentation or primary sources.",
  "international-recognition": "Standards remain consistent across regions and languages.",
  "fact-checking-practice": "Verification workflows support independent claim review.",
};

export function coverageToChips(coverage: string): string[] {
  return coverage
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}
