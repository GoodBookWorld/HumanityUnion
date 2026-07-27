export const PUBLIC_HOME_HERO = {
  headline: "Bringing people together to create positive change.",
  subheadline:
    "A civic platform that empowers people with practical tools for social growth, justice, security, and progress.",
  primaryCta: { label: "Create Initiative", href: "/workspace/initiatives#create" },
  secondaryCta: { label: "Explore Knowledge", href: "/knowledge" },
} as const;

export const PUBLIC_HOME_CORE_VALUES = [
  {
    id: "responsibility",
    word: "Responsibility",
    hint: "Act with care for community outcomes.",
    iconSrc: "/icons/workspace/responsibility.svg",
  },
  {
    id: "justice",
    word: "Justice",
    hint: "Pursue fair processes and accountable results.",
    iconSrc: "/icons/workspace/justice.svg",
  },
  {
    id: "security",
    word: "Security",
    hint: "Protect people, data, and civic integrity.",
    iconSrc: "/icons/workspace/security.svg",
  },
  {
    id: "progress",
    word: "Progress",
    hint: "Turn responsible ideas into public results.",
    iconSrc: "/icons/workspace/progress.svg",
  },
] as const;

export const PUBLIC_HOME_OPPORTUNITIES = [
  {
    id: "community",
    title: "Improve your community",
    description: "Identify local needs and propose constructive changes with neighbors.",
  },
  {
    id: "solutions",
    title: "Build solutions together",
    description: "Combine perspectives, evidence, and deliberation before acting.",
  },
  {
    id: "action",
    title: "Turn public concerns into action",
    description: "Move from shared problems to initiatives, decisions, and implementation.",
  },
  {
    id: "preserve",
    title: "Preserve experience for future generations",
    description: "Archive lessons and outcomes so later communities can learn responsibly.",
  },
] as const;

export const PUBLIC_HOME_CIVIC_PIPELINE = [
  {
    id: "problem",
    label: "Problem",
    explanation: "A shared public challenge worth addressing together.",
  },
  {
    id: "initiative",
    label: "Initiative",
    explanation: "A structured proposal to respond constructively.",
  },
  {
    id: "analysis",
    label: "Analysis",
    explanation: "Evidence and perspectives examined collaboratively.",
  },
  { id: "proposal", label: "Proposal", explanation: "A refined plan ready for collective review." },
  {
    id: "decision",
    label: "Decision",
    explanation: "Eligible participants decide through civic process.",
  },
  {
    id: "implementation",
    label: "Implementation",
    explanation: "Approved outcomes move into accountable delivery.",
  },
  { id: "impact", label: "Impact", explanation: "Observed results documented for public review." },
  {
    id: "archive",
    label: "Archive",
    explanation: "Verified knowledge preserved for future reference.",
  },
] as const;

export const PUBLIC_HOME_LATEST_INITIATIVES = {
  title: "Latest Civic Initiatives",
  intro:
    "Explore initiatives addressing challenges of global significance. Use the map or Search to discover civic activity in your country, region, or city.",
} as const;

export const PUBLIC_HOME_LATEST_PUBLIC_IMPACT = {
  title: "Latest Public Impact",
  intro: "Documented outcomes, implementation progress, and measurable civic results.",
} as const;

export const HOME_INITIATIVE_PLACEHOLDER_MAX = 2;
export const HOME_PUBLIC_IMPACT_PLACEHOLDER_MAX = 3;
export const HOME_KNOWLEDGE_COLLECTION_MAX = 12;

export const PUBLIC_HOME_KNOWLEDGE_MUTED_TONES = [
  "pale-blue",
  "pale-amber",
  "pale-green",
  "pale-violet",
  "pale-cyan",
  "pale-rose",
  "pale-sand",
  "pale-slate",
] as const;

export type PublicHomeKnowledgeTone = (typeof PUBLIC_HOME_KNOWLEDGE_MUTED_TONES)[number];

export const PUBLIC_HOME_KNOWLEDGE_ENTRIES = [
  {
    id: "explanations",
    title: "Explanations",
    description: "Short reads on civic concepts and platform processes.",
    actionLabel: "Open explanations",
    href: "/knowledge/what-is-an-initiative",
  },
  {
    id: "guides",
    title: "Guides",
    description: "Step-by-step guidance for common participant tasks.",
    actionLabel: "Open guides",
    href: "/knowledge/create-your-first-initiative",
  },
  {
    id: "constitution",
    title: "Constitution",
    description: "Constitutional and governance principles for civic work.",
    actionLabel: "Read constitution",
    href: "/knowledge/constitutional-principles",
  },
  {
    id: "civic-media",
    title: "Civic Media",
    description: "Navigate verified information and public concern reporting.",
    actionLabel: "Explore Civic Media",
    href: "/media",
  },
  {
    id: "glossary",
    title: "Glossary",
    description: "Definitions for platform terminology and civic records.",
    actionLabel: "Browse glossary",
    href: "/knowledge/cap-glossary",
  },
  {
    id: "institutions",
    title: "Institutions",
    description: "How civic outcomes connect with institutional context.",
    actionLabel: "Visit Institutions",
    href: "/institutions",
  },
  {
    id: "initiative-process",
    title: "Initiative Process",
    description: "How initiatives move through the civic pipeline.",
    actionLabel: "Learn the process",
    href: "/knowledge/capability02-civic-pipeline",
  },
  {
    id: "collective-decisions",
    title: "Collective Decisions",
    description: "How governed decisions are prepared, cast, and published.",
    actionLabel: "Understand decisions",
    href: "/knowledge/collective-decision",
  },
  {
    id: "implementation",
    title: "Implementation",
    description: "How commitments and tracking document civic delivery.",
    actionLabel: "Explore implementation",
    href: "/knowledge/implementation-tracking",
  },
  {
    id: "public-impact",
    title: "Public Impact",
    description: "How observed outcomes are documented for public review.",
    actionLabel: "Learn about impact",
    href: "/knowledge/public-impact",
  },
  {
    id: "civic-archive",
    title: "Civic Archive",
    description: "Preserved civic memory, lessons, and completed work.",
    actionLabel: "Explore Civic Archive",
    href: "/civic-archive",
  },
] as const;

export const PUBLIC_HOME_ECOSYSTEM_STATEMENT = {
  primary:
    "You have entered a civic space where people who share your commitment work together to understand public challenges, unite around solutions, and turn responsible ideas into real public results.",
  supporting: "Every meaningful change begins with people who choose to act responsibly.",
} as const;

export const PUBLIC_HOME_WORLD_MAP_PLACEHOLDER = {
  title: "Interactive World Map",
  description: "Coming soon: explore countries, regions, and communities through civic activity.",
} as const;
