import {
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  STAGING_RECONCILIATION_FLAG,
  isAllowedMigrationTargetDatabase,
  isApprovedSourceDatabase,
} from "./constants.js";

export class StagingReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingReconciliationError";
  }
}

export interface StagingReconciliationGuardInput {
  NODE_ENV?: string;
  PLATFORM_MODE?: string;
  ALLOW_STAGING_RECONCILIATION?: string;
  NODE_TEST_ENV?: string;
  sourceDatabase?: string;
  targetDatabase?: string;
  execute?: boolean;
}

export function assertStagingReconciliationExecuteGuards(
  env: StagingReconciliationGuardInput,
): void {
  if (env.NODE_ENV !== "production") {
    throw new StagingReconciliationError(
      "Refusing staging reconciliation execute: NODE_ENV must be production.",
    );
  }

  if (env.PLATFORM_MODE?.trim() !== "staging") {
    throw new StagingReconciliationError(
      "Refusing staging reconciliation execute: PLATFORM_MODE must be staging.",
    );
  }

  if (env.ALLOW_STAGING_RECONCILIATION !== "true") {
    throw new StagingReconciliationError(
      `Refusing staging reconciliation execute: set ${STAGING_RECONCILIATION_FLAG}=true to confirm.`,
    );
  }

  if (!env.execute) {
    throw new StagingReconciliationError(
      "Refusing staging reconciliation execute: --execute CLI flag is required.",
    );
  }

  assertStagingReconciliationDatabasePair({
    sourceDatabase: env.sourceDatabase,
    targetDatabase: env.targetDatabase,
    nodeTestEnv: env.NODE_TEST_ENV === "true",
  });
}

export function assertStagingReconciliationDatabasePair(input: {
  sourceDatabase?: string;
  targetDatabase?: string;
  nodeTestEnv?: boolean;
}): void {
  const source = input.sourceDatabase?.trim() ?? "";
  const target = input.targetDatabase?.trim() ?? "";

  if (!source || !target) {
    throw new StagingReconciliationError(
      "Refusing staging reconciliation: source and target logical database names are required.",
    );
  }

  if (source === target) {
    throw new StagingReconciliationError(
      "Refusing staging reconciliation: source database must not equal target database.",
    );
  }

  if (
    !isApprovedSourceDatabase(source) &&
    !(input.nodeTestEnv && source.startsWith("hu_test_"))
  ) {
    throw new StagingReconciliationError(
      `Refusing staging reconciliation: source database "${source}" is not approved (expected ${APPROVED_SOURCE_DATABASE}).`,
    );
  }

  if (!isAllowedMigrationTargetDatabase(target, { nodeTestEnv: input.nodeTestEnv })) {
    throw new StagingReconciliationError(
      `Refusing staging reconciliation: target database "${target}" is not allowed (expected ${APPROVED_TARGET_DATABASE}).`,
    );
  }
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function isBcryptHash(value: unknown): boolean {
  return typeof value === "string" && /^\$2[aby]?\$\d{2}\$/.test(value);
}
