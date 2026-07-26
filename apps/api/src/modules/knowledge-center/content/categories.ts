import type { KnowledgeCategory } from "@hu/types";

export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Introduction to Humanity Union, its principles, and how the platform works.",
    sortOrder: 1,
  },
  {
    id: "explanations",
    title: "Explanations",
    description:
      "Concise explanations of platform concepts and civic processes (2–5 minute reads).",
    sortOrder: 2,
  },
  {
    id: "institutions-experience",
    title: "Institutions Experience",
    description:
      "How Humanity Union interacts with existing institutions — educational overview only.",
    sortOrder: 3,
  },
  {
    id: "guides",
    title: "Guides",
    description: "Step-by-step tutorials for common participant tasks.",
    sortOrder: 4,
  },
  {
    id: "constitution",
    title: "Constitution",
    description: "Constitutional and governance principles that shape the platform.",
    sortOrder: 5,
  },
  {
    id: "glossary",
    title: "Glossary",
    description: "Alphabetical definitions of platform terminology.",
    sortOrder: 6,
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Short answers to common questions.",
    sortOrder: 7,
  },
] as const;
