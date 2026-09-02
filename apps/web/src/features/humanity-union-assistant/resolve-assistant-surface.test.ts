import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assistantWidgetCopy,
  assistantWidgetCopyKey,
  resolveAssistantLaunchContext,
} from "./resolve-assistant-surface.js";

describe("resolveAssistantLaunchContext (Pack 04 / Hardening Pack 02)", () => {
  it("maps Workspace Home and Initiatives", () => {
    assert.equal(resolveAssistantLaunchContext("/workspace").surfaceId, "workspace");
    assert.equal(resolveAssistantLaunchContext("/workspace/initiatives").surfaceId, "initiatives");
  });

  it("maps Lifecycle hashes on an Initiative without reading private data", () => {
    const analysis = resolveAssistantLaunchContext(
      "/initiatives/public/initiative-123",
      "#collaborative-analysis",
    );
    assert.equal(analysis.surfaceId, "analysis");
    assert.equal(analysis.initiativeId, "initiative-123");
    assert.equal(analysis.stageId, "analysis");

    const messages = resolveAssistantLaunchContext("/workspace/messages/abc");
    assert.equal(messages.surfaceId, "messages");
    assert.equal(messages.initiativeId, undefined);
  });

  it("maps notifications, preferences, profile, and public home", () => {
    assert.equal(resolveAssistantLaunchContext("/notifications").surfaceId, "notifications");
    assert.equal(resolveAssistantLaunchContext("/preferences").surfaceId, "preferences");
    assert.equal(resolveAssistantLaunchContext("/profile").surfaceId, "profile");
    assert.equal(resolveAssistantLaunchContext("/").surfaceId, "initiatives");
  });

  it("maps standalone Lifecycle public routes to the matching stage surface", () => {
    assert.equal(resolveAssistantLaunchContext("/petitions/public/petition-1").surfaceId, "petition");
    assert.equal(
      resolveAssistantLaunchContext("/initiative-analyses/public/analysis-1").surfaceId,
      "analysis",
    );
    assert.equal(
      resolveAssistantLaunchContext("/implementations/public/impl-1").stageId,
      "commitment",
    );
  });

  it("provides contextual widget copy without changing Assistant identity", () => {
    assert.match(assistantWidgetCopy("workspace"), /Workspace/);
    assert.match(assistantWidgetCopy("initiatives"), /Initiatives/);
    assert.match(assistantWidgetCopy("messages"), /without reading private message history/);
  });

  it("maps widget copy to initiativeExperience catalog keys", () => {
    assert.equal(assistantWidgetCopyKey("workspace"), "assistant.entry.widgetCopy.workspace");
    assert.equal(assistantWidgetCopyKey("blog"), "assistant.entry.widgetCopy.blog");
    assert.equal(assistantWidgetCopyKey("archive"), "assistant.entry.widgetCopy.default");
  });
});
