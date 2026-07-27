import { CIVIC_MEDIA_ROUTE } from "../civic-media-center/routes";

export const PRIMARY_NAVIGATION: ReadonlyArray<{
  label: string;
  href?: string;
  status: "active" | "placeholder";
}> = [
  { label: "Home", href: "/", status: "active" },
  { label: "Institutions", href: "/institutions", status: "active" },
  { label: "Initiatives", href: "/initiatives", status: "active" },
  { label: "Civic Media", href: CIVIC_MEDIA_ROUTE, status: "active" },
  { label: "Knowledge", href: "/knowledge", status: "active" },
  { label: "Membership", href: "/membership", status: "active" },
  { label: "Search", href: "/search", status: "active" },
];

export const BRAND_TAGLINE = "WORLD SOLIDARITY";

export const FOOTER_MISSION =
  "A global movement of citizens working together for a more just, peaceful and sustainable world.";

export const FOOTER_COPYRIGHT = "© 2024 Humanity Union. All rights reserved.";
