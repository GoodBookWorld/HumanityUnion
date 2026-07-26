/**
 * TASK-056 — Workspace Intelligence Engine verification.
 * Run: npm run verify:workspace-intelligence
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const INTELLIGENCE_MODULE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/workspace-intelligence");
const ASSISTANT_WEB_DIR = path.join(REPO_ROOT, "apps/web/src/features/workspace-civic-assistant");

const FORBIDDEN_TERMS = [
  "openai",
  "OpenAI",
  "gpt-",
  "anthropic",
  "chatCompletion",
  "generateText",
  'fetch("https://',
  "axios.get",
  "ollama",
] as const;

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "userId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "voteId",
  "transparencyCohort",
  "jwt",
] as const;

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

function verifyModuleStructure(): void {
  console.log("1. Workspace intelligence module structure");

  const requiredFiles = [
    "workspace-intelligence.service.ts",
    "workspace-intelligence.rules.ts",
    "workspace-intelligence.context.ts",
    "workspace-intelligence.routes.ts",
    "workspace-intelligence.types.ts",
    "workspace-intelligence.explanations.ts",
    "workspace-intelligence.registry.ts",
    "index.ts",
  ];

  for (const file of requiredFiles) {
    assert(
      fs.existsSync(path.join(INTELLIGENCE_MODULE_DIR, file)),
      `Missing intelligence module file: ${file}`,
    );
  }

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(
    appSource.includes("workspaceIntelligenceRouter"),
    "App must mount workspace intelligence router",
  );
  assert(
    readRepoFile(
      "apps/api/src/modules/workspace-intelligence/workspace-intelligence.routes.ts",
    ).includes('"/intelligence"'),
    "Intelligence route must expose GET /intelligence",
  );
}

function verifyRegistryPlaceholder(): void {
  console.log("2. Rule registry");
}

function verifyNoAiProviders(): void {
  console.log("3. No AI providers or external HTTP");

  const intelligenceFiles = listFilesRecursive(INTELLIGENCE_MODULE_DIR).filter((file) =>
    file.endsWith(".ts"),
  );

  for (const file of intelligenceFiles) {
    const source = fs.readFileSync(file, "utf-8");

    for (const term of FORBIDDEN_TERMS) {
      assert(!source.includes(term), `${path.relative(REPO_ROOT, file)} must not include: ${term}`);
    }
  }
}

async function verifyContextAndDraftRecommendation(): Promise<void> {
  console.log("4. Context creation and draft initiative recommendation");

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { getWorkspaceIntelligence } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Intelligence Draft Initiative",
    description: "Verification initiative for workspace intelligence.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const intelligence = await getWorkspaceIntelligence({
    identity: steward,
    userId: "user-intelligence-verify",
    displayName: steward.displayName,
    initiativeId: draft.initiativeId,
    currentSection: "Manage Initiative",
  });

  assert(
    intelligence.context.initiative?.initiativeId === draft.initiativeId,
    "Context must include initiative",
  );
  assert(intelligence.currentCivicStage !== null, "Context must include civic stage");
  assert(
    intelligence.suggestions.some((item) => item.suggestionId === "publish-initiative"),
    "Draft initiative must suggest publishing",
  );
  assert(
    intelligence.topRecommendation?.suggestionId === "publish-initiative",
    "Publish initiative must be top recommendation for draft",
  );
  assert(
    (intelligence.topRecommendation?.constitutionalReference.length ?? 0) > 0,
    "Top recommendation must include constitutional reference",
  );
}

async function verifyPriorityOrdering(): Promise<void> {
  console.log("5. Priority ordering");

  const { priorityWeight } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  assert(
    priorityWeight("critical") < priorityWeight("important"),
    "Critical must outrank important",
  );
  assert(priorityWeight("important") < priorityWeight("normal"), "Important must outrank normal");
  assert(
    priorityWeight("normal") < priorityWeight("informational"),
    "Normal must outrank informational",
  );
}

async function verifyPublishedPipelineRecommendations(): Promise<void> {
  console.log("6. Published initiative pipeline recommendations");

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { getWorkspaceIntelligence } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Intelligence Published Initiative",
    description: "Published initiative for intelligence verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const published = publishInitiative(steward, draft.initiativeId);

  const intelligence = await getWorkspaceIntelligence({
    identity: steward,
    userId: "user-intelligence-verify",
    displayName: steward.displayName,
    initiativeId: published.initiativeId,
    currentSection: "Collaborative Analysis",
  });

  assert(
    intelligence.suggestions.some((item) => item.suggestionId === "begin-collaborative-analysis"),
    "Published initiative without analysis must suggest beginning analysis",
  );
  assert(
    intelligence.nextCivicMilestone !== null,
    "Published initiative must expose next milestone",
  );
}

async function verifyBlockedActionsAndAccess(): Promise<void> {
  console.log("7. Blocked action detection and access control");

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { getWorkspaceIntelligence } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Intelligence Access Initiative",
    description: "Access control verification initiative.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  await assertThrowsAsync(
    () =>
      getWorkspaceIntelligence({
        identity: otherParticipant,
        userId: "user-intelligence-other",
        displayName: otherParticipant.displayName,
        initiativeId: draft.initiativeId,
      }),
    "do not have access",
  );

  const nonStewardPublished = await getWorkspaceIntelligence({
    identity: otherParticipant,
    userId: "user-intelligence-other",
    displayName: otherParticipant.displayName,
  });

  assert(
    nonStewardPublished.blockedActions.some((item) =>
      item.blockedBy.includes("Participation Area"),
    ),
    "Missing participation area must produce blocked action",
  );
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

async function verifySectionAwareSuggestions(): Promise<void> {
  console.log("8. Section-aware suggestions");

  const { getWorkspaceIntelligence } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  const intelligence = await getWorkspaceIntelligence({
    identity: steward,
    userId: "user-intelligence-verify",
    displayName: steward.displayName,
    currentSection: "Participation Area",
  });

  assert(
    intelligence.suggestions.some((item) => item.suggestionId === "section-participation-area"),
    "Participation Area section must produce section-specific suggestion",
  );
}

async function verifyPrivacySanitization(): Promise<void> {
  console.log("9. Privacy sanitization");

  const { sanitizeWorkspaceIntelligenceResponse } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");
  const { getWorkspaceIntelligence } =
    await import("../modules/workspace-intelligence/workspace-intelligence.service.js");

  const intelligence = await getWorkspaceIntelligence({
    identity: steward,
    userId: "user-intelligence-verify",
    displayName: steward.displayName,
  });

  const serialized = JSON.stringify(intelligence).toLowerCase();

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key.toLowerCase()}"`), `Response must not expose ${key}`);
  }

  assertThrows(
    () =>
      sanitizeWorkspaceIntelligenceResponse({
        ...intelligence,
        context: {
          ...intelligence.context,
          participantId: "hidden",
        } as typeof intelligence.context,
      }),
    "must not expose participantId",
  );
}

function verifyFrontendIntegration(): void {
  console.log("10. Frontend intelligence integration");

  const apiSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/workspace-intelligence-api.ts",
  );
  const panelSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceIntelligencePanel.tsx",
  );
  const civicAssistantSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );
  const intelligenceHookSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/use-workspace-intelligence.ts",
  );
  const homeAssistantSource = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspaceHomeAssistant.tsx",
  );

  assert(
    apiSource.includes("/api/v1/workspace-assistant/intelligence"),
    "Web client must call intelligence API",
  );
  assert(panelSource.includes("Top recommendation"), "Panel must render top recommendation");
  assert(
    panelSource.includes("Secondary recommendations"),
    "Panel must render secondary recommendations",
  );
  assert(panelSource.includes("Blocked items"), "Panel must render blocked items");
  assert(
    panelSource.includes("Constitutional explanation"),
    "Panel must render constitutional explanation",
  );
  assert(
    civicAssistantSource.includes("useWorkspaceIntelligence"),
    "Civic assistant must use intelligence hook",
  );
  assert(
    homeAssistantSource.includes("useWorkspaceIntelligence"),
    "Home assistant must use intelligence hook",
  );
  assert(
    civicAssistantSource.includes("requestWorkspaceAssistantResponse"),
    "Civic assistant action buttons must call advisory respond endpoint",
  );
  assert(
    !intelligenceHookSource.includes("requestWorkspaceAssistantResponse"),
    "Intelligence hook must not call advisory respond endpoint for suggestions",
  );

  const assistantWebFiles = listFilesRecursive(ASSISTANT_WEB_DIR).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
  );

  for (const file of assistantWebFiles) {
    const source = fs.readFileSync(file, "utf-8");

    for (const term of ["openai", "OpenAI", "anthropic", "generateText"]) {
      assert(!source.includes(term), `${path.relative(REPO_ROOT, file)} must not include ${term}`);
    }
  }
}

function verifyDocumentation(): void {
  console.log("11. Documentation");

  const docPath = path.join(REPO_ROOT, "docs/WORKSPACE_INTELLIGENCE_ENGINE.md");
  assert(fs.existsSync(docPath), "WORKSPACE_INTELLIGENCE_ENGINE.md must exist");

  const doc = fs.readFileSync(docPath, "utf-8");
  assert(doc.includes("Rule engine"), "Documentation must describe rule engine");
  assert(doc.includes("Constitutional"), "Documentation must describe constitutional explanations");
  assert(doc.includes("LLM"), "Documentation must describe deferred AI integration");
}

async function verifyRegistryLoaded(): Promise<void> {
  const registry =
    await import("../modules/workspace-intelligence/workspace-intelligence.registry.js");
  assert(
    registry.WORKSPACE_INTELLIGENCE_RULES.length >= 2,
    "Registry must include intelligence rules",
  );

  for (const rule of registry.WORKSPACE_INTELLIGENCE_RULES) {
    assert(typeof rule.id === "string", "Rule must have id");
    assert(typeof rule.description === "string", "Rule must have description");
    assert(typeof rule.evaluate === "function", "Rule must have evaluation function");
  }

  for (const rule of registry.WORKSPACE_INTELLIGENCE_BLOCKED_RULES) {
    assert(typeof rule.id === "string", "Blocked rule must have id");
    assert(typeof rule.evaluate === "function", "Blocked rule must have evaluation function");
  }
}

async function main(): Promise<void> {
  verifyModuleStructure();
  verifyRegistryPlaceholder();
  await verifyRegistryLoaded();
  verifyNoAiProviders();
  await verifyContextAndDraftRecommendation();
  await verifyPriorityOrdering();
  await verifyPublishedPipelineRecommendations();
  await verifyBlockedActionsAndAccess();
  await verifySectionAwareSuggestions();
  await verifyPrivacySanitization();
  verifyFrontendIntegration();
  verifyDocumentation();

  console.log("\nTASK-056 verify:workspace-intelligence PASS");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
