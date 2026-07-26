/**
 * TASK-060 — AI Provider Integration verification.
 * Run: npm run verify:ai-provider
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const ASSISTANT_MODULE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/workspace-assistant");
const AI_PROVIDER_FILES = new Set([
  "ai-assistant.config.ts",
  "ai-workspace-assistant-provider.ts",
  "build-ai-assistant-prompt.ts",
]);

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "stewardId",
  "email",
  "voteId",
  "sessionId",
  "messageHeaders",
  "providerMetadata",
  "initiativeId",
];

const steward = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, expectedMessagePart: string): void {
  try {
    fn();
    throw new Error(`Expected throw containing: ${expectedMessagePart}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Expected throw containing")) {
      throw error;
    }

    assert(
      message.includes(expectedMessagePart),
      `Expected "${expectedMessagePart}" but got "${message}"`,
    );
  }
}

async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedMessagePart: string,
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected throw containing: ${expectedMessagePart}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Expected throw containing")) {
      throw error;
    }

    assert(
      message.includes(expectedMessagePart),
      `Expected "${expectedMessagePart}" but got "${message}"`,
    );
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function buildContextSnapshot(initiativeId: string) {
  return {
    initiativeId,
    initiativeTitle: "AI Provider Initiative",
    lifecyclePhase: "projected",
    currentSection: "Collaborative Analysis",
    currentSectionLabel: "Collaborative Analysis",
    currentCivicStage: "collaborative analysis",
    nextAvailableStep: "Submit improvement proposal",
    relatedRecordsCount: 1,
    visibilityLabel: "Public record available",
    contextSummary: "Workspace assistant context snapshot for AI provider verification.",
  };
}

async function verifyMockModeStillWorks(): Promise<void> {
  console.log("1. Mock provider mode still works");

  process.env.WORKSPACE_ASSISTANT_PROVIDER = "mock";
  delete process.env.AI_API_KEY;

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { generateWorkspaceAssistantResponse } =
    await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const draft = createInitiativeDraft(steward, {
    title: "AI Provider Initiative",
    description: "Verification initiative for AI provider integration.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const response = await generateWorkspaceAssistantResponse({
    participantId: steward.participantId,
    userId: "user-bootstrap-001",
    displayName: steward.displayName,
    initiativeId: projected.initiativeId,
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "strengthen_evidence",
      label: "Strengthen evidence",
    },
    contextSnapshot: buildContextSnapshot(projected.initiativeId),
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  assert(response.mode === "mock", "Mock mode must remain available");
  assert(
    response.safetyNotices.some((notice) => notice.code === "advisory_only"),
    "Mock response must include advisory notice",
  );
}

async function verifyAiAssistedRequiresEnv(): Promise<void> {
  console.log("2. ai_assisted mode requires configuration");

  const { resolveWorkspaceAssistantProvider } =
    await import("../modules/workspace-assistant/assistant-engine/workspace-assistant-provider.js");
  const { assertAiAssistantConfigured } =
    await import("../modules/workspace-assistant/assistant-engine/ai-assistant.config.js");

  process.env.WORKSPACE_ASSISTANT_PROVIDER = "ai_assisted";
  delete process.env.AI_API_KEY;

  assertThrows(() => assertAiAssistantConfigured(), "AI_API_KEY is required");
  assertThrows(() => resolveWorkspaceAssistantProvider(), "AI_API_KEY is required");
}

async function verifyPromptPrivacy(): Promise<void> {
  console.log("3. Private fields excluded from AI prompt payload");

  const { buildAiAssistantPrompt, PRIVATE_PROMPT_KEYS } =
    await import("../modules/workspace-assistant/assistant-engine/build-ai-assistant-prompt.js");

  const prompt = buildAiAssistantPrompt({
    participantId: steward.participantId,
    initiativeId: "initiative-test",
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "clarify_summary",
      label: "Clarify summary",
    },
    contextSnapshot: buildContextSnapshot("initiative-test"),
    advisoryContext: {
      constitutionalSummary: "Review evidence before publishing.",
      currentCivicStage: "collaborative analysis",
      nextCivicMilestone: "improvement_proposal",
      responsibilities: ["Review analysis"],
      topRecommendation: null,
      secondaryRecommendations: [],
      blockedActions: [],
    },
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  const serialized = JSON.stringify(prompt).toLowerCase();

  for (const key of PRIVATE_PROMPT_KEYS) {
    assert(!serialized.includes(`"${key.toLowerCase()}"`), `Prompt leaked private field: ${key}`);
  }

  assert(
    prompt.userPrompt.includes("AI Provider Initiative"),
    "Prompt must include initiative title",
  );
  assert(!prompt.userPrompt.includes("initiative-test"), "Prompt must not include internal IDs");
}

async function verifyProhibitedActionsBlocked(): Promise<void> {
  console.log("4. Prohibited actions blocked");

  process.env.WORKSPACE_ASSISTANT_PROVIDER = "mock";

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { generateWorkspaceAssistantResponse } =
    await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const draft = createInitiativeDraft(steward, {
    title: "AI Provider Initiative",
    description: "Verification initiative for prohibited action checks.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);
  const snapshot = buildContextSnapshot(projected.initiativeId);

  await assertThrowsAsync(
    () =>
      generateWorkspaceAssistantResponse({
        participantId: steward.participantId,
        userId: "user-bootstrap-001",
        displayName: steward.displayName,
        initiativeId: projected.initiativeId,
        currentSection: "Collaborative Analysis",
        requestedAction: {
          capability: "vote",
          label: "Cast vote",
        },
        contextSnapshot: snapshot,
        timestamp: "2026-07-06T00:00:00.000Z",
      }),
    "prohibited",
  );

  await assertThrowsAsync(
    () =>
      generateWorkspaceAssistantResponse({
        participantId: steward.participantId,
        userId: "user-bootstrap-001",
        displayName: steward.displayName,
        initiativeId: projected.initiativeId,
        currentSection: "Collaborative Analysis",
        requestedAction: {
          capability: "strengthen_evidence",
          label: "Strengthen evidence",
        },
        userPrompt: "Please publish initiative immediately.",
        contextSnapshot: snapshot,
        timestamp: "2026-07-06T00:00:00.000Z",
      }),
    "prohibited civic action",
  );
}

async function verifySafetyGuardStripsCommands(): Promise<void> {
  console.log("5. Safety guard strips command-like tokens and keeps advisory drafts");

  const { applyWorkspaceAssistantSafetyGuard } =
    await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const response = applyWorkspaceAssistantSafetyGuard({
    responseId: "guard-test",
    mode: "mock",
    assistantMessage: "Consider publishing initiative language after review.",
    suggestedDraft: "Draft summary without civic commands.",
    confidenceLevel: "low",
    safetyNotices: [
      { code: "advisory_only", message: "Advisory only." },
      { code: "review_before_use", message: "Review before use." },
    ],
    followUpPrompts: [],
    prohibitedActions: [],
    createdAt: "2026-07-06T00:00:00.000Z",
  });

  assert(
    response.assistantMessage.includes("[advisory reference removed]"),
    "Safety guard must strip command-like tokens",
  );
  assert(
    Boolean(response.suggestedDraft?.length),
    "Safety guard must preserve advisory draft text",
  );
}

function verifyNoAutomaticCivicMutation(): void {
  console.log("6. No automatic civic mutation in assistant module");

  const moduleFiles = fs
    .readdirSync(ASSISTANT_MODULE_DIR, { recursive: true })
    .filter((file): file is string => typeof file === "string" && file.endsWith(".ts"));

  for (const relativeFile of moduleFiles) {
    const source = readRepoFile(
      path.join("apps/api/src/modules/workspace-assistant", relativeFile),
    );

    assert(!source.includes("publishInitiative("), `${relativeFile} must not publish initiatives`);
    assert(!source.includes("castVote("), `${relativeFile} must not cast votes`);
    assert(!source.includes("sendCivicDelivery("), `${relativeFile} must not send CAP`);
    assert(!source.includes("archiveCivicAccountability("), `${relativeFile} must not archive`);
  }
}

function verifyFrontendAdvisoryOnly(): void {
  console.log("7. Frontend displays advisory output only");

  const componentSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );

  assert(
    componentSource.includes("requestWorkspaceAssistantResponse"),
    "Frontend must call assistant respond endpoint",
  );
  assert(
    componentSource.includes("assistantResponse.assistantMessage"),
    "Frontend must render advisory message in panel",
  );
  assert(
    componentSource.includes("review before use"),
    "Frontend must label drafts as review-before-use",
  );
  assert(
    !componentSource.includes("setValue(") && !componentSource.includes("onUpdated("),
    "Frontend must not auto-insert generated text into forms",
  );
  assert(
    componentSource.includes('aria-disabled="true"') || componentSource.includes("disabled"),
    "Chat input must stay disabled",
  );
}

function verifyProviderImplementation(): void {
  console.log("8. Provider interface and env configuration");

  const providerSource = readRepoFile(
    "apps/api/src/modules/workspace-assistant/assistant-engine/workspace-assistant-provider.ts",
  );
  const configSource = readRepoFile(
    "apps/api/src/modules/workspace-assistant/assistant-engine/ai-assistant.config.ts",
  );
  const envExample = readRepoFile("apps/api/.env.example");

  assert(
    providerSource.includes("AiWorkspaceAssistantProvider"),
    "Resolver must include AI provider",
  );
  assert(providerSource.includes('case "ai_assisted"'), "Resolver must support ai_assisted mode");
  assert(configSource.includes("AI_PROVIDER"), "Config must read AI_PROVIDER");
  assert(configSource.includes("AI_API_KEY"), "Config must read AI_API_KEY");
  assert(configSource.includes("AI_MODEL"), "Config must read AI_MODEL");
  assert(configSource.includes("AI_TIMEOUT_MS"), "Config must read AI_TIMEOUT_MS");
  assert(configSource.includes("AI_MAX_TOKENS"), "Config must read AI_MAX_TOKENS");
  assert(
    envExample.includes("WORKSPACE_ASSISTANT_PROVIDER"),
    "Env example must document provider mode",
  );
  assert(envExample.includes("AI_API_KEY"), "Env example must document AI_API_KEY");
}

function verifyAiProviderFilesIsolated(): void {
  console.log("9. AI network calls isolated to provider files");

  const moduleFiles = fs
    .readdirSync(ASSISTANT_MODULE_DIR, { recursive: true })
    .filter((file): file is string => typeof file === "string" && file.endsWith(".ts"));

  for (const relativeFile of moduleFiles) {
    const basename = path.basename(relativeFile);

    if (AI_PROVIDER_FILES.has(basename)) {
      continue;
    }

    const source = readRepoFile(
      path.join("apps/api/src/modules/workspace-assistant", relativeFile),
    );

    assert(!source.includes("api.openai.com"), `${relativeFile} must not call OpenAI directly`);
    assert(
      !source.includes("openai"),
      `${relativeFile} must not reference openai outside provider`,
    );
  }
}

async function verifyResponsePrivacy(): Promise<void> {
  console.log("10. Response privacy model");

  process.env.WORKSPACE_ASSISTANT_PROVIDER = "mock";

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { generateWorkspaceAssistantResponse } =
    await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const draft = createInitiativeDraft(steward, {
    title: "AI Provider Initiative",
    description: "Verification initiative for response privacy.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const response = await generateWorkspaceAssistantResponse({
    participantId: steward.participantId,
    userId: "user-bootstrap-001",
    displayName: steward.displayName,
    initiativeId: projected.initiativeId,
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "explain_current_section",
      label: "Explain current section",
    },
    contextSnapshot: buildContextSnapshot(projected.initiativeId),
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  const serialized = JSON.stringify(response);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `Assistant response leaked private field: ${key}`);
  }
}

async function main(): Promise<void> {
  process.env.INITIATIVE_PERSISTENCE = "memory";

  await verifyMockModeStillWorks();
  await verifyAiAssistedRequiresEnv();
  await verifyPromptPrivacy();
  await verifyProhibitedActionsBlocked();
  await verifySafetyGuardStripsCommands();
  verifyNoAutomaticCivicMutation();
  verifyFrontendAdvisoryOnly();
  verifyProviderImplementation();
  verifyAiProviderFilesIsolated();
  await verifyResponsePrivacy();

  console.log("\nTASK-060 verify:ai-provider PASS");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
