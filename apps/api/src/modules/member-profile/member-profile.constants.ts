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

export const LINKEDIN_URL_PREFIX = "https://www.linkedin.com/";

export const MAX_LOCATION_FIELD_LENGTH = 120;

export const MAX_MEMBER_SKILLS = 25;

export const MAX_MEMBER_SKILL_LABEL_LENGTH = 48;
