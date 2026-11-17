/** Public Regional Development Program page — static routes and assets. */

export const REGIONAL_PROGRAM_ROUTE = "/regional-program";

export const REGIONAL_PROGRAM_VOLUNTEER_HREF = "/volunteer";

/**
 * Join CTA default — mailbox only.
 * When `NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true`, Join uses the
 * auth-aware `/workspace?rrp=apply` entry flow instead (HU-RRP-02A).
 */
export const REGIONAL_PROGRAM_JOIN_MAILTO = "mailto:info@huws.org";

export const REGIONAL_PROGRAM_ASSETS = {
  /** Hero photograph — identical in LTR and RTL (dir still flips layout/text). */
  hero: "/illustrations/support/humanity-union-teamwork-hands.webp",
  /** Same asset as `hero` — kept for BannerMedia LTR/RTL layer slots. */
  heroRtl: "/illustrations/support/humanity-union-teamwork-hands.webp",
  tools: "/illustrations/support/humanity-union-diverse-team-meeting.webp",
  presence: "/illustrations/support/humanity-union-flag-park.webp",
  /** Final CTA photograph — identical in LTR and RTL. */
  cta: "/illustrations/support/hikers-sunset-mountain.webp",
  /** Same asset as `cta` — kept for BannerMedia LTR/RTL layer slots. */
  ctaRtl: "/illustrations/support/hikers-sunset-mountain.webp",
} as const;

/** Activity cards — true-vector brand-blue `#0174b0` SVGs at 42×42. */
export const REGIONAL_PROGRAM_ACTIVITY_ICONS = {
  unite: "/icons/volunteer/unite-people.svg",
  education: "/icons/volunteer/soc-education.svg",
  initiatives: "/icons/volunteer/support-civic.svg",
  partnerships: "/icons/volunteer/build-partner.svg",
} as const;

/** Platform tools — mixed SVG/PNG as specified; preserve aspect ratio. */
export const REGIONAL_PROGRAM_TOOL_ICONS = {
  initiatives: "/icons/workspace/initiatives.svg",
  discussions: "/icons/workspace/analyses.svg",
  proposals: "/icons/workspace/proposals.svg",
  petitions: "/icons/workspace/petition.png",
  decisions: "/icons/workspace/collective-decisions.svg",
  tracking: "/icons/workspace/tracking.svg",
  media: "/icons/burger/blog.png",
  workspace: "/icons/workspace/workspace.png",
} as const;

export const REGIONAL_PROGRAM_BENEFIT_ICON = "/icons/workspace/proposals.png";

export const REGIONAL_PROGRAM_PRINCIPLE_ICON = "/icons/messenger/attention.png";
