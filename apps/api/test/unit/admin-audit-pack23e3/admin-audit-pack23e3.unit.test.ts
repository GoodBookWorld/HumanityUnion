/**
 * Pack 23E.3 — Admin Audit browser (API).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdministrationAuditRecord } from "@hu/types";

import {
  deriveAdminAuditCategory,
  projectAdminAuditSafeSummary,
  resolveAdminAuditTargetHref,
  sanitizeAdminAuditTextForRead,
} from "../../../src/modules/administration/admin-audit.projection.js";
import {
  listAdminAuditBrowser,
  setAdminAuditActorLabelResolverOverrideForTests,
  setAdminAuditBrowserActorAssertOverrideForTests,
} from "../../../src/modules/administration/admin-audit.service.js";
import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  appendAdministrationAuditRecord,
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "../../../src/modules/administration/persistence/administration-audit.repository.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

async function seedAudit(
  partial: Partial<AdministrationAuditRecord> &
    Pick<AdministrationAuditRecord, "action" | "targetType" | "targetId" | "actorParticipantId">,
): Promise<AdministrationAuditRecord> {
  return appendAdministrationAuditRecord({
    auditId: partial.auditId ?? `admin-audit-${Math.random().toString(16).slice(2)}`,
    actorParticipantId: partial.actorParticipantId,
    action: partial.action,
    targetType: partial.targetType,
    targetId: partial.targetId,
    scope: partial.scope ?? { scopeType: "global" },
    reason: partial.reason,
    beforeSummary: partial.beforeSummary,
    afterSummary: partial.afterSummary,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    correlationId: partial.correlationId,
  });
}

describe("Pack 23E.3 — Admin Audit browser contracts", () => {
  it("Admin-only route mounted; no charts/export/raw JSON", () => {
    assert.match(read("src/app.ts"), /\/api\/v1\/admin\/audit/);
    const service = read("src/modules/administration/admin-audit.service.ts");
    assert.match(service, /platform\.audit\.read/);
    assert.match(service, /SEARCH_SCAN_CAP = 500/);
    assert.match(service, /MAX_LIMIT = 100/);
    assert.doesNotMatch(service, /chart|exportCsv|rawPayload/i);
    assert.match(
      read("src/infrastructure/mongodb/mongo-indexes.ts"),
      /administration_audit_created_at/,
    );
  });

  it("safe summary / category / target links / no secrets", () => {
    assert.equal(
      sanitizeAdminAuditTextForRead("Contact password reset flow"),
      "Summary withheld (sensitive material).",
    );
    assert.equal(
      sanitizeAdminAuditTextForRead("Revoked invite for alice@example.com"),
      "Revoked invite for [email]",
    );
    assert.equal(deriveAdminAuditCategory("beta.invite.create"), "beta_access");
    assert.equal(deriveAdminAuditCategory("seo.page_override.update"), "seo");
    assert.equal(deriveAdminAuditCategory("blog.subscriber.remove"), "subscribers");
    assert.equal(resolveAdminAuditTargetHref("beta_invite", "inv-1"), "/admin/beta-access");
    assert.equal(
      resolveAdminAuditTargetHref("initiative", "init-1"),
      "/admin/initiatives/init-1",
    );
    assert.equal(resolveAdminAuditTargetHref("unknown_type", "x"), null);

    const summary = projectAdminAuditSafeSummary({
      auditId: "a1",
      actorParticipantId: "p1",
      action: "beta.invite.revoke",
      targetType: "beta_invite",
      targetId: "inv-1",
      scope: { scopeType: "global" },
      afterSummary: "inviteId=inv-1; status=pending→revoked",
      createdAt: new Date().toISOString(),
    });
    assert.match(summary, /pending→revoked/);
    assert.doesNotMatch(summary, /codeHash/);
  });
});

describe("Pack 23E.3 — Admin Audit browser list behavior", () => {
  beforeEach(() => {
    setAdministrationAuditForceMemoryForTests(true);
    resetAdministrationAuditMemoryForTests();
    setAdminAuditBrowserActorAssertOverrideForTests(async (userId) => {
      if (userId !== "admin-1") {
        throw new AdministrationForbiddenError("Administrator access is required.");
      }
    });
    setAdminAuditActorLabelResolverOverrideForTests(async (ids) => {
      const map = new Map<string, string>();
      for (const id of ids) {
        map.set(id, id === "participant-admin-1" ? "Admin One" : "Unknown actor");
      }
      return map;
    });
  });

  afterEach(() => {
    setAdministrationAuditForceMemoryForTests(false);
    resetAdministrationAuditMemoryForTests();
    setAdminAuditBrowserActorAssertOverrideForTests(null);
    setAdminAuditActorLabelResolverOverrideForTests(null);
  });

  it("1 — non-admin denied", async () => {
    await assert.rejects(
      () => listAdminAuditBrowser({ actorUserId: "member-1" }),
      AdministrationForbiddenError,
    );
  });

  it("2–5 — newest-first, default page size, max limit, pagination", async () => {
    await seedAudit({
      action: "beta.invite.create",
      targetType: "beta_invite",
      targetId: "inv-old",
      actorParticipantId: "participant-admin-1",
      afterSummary: "inviteId=inv-old; status=none→pending",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    await seedAudit({
      action: "beta.invite.revoke",
      targetType: "beta_invite",
      targetId: "inv-new",
      actorParticipantId: "participant-admin-1",
      afterSummary: "inviteId=inv-new; status=pending→revoked",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const page = await listAdminAuditBrowser({ actorUserId: "admin-1", limit: 25, offset: 0 });
    assert.equal(page.items[0]?.action, "beta.invite.revoke");
    assert.equal(page.items[0]?.actorLabel, "Admin One");
    assert.equal(page.limit, 25);
    assert.ok(page.items.every((item) => !("beforeSummary" in item)));

    const capped = await listAdminAuditBrowser({ actorUserId: "admin-1", limit: 500 });
    assert.equal(capped.limit, 100);

    const second = await listAdminAuditBrowser({ actorUserId: "admin-1", limit: 1, offset: 1 });
    assert.equal(second.items[0]?.action, "beta.invite.create");
    assert.equal(second.hasMore, false);
  });

  it("6–8 — date / category / safe search", async () => {
    await seedAudit({
      action: "seo.page_override.update",
      targetType: "seo_page_override",
      targetId: "seo-1",
      actorParticipantId: "participant-admin-1",
      afterSummary: "Changed SEO override for Initiative",
      createdAt: "2025-06-01T12:00:00.000Z",
    });
    await seedAudit({
      action: "beta.invite.create",
      targetType: "beta_invite",
      targetId: "inv-2",
      actorParticipantId: "participant-admin-1",
      afterSummary: "inviteId=inv-2; status=none→pending",
      createdAt: "2025-07-01T12:00:00.000Z",
    });

    const byCategory = await listAdminAuditBrowser({
      actorUserId: "admin-1",
      category: "seo",
    });
    assert.ok(byCategory.items.every((item) => item.category === "seo"));

    const byDate = await listAdminAuditBrowser({
      actorUserId: "admin-1",
      from: "2025-06-15T00:00:00.000Z",
    });
    assert.ok(byDate.items.every((item) => item.createdAt >= "2025-06-15T00:00:00.000Z"));

    const searched = await listAdminAuditBrowser({
      actorUserId: "admin-1",
      q: "SEO override",
    });
    assert.equal(searched.searchBounded, true);
    assert.ok(searched.items.some((item) => item.action === "seo.page_override.update"));
  });

  it("14–15 — target links + Beta create/revoke visible", async () => {
    await seedAudit({
      action: "beta.invite.create",
      targetType: "beta_invite",
      targetId: "inv-vis",
      actorParticipantId: "participant-admin-1",
      afterSummary: "inviteId=inv-vis; status=none→pending",
    });
    await seedAudit({
      action: "beta.invite.revoke",
      targetType: "beta_invite",
      targetId: "inv-vis",
      actorParticipantId: "participant-admin-1",
      afterSummary: "inviteId=inv-vis; status=pending→revoked",
    });

    const listed = await listAdminAuditBrowser({
      actorUserId: "admin-1",
      category: "beta_access",
    });
    assert.ok(listed.items.every((item) => item.targetHref === "/admin/beta-access"));
    const actions = listed.items.map((item) => item.action);
    assert.ok(actions.includes("beta.invite.create"));
    assert.ok(actions.includes("beta.invite.revoke"));
  });

  it("17 — empty state", async () => {
    const listed = await listAdminAuditBrowser({ actorUserId: "admin-1" });
    assert.equal(listed.total, 0);
    assert.deepEqual(listed.items, []);
  });
});
