import type {
  AdminAuditCategory,
  AdministrationAuditAction,
  AdministrationAuditRecord,
} from "@hu/types";

/** Exhaustive action list for category → `$in` filters (keep in sync with types). */
export const ADMINISTRATION_AUDIT_ACTIONS: readonly AdministrationAuditAction[] = [
  "capability.grant",
  "capability.revoke",
  "blog.author_application.decide",
  "blog.author_application.submit",
  "blog.author_application.reconcile",
  "blog.author_application.recovery_reset",
  "member_badge.application.save",
  "member_badge.payment.completed",
  "blog.publication_review.reconcile",
  "blog.publish",
  "blog.publish_after_safety_review",
  "blog.archive",
  "blog.update_published",
  "blog.published_correction_started",
  "blog.comment.moderate",
  "author.block",
  "author.unblock",
  "publication.block",
  "publication.unblock",
  "safety.override",
  "administration.bootstrap",
  "initiative.visibility.hide",
  "initiative.visibility.restore",
  "initiative.administrative.block",
  "initiative.administrative.unblock",
  "public_choice.candidate.block",
  "public_choice.candidate.unblock",
  "editor.moderation.block",
  "editor.moderation.unblock",
  "media_resource.create",
  "media_resource.update",
  "media_resource.activate",
  "media_resource.deactivate",
  "media_resource.delete",
  "blog.category.create",
  "blog.category.update",
  "blog.category.activate",
  "blog.category.deactivate",
  "blog.category.delete",
  "blog.category.reorder",
  "blog.subscription_settings.update",
  "blog.subscriber.remove",
  "blog.subscriber.manual_add",
  "blog.subscriber_message.queue",
  "blog.author.trusted_publishing.enable",
  "blog.author.trusted_publishing.disable",
  "platform.social_account.update",
  "platform.social_account.clear",
  "seo.page_override.create",
  "seo.page_override.update",
  "seo.page_override.clear",
  "country_affiliation.create",
  "country_affiliation.update",
  "country_affiliation.activate",
  "country_affiliation.deactivate",
  "country_affiliation.delete",
  "editor.assign",
  "editor.update_permissions",
  "editor.update_scope",
  "editor.activate",
  "editor.deactivate",
  "beta.invite.create",
  "beta.invite.revoke",
  "participant.suspend",
  "participant.restore",
  "participant.suspension_review.submit",
] as const;

const READ_SENSITIVE_PATTERNS = [
  /password/i,
  /smtp/i,
  /api[_-]?key/i,
  /bearer\s+/i,
  /mongodb(\+srv)?:\/\//i,
  /authorization:\s*/i,
  /codeHash/i,
  /invite code/i,
  /R2_SECRET/i,
  /JWT_/i,
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Derive browser category from action taxonomy (not persisted). */
export function deriveAdminAuditCategory(action: AdministrationAuditAction): AdminAuditCategory {
  if (action.startsWith("participant.")) {
    return "participants";
  }
  if (action.startsWith("beta.")) {
    return "beta_access";
  }
  if (action.startsWith("seo.")) {
    return "seo";
  }
  if (
    action.startsWith("blog.subscriber") ||
    action.startsWith("blog.subscription") ||
    action === "blog.subscriber_message.queue"
  ) {
    return "subscribers";
  }
  if (
    action.startsWith("blog.") ||
    action.startsWith("author.") ||
    action.startsWith("publication.")
  ) {
    return "publishing";
  }
  if (action.startsWith("initiative.")) {
    return "initiatives";
  }
  if (action.startsWith("public_choice.")) {
    return "public_choice";
  }
  if (action.startsWith("platform.") || action.startsWith("media_resource.")) {
    return "platform";
  }
  if (
    action.startsWith("editor.") ||
    action.startsWith("capability.") ||
    action.startsWith("administration.") ||
    action.startsWith("safety.") ||
    action.startsWith("country_affiliation.")
  ) {
    return "administration";
  }
  return "other";
}

/** Actions belonging to a category — used for Mongo `$in` filters. */
export function actionsForAdminAuditCategory(
  category: AdminAuditCategory,
): AdministrationAuditAction[] {
  return ADMINISTRATION_AUDIT_ACTIONS.filter(
    (action) => deriveAdminAuditCategory(action) === category,
  );
}

export function resolveAdminAuditTargetHref(
  targetType: string,
  targetId: string,
): string | null {
  switch (targetType) {
    case "initiative":
      return `/admin/initiatives/${encodeURIComponent(targetId)}`;
    case "public_choice_candidate":
      return "/admin/public-choice";
    case "editor_grant":
      return `/admin/editors/${encodeURIComponent(targetId)}`;
    case "blog_subscriber":
    case "blog_subscription_settings":
    case "blog_admin_subscriber_message":
      return "/admin/views/subscribers";
    case "blog_post":
    case "blog_author_application":
    case "blog_capability_grant":
    case "blog_category":
    case "blog_comment":
      return "/admin/publishing";
    case "beta_invite":
      return "/admin/beta-access";
    case "participant":
      return "/admin/participants";
    case "seo_page_override":
      return "/admin/seo";
    case "media_resource":
      return "/admin/media-resources";
    case "country_affiliation":
      return "/admin/country-people";
    case "platform_social_account":
      return "/admin/platform";
    default:
      return null;
  }
}

export function formatAdminAuditTargetLabel(targetType: string, targetId: string): string {
  const shortId = targetId.length > 12 ? `${targetId.slice(0, 8)}…` : targetId;
  switch (targetType) {
    case "initiative":
      return `Initiative ${shortId}`;
    case "beta_invite":
      return `Beta invite ${shortId}`;
    case "participant":
      return `Participant ${shortId}`;
    case "blog_post":
      return `Publication ${shortId}`;
    case "blog_subscriber":
      return `Subscriber ${shortId}`;
    case "seo_page_override":
      return `SEO override ${shortId}`;
    case "editor_grant":
      return `Editor grant ${shortId}`;
    case "media_resource":
      return `Media resource ${shortId}`;
    case "public_choice_candidate":
      return `Public Choice candidate ${shortId}`;
    case "platform_social_account":
      return `Social account ${shortId}`;
    case "country_affiliation":
      return `Country affiliation ${shortId}`;
    default:
      return `${targetType} ${shortId}`;
  }
}

export function formatAdminAuditActionLabel(action: AdministrationAuditAction): string {
  return action.replace(/\./g, " · ");
}

/** Project a human-readable summary without dumping metadata objects. */
export function projectAdminAuditSafeSummary(record: AdministrationAuditRecord): string {
  const preferred =
    record.afterSummary?.trim() ||
    record.beforeSummary?.trim() ||
    record.reason?.trim() ||
    formatAdminAuditActionLabel(record.action);
  return sanitizeAdminAuditTextForRead(preferred);
}

/**
 * Read-path sanitization for legacy rows. Does not mutate stored documents.
 */
export function sanitizeAdminAuditTextForRead(value: string): string {
  let text = value.trim();
  if (!text) {
    return "";
  }
  text = text.replace(EMAIL_PATTERN, "[email]");
  for (const pattern of READ_SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return "Summary withheld (sensitive material).";
    }
  }
  if (text.length > 280) {
    return `${text.slice(0, 277)}…`;
  }
  return text;
}

export function adminAuditMatchesSearchQuery(
  input: {
    action: string;
    actorLabel: string;
    targetLabel: string;
    safeSummary: string;
  },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [input.action, input.actorLabel, input.targetLabel, input.safeSummary]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
