import { article } from "../article-factory.js";

export const GETTING_STARTED_ARTICLES = [
  article({
    slug: "what-is-humanity-union",
    categoryId: "getting-started",
    title: "What is Humanity Union?",
    purpose: "What is Humanity Union and what problem does it address?",
    overview:
      "Humanity Union is a civic technology platform for structured, transparent participation. It helps communities move from shared concern to documented civic action — without replacing institutions.",
    diagramId: "platform-overview",
    explanation: [
      {
        id: "role",
        heading: "Platform role",
        body: "Humanity Union provides workspace tools, public civic records, and educational reference material. It documents processes; it does not decide outcomes for participants.",
      },
      {
        id: "audience",
        heading: "Who it serves",
        body: "Participants, guests, researchers, journalists, and future institutional partners can all read public records and learn how civic workflows operate.",
      },
    ],
    keyConcepts: ["Civic participation", "Transparency", "Reference records"],
    relatedConceptSlugs: ["platform-overview", "core-principles", "how-humanity-union-works"],
    relatedGuideSlugs: [],
    relatedPublicPageHrefs: [{ title: "Home", href: "/" }],
    readingTimeMinutes: 3,
    searchTerms: ["humanity union", "platform", "civic", "introduction"],
    assistantTags: ["platform", "introduction"],
    sortOrder: 1,
  }),
  article({
    slug: "platform-overview",
    categoryId: "getting-started",
    title: "Platform Overview",
    purpose: "How are the main parts of the platform organized?",
    overview:
      "The platform has three public-facing layers: Knowledge Center (education), Public Experience (published civic records), and participant Workspace (private civic work).",
    diagramId: "platform-overview",
    explanation: [
      {
        id: "knowledge",
        heading: "Knowledge Center",
        body: "Authoritative explanations of concepts, processes, and terminology. This is where you learn before participating.",
      },
      {
        id: "public",
        heading: "Public Experience",
        body: "Published initiatives, decisions, deliveries, and archives. Anyone can browse without signing in.",
      },
      {
        id: "workspace",
        heading: "Workspace",
        body: "Authenticated participants draft initiatives, collaborate, vote, and track implementation.",
      },
    ],
    keyConcepts: ["Knowledge Center", "Public Experience", "Workspace"],
    relatedConceptSlugs: ["what-is-humanity-union", "workspace", "global-search"],
    relatedGuideSlugs: ["create-your-first-initiative"],
    relatedWorkspaceSection: "Workspace Home",
    relatedPublicPageHrefs: [
      { title: "Initiatives", href: "/initiatives" },
      { title: "Search", href: "/search" },
    ],
    readingTimeMinutes: 4,
    searchTerms: ["overview", "architecture", "workspace", "public"],
    assistantTags: ["platform", "overview"],
    sortOrder: 2,
  }),
  article({
    slug: "core-principles",
    categoryId: "getting-started",
    title: "Core Principles",
    purpose: "What principles guide Humanity Union design?",
    overview:
      "Humanity Union is built on clarity, neutrality, transparency, and participant responsibility. Knowledge explains; it never persuades.",
    diagramId: "reference-architecture",
    explanation: [
      {
        id: "explain",
        heading: "Knowledge explains",
        body: "Educational content describes how processes work. It does not advocate positions or predict outcomes.",
      },
      {
        id: "neutral",
        heading: "Political neutrality",
        body: "Platform language stays descriptive. Civic merit is evaluated by participants through governed processes, not by the platform.",
      },
      {
        id: "records",
        heading: "Records over rhetoric",
        body: "Published civic records are the durable source of civic memory. Public pages reference those records.",
      },
    ],
    keyConcepts: ["Neutrality", "Transparency", "Participant responsibility"],
    relatedConceptSlugs: ["constitutional-principles", "open-civic-processes"],
    relatedGuideSlugs: [],
    relatedPublicPageHrefs: [],
    readingTimeMinutes: 3,
    searchTerms: ["principles", "neutrality", "transparency"],
    assistantTags: ["principles"],
    sortOrder: 3,
  }),
  article({
    slug: "how-humanity-union-works",
    categoryId: "getting-started",
    title: "How Humanity Union Works",
    purpose: "What is the basic flow from concern to civic record?",
    overview:
      "A participant declares an initiative, collaborates through analysis and proposals, opens collective decisions, and may deliver civic action packages to institutions. Outcomes are tracked and archived publicly.",
    diagramId: "civic-pipeline",
    explanation: [
      {
        id: "start",
        heading: "Start with an initiative",
        body: "An initiative frames a civic question or proposed action within a participation area.",
      },
      {
        id: "pipeline",
        heading: "Follow the civic pipeline",
        body: "Analysis, proposals, revisions, decision sessions, collective decisions, and implementation stages build a documented trail.",
      },
      {
        id: "public",
        heading: "Publish and archive",
        body: "Published records appear in Public Experience. Completed work may enter the Public Civic Archive.",
      },
    ],
    keyConcepts: ["Initiative", "Civic pipeline", "Public record"],
    relatedConceptSlugs: ["capability02-civic-pipeline", "what-is-an-initiative"],
    relatedGuideSlugs: ["create-your-first-initiative"],
    relatedWorkspaceSection: "Initiatives",
    relatedPublicPageHrefs: [{ title: "Initiatives", href: "/initiatives" }],
    readingTimeMinutes: 4,
    searchTerms: ["how it works", "flow", "pipeline", "process"],
    assistantTags: ["pipeline", "overview"],
    sortOrder: 4,
  }),
];
