/**
 * TASK-045 — Workspace Assistant Engine verification.
 * Run: npm run verify:workspace-assistant-engine
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const ASSISTANT_MODULE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/workspace-assistant");
const PUBLIC_EXPERIENCE_DIR = path.join(REPO_ROOT, "apps/web/src/features/public-experience");

const FORBIDDEN_TERMS = [
  "openai",
  "OpenAI",
  "gpt-",
  "anthropic",
  "chatCompletion",
  "generateText",
  'fetch("https://',
  "axios",
  "nodemailer",
];

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "stewardId",
  "authorId",
  "memberId",
  "email",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
  "voteId",
  "transparencyCohort",
];

const steward = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const otherParticipant = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
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

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function listFilesRecursive(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildContextSnapshot(initiativeId: string) {
  return {
    initiativeId,
    initiativeTitle: "Assistant Engine Initiative",
    lifecyclePhase: "projected",
    currentSection: "Collaborative Analysis",
    currentSectionLabel: "Collaborative Analysis",
    currentCivicStage: "collaborative analysis",
    nextAvailableStep: "Submit improvement proposal",
    relatedRecordsCount: 1,
    visibilityLabel: "Public record available",
    contextSummary: "Workspace assistant context snapshot for verification.",
  };
}

async function verifyDomainTypes(): Promise<void> {
  console.log("1. Assistant engine domain types");

  const typesSource = readRepoFile("packages/types/src/domain/workspace-assistant.ts");
  const indexSource = readRepoFile("packages/types/src/domain/index.ts");

  assert(typesSource.includes("WorkspaceAssistantRequest"), "Domain must define request type");
  assert(typesSource.includes("WorkspaceAssistantResponse"), "Domain must define response type");
  assert(typesSource.includes("WorkspaceAssistantCapability"), "Domain must define capabilities");
  assert(
    typesSource.includes("WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS"),
    "Domain must define prohibited actions",
  );
  assert(
    indexSource.includes("workspace-assistant.js"),
    "Domain index must export assistant types",
  );
}

async function verifyMockProvider(): Promise<void> {
  console.log("2. Mock provider behavior");

  const { MockWorkspaceAssistantProvider } =
    await import("../modules/workspace-assistant/assistant-engine/mock-workspace-assistant-provider.js");

  const provider = new MockWorkspaceAssistantProvider();
  const response = provider.generateAssistantResponse({
    participantId: steward.participantId,
    initiativeId: "initiative-test",
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "strengthen_evidence",
      label: "Strengthen evidence",
    },
    contextSnapshot: buildContextSnapshot("initiative-test"),
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  assert(response.mode === "mock", "Mock provider must return mock mode");
  assert(
    response.confidenceLevel === "not_applicable",
    "Mock provider confidence must be not_applicable",
  );
  assert(
    response.assistantMessage.includes("Strengthen evidence"),
    "Mock provider must echo requested action label",
  );
  assert(!response.suggestedDraft, "Mock provider must not return generated civic draft content");
  assert(
    response.safetyNotices.some((notice) => notice.code === "advisory_only"),
    "Mock provider must include advisory safety notice",
  );
}

async function verifySafetyGuardAndService(): Promise<void> {
  console.log("3. Safety guard and authenticated service flow");

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { respondToWorkspaceAssistant } =
    await import("../modules/workspace-assistant/workspace-assistant.service.js");
  const {
    applyWorkspaceAssistantSafetyGuard,
    assertAllowedWorkspaceAssistantCapability,
    generateWorkspaceAssistantResponse,
    sanitizeWorkspaceAssistantContextSnapshot,
  } = await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const draft = createInitiativeDraft(steward, {
    title: "Assistant Engine Initiative",
    description: "Verification initiative for workspace assistant engine.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);
  const snapshot = buildContextSnapshot(projected.initiativeId);

  const response = respondToWorkspaceAssistant(steward, {
    initiativeId: projected.initiativeId,
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "strengthen_evidence",
      label: "Strengthen evidence",
    },
    contextSnapshot: snapshot,
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  assert(response.responseId.length > 0, "Service must return responseId");
  assert(response.confidenceLevel === "not_applicable", "Service must return confidence level");
  assert(response.safetyNotices.length > 0, "Service must return safety notices");

  assertThrows(
    () =>
      respondToWorkspaceAssistant(steward, {
        participantId: otherParticipant.participantId,
        initiativeId: projected.initiativeId,
        currentSection: "Collaborative Analysis",
        requestedAction: {
          capability: "strengthen_evidence",
          label: "Strengthen evidence",
        },
        contextSnapshot: snapshot,
        timestamp: "2026-07-06T00:00:00.000Z",
      }),
    "participantId cannot be supplied",
  );

  assertThrows(
    () =>
      respondToWorkspaceAssistant(otherParticipant, {
        initiativeId: projected.initiativeId,
        currentSection: "Collaborative Analysis",
        requestedAction: {
          capability: "strengthen_evidence",
          label: "Strengthen evidence",
        },
        contextSnapshot: snapshot,
        timestamp: "2026-07-06T00:00:00.000Z",
      }),
    "do not have access",
  );

  assertThrows(
    () => assertAllowedWorkspaceAssistantCapability("publish_initiative"),
    "Unknown assistant capability",
  );

  assertThrows(
    () =>
      generateWorkspaceAssistantResponse({
        participantId: steward.participantId,
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

  assertThrows(
    () =>
      sanitizeWorkspaceAssistantContextSnapshot({
        ...snapshot,
        participantId: steward.participantId,
      } as typeof snapshot & { participantId: string }),
    "must not include private field",
  );

  assertThrows(
    () =>
      applyWorkspaceAssistantSafetyGuard({
        responseId: "blocked-response",
        mode: "mock",
        assistantMessage: "Please publish initiative immediately.",
        confidenceLevel: "low",
        safetyNotices: [{ code: "advisory_only", message: "Advisory only." }],
        followUpPrompts: [],
        prohibitedActions: [],
        createdAt: "2026-07-06T00:00:00.000Z",
      }),
    "blocked by safety guard",
  );
}

function verifyProviderResolverAndRoute(): void {
  console.log("4. Provider resolver and backend route");

  const providerSource = readRepoFile(
    "apps/api/src/modules/workspace-assistant/assistant-engine/workspace-assistant-provider.ts",
  );
  const routesSource = readRepoFile(
    "apps/api/src/modules/workspace-assistant/workspace-assistant.routes.ts",
  );
  const appSource = readRepoFile("apps/api/src/app.ts");

  assert(
    providerSource.includes("WORKSPACE_ASSISTANT_PROVIDER"),
    "Provider resolver must read WORKSPACE_ASSISTANT_PROVIDER",
  );
  assert(
    providerSource.includes("MockWorkspaceAssistantProvider"),
    "Provider resolver must support mock provider",
  );
  assert(
    routesSource.includes('post("/respond"'),
    "Workspace assistant route must expose POST /respond",
  );
  assert(routesSource.includes("authenticationMiddleware"), "Route must require authentication");
  assert(routesSource.includes("resolveRequestIdentity"), "Route must resolve RequestIdentity");
  assert(
    appSource.includes('/api/v1/workspace-assistant", workspaceAssistantRouter'),
    "app.ts must register workspace assistant router",
  );
}

function verifyNoAiOrExternalNetwork(): void {
  console.log("5. No AI provider or external network calls");

  const moduleFiles = listFilesRecursive(ASSISTANT_MODULE_DIR).filter(
    (file) => file.endsWith(".ts") && !file.endsWith(".d.ts"),
  );

  for (const file of moduleFiles) {
    const source = fs.readFileSync(file, "utf-8");

    for (const term of FORBIDDEN_TERMS) {
      assert(!source.includes(term), `${path.relative(REPO_ROOT, file)} must not include ${term}`);
    }
  }
}

function verifyFrontendIntegration(): void {
  console.log("6. Frontend integration with mock endpoint");

  const componentSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );
  const apiSource = readRepoFile("apps/web/src/features/workspace-civic-assistant/api.ts");

  assert(
    apiSource.includes("/api/v1/workspace-assistant/respond"),
    "Frontend API must call workspace assistant respond endpoint",
  );
  assert(
    componentSource.includes("requestWorkspaceAssistantResponse"),
    "Assistant UI must call mock engine endpoint",
  );
  assert(componentSource.includes("confidenceLevel"), "Assistant UI must display confidence level");
  assert(componentSource.includes("safetyNotices"), "Assistant UI must display safety notices");
  assert(componentSource.includes('aria-disabled="true"'), "Chat input must remain disabled");
  assert(
    !componentSource.includes("setValue(") && !componentSource.includes("onUpdated("),
    "Assistant UI must not auto-insert generated content into forms",
  );
}

function verifyPublicExperienceUnchanged(): void {
  console.log("7. Public Experience unchanged");

  const publicExperienceFiles = listFilesRecursive(PUBLIC_EXPERIENCE_DIR).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
  );

  for (const file of publicExperienceFiles) {
    const source = fs.readFileSync(file, "utf-8");
    assert(
      !source.includes("workspace-assistant") && !source.includes("WorkspaceCivicAssistant"),
      `Public Experience must not import assistant engine: ${path.relative(REPO_ROOT, file)}`,
    );
  }
}

async function verifyResponsePrivacy(): Promise<void> {
  console.log("8. Response privacy model");

  const { generateWorkspaceAssistantResponse } =
    await import("../modules/workspace-assistant/workspace-assistant-safety-guard.js");

  const response = generateWorkspaceAssistantResponse({
    participantId: steward.participantId,
    initiativeId: "initiative-test",
    currentSection: "Collaborative Analysis",
    requestedAction: {
      capability: "explain_current_section",
      label: "Explain current section",
    },
    contextSnapshot: buildContextSnapshot("initiative-test"),
    timestamp: "2026-07-06T00:00:00.000Z",
  });

  const serialized = JSON.stringify(response);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `Assistant response leaked private field: ${key}`);
  }
}

async function main(): Promise<void> {
  process.env.WORKSPACE_ASSISTANT_PROVIDER = "mock";
  process.env.INITIATIVE_PERSISTENCE = "memory";

  await verifyDomainTypes();
  await verifyMockProvider();
  await verifySafetyGuardAndService();
  verifyProviderResolverAndRoute();
  verifyNoAiOrExternalNetwork();
  verifyFrontendIntegration();
  verifyPublicExperienceUnchanged();
  await verifyResponsePrivacy();

  console.log("\nTASK-045 verify:workspace-assistant-engine PASS");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
