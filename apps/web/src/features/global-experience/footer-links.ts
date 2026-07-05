export type FooterLinkStatus = "active" | "placeholder";

export interface FooterLink {
  label: string;
  href?: string;
  status: FooterLinkStatus;
}

export const FOOTER_PLATFORM_LINKS: FooterLink[] = [
  { label: "About", href: "/about", status: "placeholder" },
  { label: "Institutions", href: "/institutions", status: "placeholder" },
  { label: "Media", href: "/media", status: "placeholder" },
  { label: "Knowledge", href: "/knowledge", status: "placeholder" },
  { label: "Initiatives", href: "/initiatives", status: "active" },
];

export const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", status: "placeholder" },
  { label: "Terms", status: "placeholder" },
  { label: "Contact", status: "placeholder" },
];

export const REGISTRATION_ROUTE: string | null = null;
