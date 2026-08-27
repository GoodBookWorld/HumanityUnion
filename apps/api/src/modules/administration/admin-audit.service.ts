import type {
  AdminAuditBrowserItem,
  AdminAuditBrowserResponse,
  AdminAuditCategory,
  AdministrationAuditAction,
  AdministrationAuditRecord,
} from "@hu/types";

import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import {
  actionsForAdminAuditCategory,
  adminAuditMatchesSearchQuery,
  deriveAdminAuditCategory,
  formatAdminAuditActionLabel,
  formatAdminAuditTargetLabel,
  projectAdminAuditSafeSummary,
  resolveAdminAuditTargetHref,
} from "./admin-audit.projection.js";
import { assertCapability } from "./capability-resolver.js";
import { listAdministrationAuditForAdmin } from "./persistence/administration-audit.repository.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const SEARCH_SCAN_CAP = 500;

type AuditBrowserActorAssert = (userId: string) => Promise<void>;
type ActorLabelResolver = (participantIds: readonly string[]) => Promise<Map<string, string>>;

let actorAssertOverrideForTests: AuditBrowserActorAssert | null = null;
let actorLabelResolverOverrideForTests: ActorLabelResolver | null = null;

/** Pack 23E.3 — test seam for Admin-only gate without live auth users. */
export function setAdminAuditBrowserActorAssertOverrideForTests(
  override: AuditBrowserActorAssert | null,
): void {
  actorAssertOverrideForTests = override;
}

/** Pack 23E.3 — test seam for actor labels without member-profile Mongo. */
export function setAdminAuditActorLabelResolverOverrideForTests(
  override: ActorLabelResolver | null,
): void {
  actorLabelResolverOverrideForTests = override;
}

const ADMIN_AUDIT_CATEGORIES: readonly AdminAuditCategory[] = [
  "participants",
  "initiatives",
  "publishing",
  "subscribers",
  "seo",
  "membership",
  "beta_access",
  "platform",
  "public_choice",
  "administration",
  "other",
] as const;

export class AdminAuditBrowserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuditBrowserValidationError";
  }
}

export interface ListAdminAuditBrowserInput {
  actorUserId: string;
  q?: string;
  action?: string;
  category?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

async function assertAuditBrowserActor(userId: string): Promise<void> {
  if (actorAssertOverrideForTests) {
    await actorAssertOverrideForTests(userId);
    return;
  }
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  await assertCapability({
    participantId: user.memberId,
    role: user.role,
    capability: "platform.audit.read",
  });
}

function parseIsoBound(value: string | undefined, label: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new AdminAuditBrowserValidationError(`${label} must be a valid ISO date.`);
  }
  return new Date(parsed).toISOString();
}

function parseCategory(raw: string | undefined): AdminAuditCategory | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  if ((ADMIN_AUDIT_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as AdminAuditCategory;
  }
  throw new AdminAuditBrowserValidationError("Invalid audit category.");
}

function parseAction(raw: string | undefined): AdministrationAuditAction | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  return raw.trim() as AdministrationAuditAction;
}

async function resolveActorLabels(
  participantIds: readonly string[],
): Promise<Map<string, string>> {
  if (actorLabelResolverOverrideForTests) {
    return actorLabelResolverOverrideForTests(participantIds);
  }
  const labels = new Map<string, string>();
  await Promise.all(
    participantIds.map(async (participantId) => {
      try {
        const auth = await findAuthUserByMemberId(participantId);
        if (!auth) {
          labels.set(participantId, "Unknown actor");
          return;
        }
        const profile = await findMemberProfileByUserId(auth.userId);
        const label =
          profile?.displayName?.trim() ||
          auth.displayName?.trim() ||
          "Administrator";
        labels.set(participantId, label);
      } catch {
        labels.set(participantId, "Unknown actor");
      }
    }),
  );
  return labels;
}

function toBrowserItem(
  record: AdministrationAuditRecord,
  actorLabel: string,
): AdminAuditBrowserItem {
  return {
    auditId: record.auditId,
    createdAt: record.createdAt,
    action: record.action,
    category: deriveAdminAuditCategory(record.action),
    actorLabel,
    targetType: record.targetType,
    targetId: record.targetId,
    targetLabel: formatAdminAuditTargetLabel(record.targetType, record.targetId),
    targetHref: resolveAdminAuditTargetHref(record.targetType, record.targetId),
    safeSummary: projectAdminAuditSafeSummary(record),
  };
}

/**
 * Pack 23E.3 — Admin Audit browser.
 * Append-only log; no TTL in this Pack (retention requires governance).
 */
export async function listAdminAuditBrowser(
  input: ListAdminAuditBrowserInput,
): Promise<AdminAuditBrowserResponse> {
  await assertAuditBrowserActor(input.actorUserId);

  const limit = Math.min(
    Math.max(Number.isFinite(input.limit) ? Number(input.limit) : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(
    Number.isFinite(input.offset) ? Number(input.offset) : 0,
    0,
  );

  const category = parseCategory(input.category);
  const action = parseAction(input.action);
  const from = parseIsoBound(input.from, "from");
  const to = parseIsoBound(input.to, "to");
  if (from && to && from > to) {
    throw new AdminAuditBrowserValidationError("`from` must be before `to`.");
  }

  const actions =
    category && !action ? actionsForAdminAuditCategory(category) : undefined;
  if (category && action && deriveAdminAuditCategory(action) !== category) {
    return {
      items: [],
      total: 0,
      limit,
      offset,
      hasMore: false,
    };
  }

  const q = input.q?.trim() ?? "";
  const searchBounded = q.length > 0;

  const listed = await listAdministrationAuditForAdmin({
    action,
    actions,
    actorParticipantId: input.actorId?.trim() || undefined,
    from,
    to,
    limit: searchBounded ? SEARCH_SCAN_CAP : limit,
    offset: searchBounded ? 0 : offset,
    scanLimit: searchBounded ? SEARCH_SCAN_CAP : undefined,
  });

  const actorIds = [...new Set(listed.records.map((row) => row.actorParticipantId))];
  const actorLabels = await resolveActorLabels(actorIds);

  let items = listed.records.map((record) =>
    toBrowserItem(record, actorLabels.get(record.actorParticipantId) ?? "Unknown actor"),
  );

  if (searchBounded) {
    items = items.filter((item) =>
      adminAuditMatchesSearchQuery(
        {
          action: item.action,
          actorLabel: item.actorLabel,
          targetLabel: item.targetLabel,
          safeSummary: item.safeSummary,
        },
        q,
      ),
    );
    const total = items.length;
    const page = items.slice(offset, offset + limit);
    return {
      items: page,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      searchBounded: true,
    };
  }

  return {
    items,
    total: listed.total,
    limit,
    offset,
    hasMore: offset + limit < listed.total,
  };
}

export function listAdminAuditCategoryOptions(): readonly AdminAuditCategory[] {
  return ADMIN_AUDIT_CATEGORIES;
}

export function describeAdminAuditAction(action: AdministrationAuditAction): string {
  return formatAdminAuditActionLabel(action);
}
