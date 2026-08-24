import { CIVIC_MEDIA_ROUTE } from "../civic-media-center/routes";

export type FooterLinkStatus = "active" | "placeholder";

export interface FooterLink {
  label: string;
  href?: string;
  status: FooterLinkStatus;
}

export const ORGANIZATION_NAME = "HUMANITY UNION SOCIETY";
export const ORGANIZATION_ADDRESS = "514 VERNON ST., PO BOX 721, NELSON BC V1L 5R4";
export const ORGANIZATION_WEBSITE = "https://www.huws.org";
export const CONTACT_EMAIL = "info@huws.org";

export const FOOTER_PLATFORM_COLUMN_ONE: FooterLink[] = [
  { label: "Institutions", href: "/institutions", status: "active" },
  { label: "Initiatives", href: "/initiatives", status: "active" },
  { label: "Blog", href: "/blog", status: "active" },
  { label: "Membership", href: "/membership", status: "active" },
];

export const FOOTER_PLATFORM_COLUMN_TWO: FooterLink[] = [
  { label: "Civic Media", href: CIVIC_MEDIA_ROUTE, status: "active" },
  { label: "Civic Archive", href: "/civic-archive", status: "active" },
  { label: "Support", href: "/support", status: "active" },
  { label: "Search", href: "/search", status: "active" },
];

/** @deprecated Use FOOTER_PLATFORM_COLUMN_ONE and FOOTER_PLATFORM_COLUMN_TWO */
export const FOOTER_PLATFORM_LINKS: FooterLink[] = [
  ...FOOTER_PLATFORM_COLUMN_ONE,
  ...FOOTER_PLATFORM_COLUMN_TWO,
];

export const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", href: "/privacy", status: "active" },
  { label: "Terms", href: "/terms", status: "active" },
  { label: "Contact", href: "/contact", status: "active" },
];

/**
 * @deprecated Pack 17C — official social destinations are Admin-managed via
 * `/api/v1/platform/social-accounts`. Do not use this constant as a live URL source.
 */
export const FOOTER_SOCIAL_LINKS = [] as const;

/** Live registration entry — Identity Capability is available at `/register`. */
export const REGISTRATION_ROUTE = "/register";

export function mailtoContactLink(subject?: string): string {
  if (!subject) {
    return `mailto:${CONTACT_EMAIL}`;
  }

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
