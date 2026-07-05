import type { CivicReferenceFrameworkEntry } from "@hu/types";

/** Extensible civic reference framework catalog. */
export const CIVIC_REFERENCE_FRAMEWORK: CivicReferenceFrameworkEntry[] = [
  {
    frameworkId: "hu-constitution-article-i",
    frameworkType: "constitution",
    title: "Human Dignity",
    referenceCode: "HU-Constitution-Article-I",
    excerpt:
      "Every human being possesses inherent dignity and equal worth. No person shall ever be treated merely as a source of data, attention, influence, or commercial value.",
    sourceLabel: "Humanity Union Constitution",
  },
  {
    frameworkId: "hu-constitution-article-ii",
    frameworkType: "constitution",
    title: "Knowledge Before Action",
    referenceCode: "HU-Constitution-Article-II",
    excerpt:
      "Meaningful action begins with understanding. Humanity Union promotes verified knowledge, critical thinking, open dialogue, and lifelong learning.",
    sourceLabel: "Humanity Union Constitution",
  },
  {
    frameworkId: "hu-constitution-article-iii",
    frameworkType: "constitution",
    title: "Freedom with Understanding",
    referenceCode: "HU-Constitution-Article-III",
    excerpt:
      "The platform guides. It never coerces. Humanity Union respects every person's freedom to make their own choices.",
    sourceLabel: "Humanity Union Constitution",
  },
  {
    frameworkId: "hu-constitution-article-vii",
    frameworkType: "constitution",
    title: "Transparency and Trust",
    referenceCode: "HU-Constitution-Article-VII",
    excerpt:
      "Trust is earned through openness. Processes, decisions, and reasoning should remain visible whenever possible.",
    sourceLabel: "Humanity Union Constitution",
  },
  {
    frameworkId: "hu-principle-evidence",
    frameworkType: "principles",
    title: "Evidence Before Opinions",
    referenceCode: "HU-Principle-Evidence",
    excerpt:
      "Collective intelligence work should ground proposals in evidence, sources, and verifiable reasoning.",
    sourceLabel: "Humanity Union Principles",
  },
  {
    frameworkId: "hu-principle-improvement",
    frameworkType: "principles",
    title: "Improvement Before Decisions",
    referenceCode: "HU-Principle-Improvement",
    excerpt:
      "Initiatives should be refined through collaborative analysis and improvement proposals before public decisions.",
    sourceLabel: "Humanity Union Principles",
  },
  {
    frameworkId: "hu-principle-transparency",
    frameworkType: "principles",
    title: "Transparency Before Authority",
    referenceCode: "HU-Principle-Transparency",
    excerpt:
      "Authority in civic processes should remain accountable through visible reasoning and public records.",
    sourceLabel: "Humanity Union Principles",
  },
  {
    frameworkId: "udhr-article-1",
    frameworkType: "human_rights",
    title: "Inherent Dignity and Equal Rights",
    referenceCode: "UDHR-Article-1",
    excerpt: "All human beings are born free and equal in dignity and rights.",
    sourceLabel: "Universal Declaration of Human Rights",
  },
  {
    frameworkId: "udhr-article-2",
    frameworkType: "human_rights",
    title: "Non-Discrimination",
    referenceCode: "UDHR-Article-2",
    excerpt: "Everyone is entitled to all rights and freedoms without distinction of any kind.",
    sourceLabel: "Universal Declaration of Human Rights",
  },
  {
    frameworkId: "udhr-article-19",
    frameworkType: "human_rights",
    title: "Freedom of Expression",
    referenceCode: "UDHR-Article-19",
    excerpt: "Everyone has the right to freedom of opinion and expression.",
    sourceLabel: "Universal Declaration of Human Rights",
  },
  {
    frameworkId: "udhr-article-20",
    frameworkType: "human_rights",
    title: "Peaceful Assembly and Association",
    referenceCode: "UDHR-Article-20",
    excerpt: "Everyone has the right to freedom of peaceful assembly and association.",
    sourceLabel: "Universal Declaration of Human Rights",
  },
];

export function getFrameworkEntry(frameworkId: string): CivicReferenceFrameworkEntry | undefined {
  return CIVIC_REFERENCE_FRAMEWORK.find((entry) => entry.frameworkId === frameworkId);
}

export function getFrameworkEntries(frameworkIds: string[]): CivicReferenceFrameworkEntry[] {
  return frameworkIds
    .map((frameworkId) => getFrameworkEntry(frameworkId))
    .filter((entry): entry is CivicReferenceFrameworkEntry => entry !== undefined);
}
