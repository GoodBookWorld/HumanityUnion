export const INSTITUTIONS_HERO = {
  headline: "Building the Institutions of Responsible Global Cooperation",
  subheadline:
    "A proposed institutional framework designed to strengthen civic participation, expert analysis, transparent decision-making, and responsible implementation across communities and nations.",
  banner:
    "This page presents the proposed constitutional institutions of Humanity Union. These institutions represent the platform's long-term governance vision and are being developed transparently through public civic participation.",
  primaryCta: { label: "Create Initiative", href: "#" },
} as const;

export const INSTITUTIONS_FOOTER = {
  statement:
    "Institutions are not built by declarations.\nThey are built by responsible people working together.",
  primaryCta: { label: "Create Initiative", href: "#" },
  secondaryCta: { label: "Explore Knowledge", href: "/knowledge" },
} as const;

export const CREATE_INITIATIVE_PLACEHOLDER = "#" as const;

export const CONSTITUTIONAL_ARCHITECTURE_BLOCKS = [
  {
    id: "participants",
    label: "Participants",
    targetId: "institution-humanity-council",
    accent: "#2563eb",
  },
  {
    id: "initiatives",
    label: "Initiatives",
    targetId: "institution-humanity-council",
    accent: "#0891b2",
  },
  {
    id: "collaborative-analysis",
    label: "Collaborative Analysis",
    targetId: "institution-chamber-of-intellectual-analysis",
    accent: "#7c3aed",
  },
  {
    id: "collective-decision",
    label: "Collective Decision",
    targetId: "institution-humanity-council",
    accent: "#9333ea",
  },
  {
    id: "humanity-council",
    label: "Humanity Council",
    targetId: "institution-humanity-council",
    accent: "#1d4ed8",
  },
  {
    id: "implementation",
    label: "Implementation",
    targetId: "institution-secretariat",
    accent: "#0d9488",
  },
  {
    id: "public-impact",
    label: "Public Impact",
    targetId: "institution-wpc",
    accent: "#059669",
  },
  {
    id: "civic-archive",
    label: "Civic Archive",
    targetId: "institution-regional-offices",
    accent: "#64748b",
  },
] as const;

export const INSTITUTIONS_STICKY_NAV_ITEMS = [
  { id: "architecture", label: "Architecture", targetId: "institutions-architecture" },
  { id: "institutions", label: "Institutions", targetId: "institutions-grid-section" },
  { id: "protection", label: "Protection", targetId: "institutions-protection" },
  { id: "wpc", label: "WPC", targetId: "institution-wpc" },
  {
    id: "regional-offices",
    label: "Regional Offices",
    targetId: "regional-offices",
  },
  {
    id: "related-initiatives",
    label: "Related Initiatives",
    targetId: "institutions-related-initiatives",
  },
] as const;

export const PROTECTION_HIERARCHY_LEVELS = [
  {
    id: "hpc",
    kind: "hero" as const,
    title: "Humanity Protection Command Center",
    subtitle: "Global operational coordination center",
    illustrationId: "hpc",
  },
  {
    id: "operational-command",
    kind: "connector" as const,
    label: "Operational Command",
  },
  {
    id: "wpc",
    kind: "link" as const,
    title: "World Protection Corps (WPC)",
    description:
      "Operational coordination body receiving direction from HPC under council oversight and charter limits.",
    targetId: "institution-wpc",
  },
  {
    id: "regional-offices",
    kind: "link" as const,
    title: "Regional Humanity Union Offices",
    description:
      "Geographic presence connecting global institutional architecture to country, region, and community activity.",
    targetId: "regional-offices",
  },
  {
    id: "community-self-defense-units",
    kind: "link" as const,
    title: "Community Self-Defense Units",
    description:
      "Community-scoped protective coordination for civilian resilience at the local level.",
    targetId: "institution-community-self-defense-units",
  },
] as const;

export const WPC_ACCORDION_SECTIONS = [
  {
    id: "management-coordination",
    title: "1. Centralized Management & Coordination",
    body: "The Humanity Protection Command Center (HPC) serves as the sole strategic coordination hub for all operations of the World Protection Corps (WPC). This center: - Directs global security, defense, rescue, and humanitarian missions. - Integrates and oversees professional armed forces, specialized military units, rescue services, environmental protection teams, and designated medical personnel. - Operates under the strategic oversight of the Humanity Council, ensuring alignment with global priorities and long-term security objectives.",
  },
  {
    id: "composition-structure",
    title: "2. Composition & Structure",
    body: "The WPC is composed of personnel and resources contributed by democratic states based on a proportional system, factoring in: - Total population (ensuring fair representation). - Territorial size (considering geographical responsibilities). - Resource capacity (economic strength, technological capability, and material contributions). Each state fulfills its obligation primarily through financial contributions or equivalent material resources, facilitating the Corps’ operational sustainability.",
  },
  {
    id: "recruitment-training",
    title: "3. Recruitment & Training",
    body: "- A Unified Global Recruitment System ensures selection based on strict competency, skill, and ethical standards. - The World Protection Training Center (WPTC) conducts standardized training for all personnel, focusing on defense, crisis response, environmental protection, and medical aid. - Specialized divisions within the WPC include: * Military & Security Forces (global peacekeeping and protection). * Rescue & Emergency Response Units (disaster relief and crisis intervention). * Environmental Protection Teams (ecological crisis management and resource conservation). * Medical & Support Services (personnel welfare and mission sustainability).",
  },
  {
    id: "deployment-command",
    title: "4. Operational Deployment & Command",
    body: "- The HPC deploys personnel based on real-time global threats and emergencies. - Task forces operate under joint command structures, ensuring adaptability and efficiency. - The Corps maintains rapid response capabilities, supported by a global logistics and resource network.",
  },
  {
    id: "financial-logistical",
    title: "5. Financial & Logistical Support",
    body: "- Democratic states fund and equip the WPC through structured contributions. - Resources include financial assets, technology, military-grade equipment, and humanitarian supplies. - A Global Logistics Division manages supply chains, operational readiness, and mission sustainability.",
  },
  {
    id: "integration-bodies",
    title: "6. Integration with National & International Bodies",
    body: "- Professional armed forces of contributing states integrate into WPC command structures while retaining national oversight. - International organizations (e.g., humanitarian agencies, environmental groups) collaborate with WPC to enhance mission effectiveness.",
  },
  {
    id: "legal-ethical",
    title: "7. Legal & Ethical Foundations",
    body: "-The Humanity Council serves as the highest governing body, making strategic decisions on the elimination of causes and prevention of global military conflicts, environmental sabotage, and responses to natural disasters. - Decisions are based on consultations, expert analyses, and recommendations from the Chamber of Intellectual Analysis, ensuring a rational, knowledge-based approach to global security. - The World Protection Corps does not maintain neutrality in global conflicts that threaten all of humanity but instead actively eliminates root causes of conflict and prevents escalations through strategic interventions. - The Corps operates under a strict legal framework, ensuring all actions comply with democratic principles, international law, and ethical governance. - Operational mandates include: * Preventing state or non-state actors from triggering global instability. * Protecting the environment from large-scale destructive activities. * Responding decisively to humanitarian and natural crises.",
  },
] as const;
