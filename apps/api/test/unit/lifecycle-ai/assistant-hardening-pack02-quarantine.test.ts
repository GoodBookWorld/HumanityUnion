import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_ASSISTANT_HTTP_BASE,
  QUARANTINED_ASSISTANT_HTTP_BASES,
} from "../../../src/modules/lifecycle-ai/assistant-production-routes.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Assistant Production Hardening Pack 02 — quarantine", () => {
  it("keeps only the canonical Assistant HTTP base in production inventory", () => {
    assert.equal(CANONICAL_ASSISTANT_HTTP_BASE, "/api/v1/assistant");
    assert.ok(QUARANTINED_ASSISTANT_HTTP_BASES.includes("/api/v1/workspace-assistant"));
    assert.ok(QUARANTINED_ASSISTANT_HTTP_BASES.includes("/api/v1/lifecycle-ai"));
  });

  it("does not mount quarantined Assistant routers in app.ts", () => {
    const appSource = fs.readFileSync(path.join(repoRoot, "apps/api/src/app.ts"), "utf8");
    assert.match(appSource, /app\.use\("\/api\/v1\/assistant"/);
    assert.equal(appSource.includes('app.use("/api/v1/workspace-assistant"'), false);
    assert.equal(appSource.includes('app.use("/api/v1/lifecycle-ai"'), false);
    assert.equal(appSource.includes("workspaceAssistantRouter"), false);
    assert.equal(appSource.includes("lifecycleAiRouter"), false);
  });

  it("retains quarantine markers for legacy modules", () => {
    const markers = [
      "apps/api/src/modules/workspace-assistant/QUARANTINE.md",
      "apps/api/src/modules/workspace-intelligence/QUARANTINE.md",
      "apps/web/src/features/workspace-civic-assistant/QUARANTINE.md",
      "apps/web/src/features/lifecycle-ai-assistant/QUARANTINE.md",
    ];
    for (const relative of markers) {
      assert.equal(fs.existsSync(path.join(repoRoot, relative)), true, relative);
    }
  });
});
