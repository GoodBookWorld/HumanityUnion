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
