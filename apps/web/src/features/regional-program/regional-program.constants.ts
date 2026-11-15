/** Public Regional Development Program page — static routes and assets. */

export const REGIONAL_PROGRAM_ROUTE = "/regional-program";

export const REGIONAL_PROGRAM_VOLUNTEER_HREF = "/volunteer";

/** Join CTA — mailbox only; no form or API. */
export const REGIONAL_PROGRAM_JOIN_MAILTO = "mailto:info@huws.org";

export const REGIONAL_PROGRAM_ASSETS = {
  /** Tablet+ LTR hero plane — CSS background. */
  hero: "/illustrations/support/humanity-union-teamwork-hands.webp",
  /** RTL hero plane — selected when document `dir === rtl`. */
  heroRtl: "/illustrations/support/humanity-union-teamwork-hands-rtl.webp",
  tools: "/illustrations/support/humanity-union-diverse-team-meeting.webp",
  presence: "/illustrations/support/humanity-union-flag-park.webp",
  /** Tablet+ LTR final CTA plane. */
  cta: "/illustrations/support/hikers-sunset-mountain-panorama.webp",
  /** RTL final CTA plane. */
  ctaRtl: "/illustrations/support/hikers-sunset-mountain-panorama-rtl.webp",
} as const;

/**
 * True-vector icons that already use brand blue `#0174b0`
 * (no PNG-backed SVGs).
 */
export const REGIONAL_PROGRAM_ICONS = {
  unite: "/icons/workspace/allies.svg",
  education: "/icons/workspace/message.svg",
  initiatives: "/icons/messenger/init-mob.svg",
  partnerships: "/icons/messenger/share.svg",
  discussions: "/icons/messenger/chat.svg",
  proposals: "/icons/messenger/add-mob.svg",
  petitions: "/icons/messenger/microphone.svg",
  decisions: "/icons/messenger/group-chat.svg",
  tracking: "/icons/messenger/work-mob.svg",
  media: "/icons/messenger/camera.svg",
  workspace: "/icons/messenger/not-mob.svg",
  benefit: "/icons/messenger/ai-mob.svg",
  principle: "/icons/workspace/allies.svg",
} as const;
