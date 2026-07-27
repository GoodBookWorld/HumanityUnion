import type { CivicNominationInstitutionRole } from "@hu/types";

export type InstitutionStatusBadge = "Concept" | "Future Institution" | "Under Development";

export interface InstitutionRecord {
  id: string;
  name: string;
  status: InstitutionStatusBadge;
  purpose: string;
  role: string;
  learnMoreHref: string;
  knowledgeSlug: string;
  knowledgeTitle: string;
  illustrationId: string;
  featured?: boolean;
  nominationRole?: CivicNominationInstitutionRole;
  nonNominationNote?: string;
}

export const INSTITUTION_RECORDS: InstitutionRecord[] = [
  {
    id: "humanity-council",
    name: "Humanity Council",
    status: "Future Institution",
    purpose:
      "Proposed supreme deliberative assembly designed to integrate chamber input and authorize major governance direction within charter rules.",
    role: "Central deliberative body connecting civic decisions to institutional action and long-term platform governance.",
    learnMoreHref: "/knowledge/constitutional-principles",
    knowledgeSlug: "constitutional-principles",
    knowledgeTitle: "Constitutional principles",
    illustrationId: "humanity-council",
    nominationRole: "humanity_council",
  },
  {
    id: "chamber-of-state-representatives",
    name: "Chamber of State Representatives",
    status: "Future Institution",
    purpose:
      "Proposed chamber for representatives linked to states and officially recognized regional authorities.",
    role: "Brings state-level and geopolitical context into council deliberation through coordination and collaboration — not command.",
    learnMoreHref: "/knowledge/governance-principles",
    knowledgeSlug: "governance-principles",
    knowledgeTitle: "Governance principles",
    illustrationId: "state-representatives",
    nonNominationNote: "Representatives are appointed by participating governments.",
  },
  {
    id: "chamber-of-intellectual-analysis",
    name: "Chamber of Intellectual Analysis",
    status: "Under Development",
    purpose:
      "Proposed chamber for expert analysis, evaluation, and strategic assessment to inform deliberation.",
    role: "Supplies analytical input to council decisions without replacing democratic voting or steward-led initiative work.",
    learnMoreHref: "/knowledge/collaborative-analysis",
    knowledgeSlug: "collaborative-analysis",
    knowledgeTitle: "Collaborative Analysis",
    illustrationId: "intellectual-analysis",
    nominationRole: "chamber_of_intellectual_analysis",
  },
  {
    id: "expert-analysis-team",
    name: "Expert Analysis Team",
    status: "Under Development",
    purpose:
      "Proposed specialist analysis unit supporting the Chamber of Intellectual Analysis with domain-focused evaluation.",
    role: "Provides focused expert assessment linked to the collaborative analysis ecosystem.",
    learnMoreHref: "/knowledge/collaborative-analysis",
    knowledgeSlug: "collaborative-analysis",
    knowledgeTitle: "Collaborative Analysis",
    illustrationId: "expert-analysis-team",
    nominationRole: "expert_analysis_team",
  },
  {
    id: "state-collaboration-department",
    name: "State Collaboration Department",
    status: "Under Development",
    purpose:
      "Proposed institutional unit for coordinated workflows with participating states and regional authorities.",
    role: "Connects civic institutional processes with state collaboration pathways under charter oversight.",
    learnMoreHref: "/knowledge/governance-principles",
    knowledgeSlug: "governance-principles",
    knowledgeTitle: "Governance principles",
    illustrationId: "state-collaboration",
    nominationRole: "state_collaboration_department",
  },
  {
    id: "secretariat",
    name: "Secretariat",
    status: "Concept",
    purpose:
      "Proposed permanent administrative body for continuity, records, and coordinated execution support.",
    role: "Translates council outcomes into scheduled action, maintains institutional memory, and supports cross-body logistics.",
    learnMoreHref: "/knowledge/open-civic-processes",
    knowledgeSlug: "open-civic-processes",
    knowledgeTitle: "Open civic processes",
    illustrationId: "secretariat",
  },
  {
    id: "hpc",
    name: "Humanity Protection Command Center (HPC)",
    status: "Concept",
    purpose:
      "Proposed policy and command coordination center for protective standards, oversight, and operational direction.",
    role: "Defines protective policy, coordinates oversight, and directs World Protection Corps operations within defined authority limits.",
    learnMoreHref: "/knowledge/transparency",
    knowledgeSlug: "transparency",
    knowledgeTitle: "Transparency",
    illustrationId: "hpc",
    nonNominationNote:
      "HPC leadership pathways await dedicated security and legal review before public nomination.",
  },
  {
    id: "wpc",
    name: "World Protection Corps (WPC)",
    status: "Future Institution",
    purpose:
      "Proposed operational coordination body for protective responses, humanitarian support, and crisis coordination within bounded mandates.",
    role: "Executes protective operations under HPC direction and council oversight — designed for coordination, not unilateral enforcement over countries.",
    learnMoreHref: "/knowledge/responsibility",
    knowledgeSlug: "responsibility",
    knowledgeTitle: "Responsibility",
    illustrationId: "wpc",
    featured: true,
    nonNominationNote:
      "World Protection Corps is an operational body under HPC direction — not open to civic nomination.",
  },
  {
    id: "community-self-defense-units",
    name: "Community Self-Defense Units",
    status: "Concept",
    purpose:
      "Proposed community-scoped protective coordination for civilian resilience at the local level.",
    role: "Supports community safety and de-escalation within platform rules — separate from World Protection Corps and not a paramilitary formation.",
    learnMoreHref: "/knowledge/responsibility",
    knowledgeSlug: "responsibility",
    knowledgeTitle: "Responsibility",
    illustrationId: "community-units",
    nonNominationNote: "Community protective coordination nomination pathways are deferred.",
  },
  {
    id: "regional-offices",
    name: "Regional Humanity Union Offices",
    status: "Under Development",
    purpose:
      "Proposed geographic presence connecting global institutional architecture to country, region, and community activity.",
    role: "Localizes coordination, supports regional participation, and links geographic civic activity to institutional workflows.",
    learnMoreHref: "/knowledge/reference-only-architecture",
    knowledgeSlug: "reference-only-architecture",
    knowledgeTitle: "Reference-only architecture",
    illustrationId: "regional-offices",
    nonNominationNote: "Regional office nomination models are deferred.",
  },
];

export const STANDARD_INSTITUTION_CARDS = INSTITUTION_RECORDS.filter((record) => !record.featured);

export const WPC_INSTITUTION = INSTITUTION_RECORDS.find((record) => record.id === "wpc");

export const HPC_INSTITUTION = INSTITUTION_RECORDS.find((record) => record.id === "hpc");

export function isNominatableInstitution(institution: InstitutionRecord): boolean {
  return Boolean(institution.nominationRole);
}
