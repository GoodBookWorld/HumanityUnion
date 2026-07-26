import type { FactCheckResource } from "@hu/types";

export const FACT_CHECK_RESOURCES: readonly FactCheckResource[] = [
  {
    id: "snopes",
    name: "Snopes",
    mission:
      "Investigate rumors, viral claims, and widely shared stories with documented evidence.",
    coverage: "General claims, urban legends, social media rumors, and public statements.",
    websiteUrl: "https://www.snopes.com/",
    sortOrder: 1,
  },
  {
    id: "politifact",
    name: "PolitiFact",
    mission:
      "Fact-check public statements using transparent rating methodology and source citations.",
    coverage: "Political statements, campaign claims, and policy assertions in public discourse.",
    websiteUrl: "https://www.politifact.com/",
    sortOrder: 2,
  },
  {
    id: "factcheck-org",
    name: "FactCheck.org",
    mission: "Nonpartisan project monitoring factual accuracy in U.S. political communications.",
    coverage: "Political ads, speeches, debates, and viral political content.",
    websiteUrl: "https://www.factcheck.org/",
    sortOrder: 3,
  },
  {
    id: "euvsdisinfo",
    name: "EUvsDisinfo",
    mission: "Track and document disinformation narratives with open-source evidence.",
    coverage: "Disinformation campaigns, information manipulation, and false narratives.",
    websiteUrl: "https://euvsdisinfo.eu/",
    sortOrder: 4,
  },
  {
    id: "bellingcat",
    name: "Bellingcat",
    mission: "Open-source investigation using publicly available evidence and verifiable methods.",
    coverage: "Conflict reporting, geolocation verification, and digital forensics.",
    websiteUrl: "https://www.bellingcat.com/",
    sortOrder: 5,
  },
  {
    id: "afp-fact-check",
    name: "AFP Fact Check",
    mission: "International fact-checking unit of Agence France-Presse with editorial standards.",
    coverage: "Global viral claims, health misinformation, and international news assertions.",
    websiteUrl: "https://factcheck.afp.com/",
    sortOrder: 6,
  },
  {
    id: "full-fact",
    name: "Full Fact",
    mission: "Independent fact-checking charity using transparent methodology and corrections.",
    coverage: "UK public statements, statistics, and widely shared online claims.",
    websiteUrl: "https://fullfact.org/",
    sortOrder: 7,
  },
] as const;
