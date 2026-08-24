export const DEFAULT_MEMBER_AVATAR_URL = "/brand/humanity-default-avatar.svg";

export const ALLOWED_AVATAR_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

/** URL length guard while binary upload storage remains deferred. */
export const MAX_AVATAR_URL_LENGTH = 2048;

export const MAX_BIOGRAPHY_LENGTH = 2000;

export const MAX_DISPLAY_NAME_LENGTH = 120;

export const MAX_PUBLIC_NAME_LENGTH = 80;

export const MAX_ORGANIZATION_LENGTH = 160;

export const MAX_WEBSITE_LENGTH = 2048;

export const MAX_LINKEDIN_URL_LENGTH = 2048;

export const MAX_SOCIAL_PROFILE_URL_LENGTH = 2048;

export const LINKEDIN_URL_PREFIX = "https://www.linkedin.com/";

/** Pack 17E — host allowlists for personal Participant social profile URLs. */
export const PARTICIPANT_SOCIAL_PROFILE_HOSTS = {
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
} as const;

export type ParticipantSocialProfileNetwork = keyof typeof PARTICIPANT_SOCIAL_PROFILE_HOSTS;

export const MAX_LOCATION_FIELD_LENGTH = 120;

export const MAX_MEMBER_SKILLS = 25;

export const MAX_MEMBER_SKILL_LABEL_LENGTH = 48;
