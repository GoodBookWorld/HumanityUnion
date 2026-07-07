/**
 * TASK-046 — Workspace UX Consistency verification.
 * Run: npm run verify:workspace-ux
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PUBLIC_EXPERIENCE_DIR = path.join(REPO_ROOT, "apps/web/src/features/public-experience");

const WORKSPACE_SECTION_FILES = [
  "apps/web/src/features/execution-pipeline/components/CivicDeliveryWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/CivicAccountabilityWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/DecisionResultWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/OfficialResponsesWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativeImplementationTrackingWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativeImplementationCommitmentWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativePublicCivicArchiveWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativePublicImpactWorkspace.tsx",
  "apps/web/src/features/decision-session/components/DecisionSessionWorkspace.tsx",
  "apps/web/src/features/civic-compatibility-review/components/CivicCompatibilityReviewWorkspace.tsx",
  "apps/web/src/features/initiative-collaborative-analysis/components/InitiativeAnalysisWorkspace.tsx",
  "apps/web/src/features/initiative-improvement-proposal/components/InitiativeImprovementProposalStewardPanel.tsx",
  "apps/web/src/features/initiatives/components/InitiativeOverview.tsx",
  "apps/web/src/features/capability02-integration/components/WorkspaceCivicIntegrationPanel.tsx",
];

const FORBIDDEN_LINK_LABELS = [
  "Open Petition Workspace",
  "Open Collective Decision Workspace",
  "View public analysis",
  "Open page",
  "See page",
  "Read more",
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
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function verifySharedUxModule(): void {
  console.log("1. Shared workspace UX module");

  const requiredFiles = [
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
    "apps/web/src/features/initiative-workspace-ux/constants.ts",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceSectionShell.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceEmptyState.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceDeferredActions.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceStatusBadge.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspacePublicLink.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceLoadingState.tsx",
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceErrorState.tsx",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing UX module file: ${file}`);
  }

  const cssSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );
  assert(cssSource.includes(".workspace-section"), "UX CSS must define workspace section layout");
  assert(cssSource.includes(".workspace-empty__title"), "UX CSS must style empty state title");
  assert(cssSource.includes(".workspace-badge"), "UX CSS must define status badges");
  assert(
    cssSource.includes(".workspace-public-link::after"),
    "UX CSS must append arrow to public links",
  );
}

function verifyWorkspaceSectionStructure(): void {
  console.log("2. Consistent ProfileSection content structure");

  for (const file of WORKSPACE_SECTION_FILES) {
    const source = readRepoFile(file);
    assert(source.includes("WorkspaceSectionShell"), `${file} must use WorkspaceSectionShell`);
    assert(
      source.includes("purpose=") || source.includes('purpose="'),
      `${file} must include purpose text`,
    );
  }
}

function verifyEmptyStates(): void {
  console.log("3. Standardized empty states");

  const emptyStateSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceEmptyState.tsx",
  );

  assert(emptyStateSource.includes("workspace-empty__title"), "Empty state must render title");
  assert(
    emptyStateSource.includes("workspace-empty__explanation"),
    "Empty state must render explanation",
  );
  assert(
    emptyStateSource.includes("workspace-empty__next-step"),
    "Empty state must render next step",
  );

  const impactSource = readRepoFile(
    "apps/web/src/features/execution-pipeline/components/InitiativePublicImpactWorkspace.tsx",
  );
  assert(
    impactSource.includes('title="No public impact has been published yet"'),
    "Public impact empty state must use standardized title pattern",
  );
}

function verifyDeferredActions(): void {
  console.log("4. Standardized deferred actions");

  const constantsSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/constants.ts",
  );
  const deferredSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceDeferredActions.tsx",
  );

  assert(
    constantsSource.includes("Coming soon — Workspace API pending."),
    "Deferred API tooltip must use standard text",
  );
  assert(
    constantsSource.includes("Coming soon — Author workflow pending."),
    "Deferred author tooltip must use standard text",
  );
  assert(
    deferredSource.includes("WORKSPACE_DEFERRED_TOOLTIP"),
    "Deferred actions must use standard tooltip source",
  );

  const cssSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );
  assert(
    cssSource.includes("opacity: 0.55"),
    "Deferred disabled buttons must use standard opacity",
  );
}

function verifyPublicLinks(): void {
  console.log("5. Standardized public links");

  const publicLinkSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspacePublicLink.tsx",
  );
  assert(publicLinkSource.includes("workspace-public-link"), "Public links must use shared class");

  const workspaceSources = [
    ...WORKSPACE_SECTION_FILES,
    "apps/web/src/features/initiatives/components/ViewCollaborativeAnalysisLink.tsx",
    "apps/web/src/features/collective-decision/components/ViewCollectiveDecisionLink.tsx",
    "apps/web/src/features/petition/components/ViewPetitionLink.tsx",
  ].map((file) => readRepoFile(file));

  for (const label of FORBIDDEN_LINK_LABELS) {
    for (const source of workspaceSources) {
      assert(!source.includes(label), `Forbidden public link label found: ${label}`);
    }
  }

  assert(
    readRepoFile(
      "apps/web/src/features/collective-decision/components/ViewCollectiveDecisionLink.tsx",
    ).includes('label="View Collective Decision"'),
    "Collective decision link must use View label pattern",
  );
}

function verifyLoadingAndErrorStates(): void {
  console.log("6. Loading and error state consistency");

  const loadingSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceLoadingState.tsx",
  );
  const errorSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceErrorState.tsx",
  );

  assert(loadingSource.includes('role="status"'), "Loading state must expose status role");
  assert(loadingSource.includes("aria-live"), "Loading state must use aria-live");
  assert(errorSource.includes("workspace-error"), "Error state must use shared error class");
}

function verifyAssistantConsistency(): void {
  console.log("7. Workspace assistant alignment");

  const assistantSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );
  const cssSource = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );

  assert(
    assistantSource.includes("initiative-workspace-ux/initiative-workspace-ux.css"),
    "Assistant must import shared workspace UX styles",
  );
  assert(
    assistantSource.includes("confidenceLevel") && assistantSource.includes("safetyNotices"),
    "Assistant must show confidence and safety notices",
  );
  assert(
    cssSource.includes(".workspace-civic-assistant__message"),
    "Shared UX CSS must align assistant message cards",
  );
}

function verifyAccessibilityBasics(): void {
  console.log("8. Accessibility basics");

  const shellSource = readRepoFile("apps/web/src/components/member/ProfileSection.tsx");
  const assistantSource = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );

  assert(
    shellSource.includes("aria-labelledby"),
    "ProfileSection must label sections for assistive tech",
  );
  assert(
    assistantSource.includes("aria-expanded={mobileOpen}"),
    "Assistant mobile toggle must expose aria-expanded",
  );
  assert(
    assistantSource.includes('aria-label="Suggested actions"'),
    "Assistant actions need aria label",
  );
}

function verifyPublicExperienceUnchanged(): void {
  console.log("9. Public Experience unchanged");

  const publicExperienceFiles = listFilesRecursive(PUBLIC_EXPERIENCE_DIR).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
  );

  for (const file of publicExperienceFiles) {
    const source = fs.readFileSync(file, "utf-8");
    assert(
      !source.includes("initiative-workspace-ux"),
      `Public Experience must not import workspace UX module: ${path.relative(REPO_ROOT, file)}`,
    );
  }
}

function verifyCssConsolidation(): void {
  console.log("10. CSS consolidation");

  const pipelineCss = readRepoFile(
    "apps/web/src/features/execution-pipeline/components/execution-pipeline-workspace.css",
  );
  const initiativeWorkspace = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeWorkspace.tsx",
  );

  assert(
    pipelineCss.includes('@import "../../initiative-workspace-ux/initiative-workspace-ux.css"'),
    "Execution pipeline CSS must import shared workspace UX styles",
  );
  assert(
    initiativeWorkspace.includes("initiative-workspace-ux/initiative-workspace-ux.css"),
    "Initiative workspace must import shared UX stylesheet",
  );
}

function main(): void {
  verifySharedUxModule();
  verifyWorkspaceSectionStructure();
  verifyEmptyStates();
  verifyDeferredActions();
  verifyPublicLinks();
  verifyLoadingAndErrorStates();
  verifyAssistantConsistency();
  verifyAccessibilityBasics();
  verifyPublicExperienceUnchanged();
  verifyCssConsolidation();

  console.log("\nTASK-046 verify:workspace-ux PASS");
}

main();
