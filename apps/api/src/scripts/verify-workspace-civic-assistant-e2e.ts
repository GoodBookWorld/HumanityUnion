/**
 * TASK-043 — Workspace Civic Assistant Shell verification.
 * Run: npm run verify:workspace-civic-assistant
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const ASSISTANT_DIR = path.join(REPO_ROOT, "apps/web/src/features/workspace-civic-assistant");
const PUBLIC_EXPERIENCE_DIR = path.join(REPO_ROOT, "apps/web/src/features/public-experience");

const FORBIDDEN_ASSISTANT_TERMS = [
  "openai",
  "OpenAI",
  "gpt-",
  "gpt4",
  "anthropic",
  "chatCompletion",
  "generateText",
  "publishInitiative(",
  "sendCivicDelivery(",
  "castVote(",
  "verifyParticipation(",
  "archiveCivicAccountability(",
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
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
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function verifyAssistantFilesExist(): void {
  console.log("1. Assistant module files exist");

  const requiredFiles = [
    "apps/web/src/features/workspace-civic-assistant/constants.ts",
    "apps/web/src/features/workspace-civic-assistant/types.ts",
    "apps/web/src/features/workspace-civic-assistant/section-actions.ts",
    "apps/web/src/features/workspace-civic-assistant/build-assistant-context.ts",
    "apps/web/src/features/workspace-civic-assistant/use-workspace-section-tracker.ts",
    "apps/web/src/features/workspace-civic-assistant/initiative-workspace-sections.ts",
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
    "apps/web/src/features/initiatives/components/initiative-workspace-layout.css",
    "apps/web/src/features/execution-pipeline/components/InitiativePublicCivicArchiveWorkspace.tsx",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing required file: ${file}`);
  }
}

function verifyInitiativeWorkspaceIntegration(): void {
  console.log("2. Initiative workspace integration");

  const source = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeWorkspace.tsx",
  );

  assert(source.includes("WorkspaceCivicAssistant"), "InitiativeWorkspace must render assistant");
  assert(
    source.includes("useWorkspaceSectionTracker"),
    "InitiativeWorkspace must track current section",
  );
  assert(
    source.includes("initiative-workspace-layout"),
    "InitiativeWorkspace must use three-column layout wrapper",
  );
  assert(
    source.includes("currentSection={currentSection}"),
    "InitiativeWorkspace must pass current section to assistant",
  );
  assert(
    source.includes("InitiativePublicCivicArchiveWorkspace"),
    "InitiativeWorkspace must render Public Civic Archive section",
  );
}

async function verifyContextModel(): Promise<void> {
  console.log("3. Context model and integration layer usage");

  const { buildAssistantContext } = await import(
    pathToFileURL(
      path.join(
        REPO_ROOT,
        "apps/web/src/features/workspace-civic-assistant/build-assistant-context.ts",
      ),
    ).href
  );

  const context = buildAssistantContext({
    initiative: {
      initiativeId: "initiative-001",
      title: "Neighborhood Safety Initiative",
      description: "Improve lighting near the park.",
      lifecyclePhase: "published",
      communitySlug: "nelson-community-garden",
      activityArea: "Safety",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    },
    currentSection: "Collaborative Analysis",
    integrationView: {
      breadcrumb: [],
      context: {
        title: "Initiative",
        summary: "Summary",
        relatedSections: [],
      },
      pipelineStatus: {
        currentStageId: "collaborative_analysis",
        previousStageId: "civic_compatibility_review",
        nextAvailableStep: "Submit improvement proposal",
        completedStageIds: ["initiative", "civic_compatibility_review"],
      },
      relatedRecords: [{ recordId: "rec-1" }, { recordId: "rec-2" }],
    },
  });

  assert(context.initiativeId === "initiative-001", "Context must include initiativeId");
  assert(context.initiativeTitle.includes("Neighborhood"), "Context must include initiative title");
  assert(
    context.currentSection === "Collaborative Analysis",
    "Context must include current section",
  );
  assert(context.currentCivicStage?.includes("collaborative"), "Context must include civic stage");
  assert(
    context.nextAvailableStep === "Submit improvement proposal",
    "Context must include next available step",
  );
  assert(context.relatedRecordsCount === 2, "Context must include related records count");
  assert(context.visibilityLabel.length > 0, "Context must include visibility label");
  assert(context.contextSummary.length > 0, "Context must include summary");

  const buildSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/build-assistant-context.ts",
  );
  assert(
    buildSource.includes("pipelineStatus"),
    "Context builder must read pipeline status from integration view",
  );
  assert(
    buildSource.includes("relatedRecords"),
    "Context builder must read related records from integration view",
  );
}

async function verifySectionSpecificActions(): Promise<void> {
  console.log("4. Section-specific suggested actions");

  const { getSuggestedActionsForSection, SECTION_ACTION_SAMPLES } = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "apps/web/src/features/workspace-civic-assistant/section-actions.ts"),
    ).href
  );

  const draftInitiative = {
    initiativeId: "initiative-draft",
    title: "Draft Initiative",
    description: "Draft",
    lifecyclePhase: "draft" as const,
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };

  const draftActions = getSuggestedActionsForSection("Manage Initiative", draftInitiative);
  const analysisActions = getSuggestedActionsForSection("Collaborative Analysis", draftInitiative);
  const deliveryActions = getSuggestedActionsForSection("Civic Delivery", draftInitiative);
  const accountabilityActions = getSuggestedActionsForSection(
    "Civic Accountability",
    draftInitiative,
  );

  assert(draftActions.length >= 3, "Draft section must expose suggested actions");
  assert(analysisActions.length >= 3, "Analysis section must expose suggested actions");
  assert(deliveryActions.length >= 3, "Delivery section must expose suggested actions");
  assert(accountabilityActions.length >= 3, "Accountability section must expose suggested actions");

  const draftLabels = draftActions.map((action: { label: string }) => action.label).join("|");
  const analysisLabels = analysisActions.map((action: { label: string }) => action.label).join("|");
  const deliveryLabels = deliveryActions.map((action: { label: string }) => action.label).join("|");

  assert(draftLabels !== analysisLabels, "Draft and analysis actions must differ");
  assert(analysisLabels !== deliveryLabels, "Analysis and delivery actions must differ");

  assert(
    SECTION_ACTION_SAMPLES.draft[0]?.label !== SECTION_ACTION_SAMPLES.analysis[0]?.label,
    "SECTION_ACTION_SAMPLES must differ across sections",
  );
}

function verifyPlaceholderAndSafetyCopy(): void {
  console.log("5. Placeholder behavior and safety note");

  const constantsSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/constants.ts",
  );
  const componentSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );

  assert(
    constantsSource.includes(
      "AI assistance is not connected yet. This action is prepared for the future assistant engine.",
    ),
    "Placeholder message must be defined",
  );
  assert(
    constantsSource.includes(
      "Assistant suggestions are advisory. You remain responsible for all civic actions.",
    ),
    "Safety note must be defined",
  );
  assert(
    componentSource.includes("ASSISTANT_PLACEHOLDER_MESSAGE"),
    "Component must use placeholder message constant on action click",
  );
  assert(componentSource.includes("disabled"), "Chat input must be disabled or marked coming soon");
  assert(
    !componentSource.includes("generateText") && !componentSource.includes("openai"),
    "Component must not call AI providers",
  );
}

function verifyResponsiveAndAccessibility(): void {
  console.log("6. Responsive collapse and accessibility basics");

  const cssSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );
  const componentSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );

  assert(cssSource.includes("position: sticky"), "Assistant sidebar must use sticky positioning");
  assert(
    cssSource.includes("@media (max-width: 1024px)"),
    "Assistant must collapse on smaller screens",
  );
  assert(
    componentSource.includes("aria-expanded={mobileOpen}"),
    "Mobile toggle must expose aria-expanded",
  );
  assert(
    componentSource.includes('aria-label="Suggested actions"'),
    "Suggested actions need aria label",
  );
  assert(
    componentSource.includes('aria-label="Assistant conversation"'),
    "Chat panel needs aria label",
  );
  assert(
    componentSource.includes('aria-label="Civic assistant sidebar"'),
    "Aside needs aria label",
  );
}

function verifyNoAiOrAutomaticActions(): void {
  console.log("7. No AI backend or automatic civic actions in assistant module");

  const assistantFiles = listFilesRecursive(ASSISTANT_DIR).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
  );

  for (const file of assistantFiles) {
    const source = fs.readFileSync(file, "utf-8");

    for (const term of FORBIDDEN_ASSISTANT_TERMS) {
      assert(!source.includes(term), `${path.relative(REPO_ROOT, file)} must not include: ${term}`);
    }
  }

  const componentSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );

  assert(
    componentSource.includes("getCivicIntegrationView"),
    "Assistant may read existing civic integration context only",
  );
  assert(
    !componentSource.includes("navigator.sendBeacon") &&
      !componentSource.includes("analytics") &&
      !componentSource.includes("telemetry"),
    "Assistant must not emit telemetry",
  );
}

function verifyPublicExperienceUnchanged(): void {
  console.log("8. Public Experience unchanged");

  const publicExperienceFiles = listFilesRecursive(PUBLIC_EXPERIENCE_DIR).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
  );

  for (const file of publicExperienceFiles) {
    const source = fs.readFileSync(file, "utf-8");
    assert(
      !source.includes("WorkspaceCivicAssistant"),
      `Public Experience file must not import assistant: ${path.relative(REPO_ROOT, file)}`,
    );
  }

  const publicInitiativePage = readRepoFile(
    "apps/web/src/app/initiatives/public/[initiativeId]/page.tsx",
  );
  assert(
    !publicInitiativePage.includes("WorkspaceCivicAssistant"),
    "Public initiative page must not render workspace assistant",
  );
}

function verifyInitiativesPageNavigation(): void {
  console.log("9. Initiative workspace navigation covers assistant sections");

  const pageSource = readRepoFile("apps/web/src/app/initiatives/page.tsx");
  const sectionsSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/initiative-workspace-sections.ts",
  );

  assert(
    pageSource.includes("INITIATIVE_WORKSPACE_SECTIONS"),
    "Initiatives page must derive nav items from workspace sections",
  );
  assert(
    sectionsSource.includes("Civic Integration"),
    "Workspace sections must include Civic Integration",
  );
  assert(
    sectionsSource.includes("Civic Accountability"),
    "Workspace sections must include Civic Accountability",
  );
  assert(
    sectionsSource.includes("Public Civic Archive"),
    "Workspace sections must include Public Civic Archive",
  );
}

async function main(): Promise<void> {
  verifyAssistantFilesExist();
  verifyInitiativeWorkspaceIntegration();
  await verifyContextModel();
  await verifySectionSpecificActions();
  verifyPlaceholderAndSafetyCopy();
  verifyResponsiveAndAccessibility();
  verifyNoAiOrAutomaticActions();
  verifyPublicExperienceUnchanged();
  verifyInitiativesPageNavigation();

  console.log("\nTASK-043 verify:workspace-civic-assistant PASS");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
