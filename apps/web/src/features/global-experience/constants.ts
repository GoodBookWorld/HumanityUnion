import type { FooterLinkStatus } from "./footer-links";

export const PRIMARY_NAVIGATION: ReadonlyArray<{
  label: string;
  href?: string;
  status: FooterLinkStatus;
}> = [
  { label: "Home", href: "/", status: "active" },
  { label: "Initiatives", href: "/initiatives", status: "active" },
  { label: "Institutions", status: "placeholder" },
  { label: "Media", status: "placeholder" },
  { label: "Knowledge", status: "placeholder" },
  { label: "About", status: "placeholder" },
];

export const GLOBAL_EXPERIENCE_BLOCKS = [
  {
    id: "civic-introduction",
    architecturalName: "Hero",
    title: "Civic Introduction",
    stage: "Identity",
  },
  {
    id: "interactive-world-map",
    architecturalName: "Interactive Map",
    title: "Interactive World Map",
    stage: "Evidence",
  },
  {
    id: "global-statistics",
    architecturalName: "Statistics",
    title: "Global Statistics",
    stage: "Evidence",
  },
  {
    id: "participation-pipeline",
    architecturalName: "Initiative Levels",
    title: "Participation Pipeline",
    stage: "Evidence",
  },
  {
    id: "latest-global-initiatives",
    architecturalName: "Latest Initiatives",
    title: "Latest Global Initiatives",
    stage: "Evidence",
  },
  {
    id: "registration-gateway",
    architecturalName: "Registration Gateway",
    title: "Registration Gateway",
    stage: "Participation",
  },
] as const;
