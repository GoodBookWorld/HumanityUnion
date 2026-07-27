/** Trusted media resource category — curated, never ranked. */
export type TrustedMediaCategoryId =
  | "international-wire-service"
  | "public-broadcaster"
  | "independent-investigative"
  | "regional-public-media"
  | "scientific-publisher"
  | "academic-resource";

export interface TrustedMediaCategory {
  id: TrustedMediaCategoryId;
  title: string;
  description: string;
  sortOrder: number;
}

export interface TrustedMediaResource {
  id: string;
  name: string;
  logoLabel: string;
  /** Local public asset path, e.g. /images/media/bbc.webp */
  logoUrl?: string;
  country: string;
  /** ISO 3166-1 alpha-2 code when the resource is country-scoped (e.g. CA). */
  countryCode?: string;
  categoryId: TrustedMediaCategoryId;
  explanation: string;
  websiteUrl: string;
  sortOrder: number;
}

export interface FactCheckResource {
  id: string;
  name: string;
  mission: string;
  coverage: string;
  websiteUrl: string;
  sortOrder: number;
}

export interface PropagandaAnalysisResource {
  id: string;
  name: string;
  focus: string;
  explanation: string;
  websiteUrl: string;
  sortOrder: number;
}

/** Static news widget — curated reference, not an aggregated feed. */
export interface CivicMediaNewsWidget {
  id: string;
  source: string;
  headline: string;
  publishedAt: string;
  excerpt: string;
  originalUrl: string;
  sortOrder: number;
}

export interface CivicMediaFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface CivicMediaSelectionPrinciple {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
}

export interface CivicMediaOverview {
  title: string;
  summary: string;
  points: Array<{ id: string; heading: string; body: string }>;
}

export interface CivicMediaInitiativeFlow {
  title: string;
  summary: string;
  diagramSvg: string;
  stages: string[];
}

export interface CivicMediaCenterPublic {
  overview: CivicMediaOverview;
  trustedMediaCategories: TrustedMediaCategory[];
  trustedMedia: TrustedMediaResource[];
  factChecking: FactCheckResource[];
  propagandaAnalysis: PropagandaAnalysisResource[];
  initiativeFlow: CivicMediaInitiativeFlow;
  selectionPrinciples: CivicMediaSelectionPrinciple[];
  faq: CivicMediaFaqItem[];
  updatedAt: string;
}

export interface CivicMediaCategoriesListing {
  trustedMediaCategories: TrustedMediaCategory[];
}

/** Assistant-safe Civic Media Center reference. */
export interface CivicMediaAssistantReference {
  sectionId: string;
  title: string;
  purpose: string;
  href: string;
}
