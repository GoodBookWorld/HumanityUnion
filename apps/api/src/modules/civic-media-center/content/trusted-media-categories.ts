import type { TrustedMediaCategory } from "@hu/types";

export const TRUSTED_MEDIA_CATEGORIES: readonly TrustedMediaCategory[] = [
  {
    id: "international-wire-service",
    title: "International Wire Service",
    description: "Global news agencies with editorial standards and international bureaus.",
    sortOrder: 1,
  },
  {
    id: "public-broadcaster",
    title: "Public Broadcaster",
    description: "Publicly funded broadcasters with editorial independence mandates.",
    sortOrder: 2,
  },
  {
    id: "independent-investigative",
    title: "Independent Investigative",
    description: "Nonprofit and independent outlets focused on accountability reporting.",
    sortOrder: 3,
  },
  {
    id: "regional-public-media",
    title: "Regional Public Media",
    description: "National public media organizations serving specific regions.",
    sortOrder: 4,
  },
  {
    id: "scientific-publisher",
    title: "Scientific Publisher",
    description: "Peer-reviewed scientific publications and research journals.",
    sortOrder: 5,
  },
  {
    id: "academic-resource",
    title: "Academic Resource",
    description: "Reference libraries and academic knowledge bases.",
    sortOrder: 6,
  },
] as const;
