import {
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  STAGING_DATA_MIGRATION_FLAG,
  isAllowedMigrationTargetDatabase,
  isApprovedSourceDatabase,
} from "./constants.js";

export class StagingDataMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingDataMigrationError";
  }
}

export interface StagingDataMigrationGuardInput {
  NODE_ENV?: string;
  PLATFORM_MODE?: string;
  ALLOW_STAGING_DATA_MIGRATION?: string;
  NODE_TEST_ENV?: string;
  sourceDatabase?: string;
  targetDatabase?: string;
  execute?: boolean;
}

/**
 * Pure execute-mode guards. Dry-run may skip NODE_ENV / PLATFORM_MODE / allow flag
 * but still validates source/target logical names when provided.
 */
export function assertStagingDataMigrationExecuteGuards(
  env: StagingDataMigrationGuardInput,
): void {
  if (env.NODE_ENV !== "production") {
    throw new StagingDataMigrationError(
      "Refusing staging data migration execute: NODE_ENV must be production.",
    );
  }

  if (env.PLATFORM_MODE?.trim() !== "staging") {
    throw new StagingDataMigrationError(
      "Refusing staging data migration execute: PLATFORM_MODE must be staging.",
    );
  }

  if (env.ALLOW_STAGING_DATA_MIGRATION !== "true") {
    throw new StagingDataMigrationError(
      `Refusing staging data migration execute: set ${STAGING_DATA_MIGRATION_FLAG}=true to confirm.`,
    );
  }

  if (!env.execute) {
    throw new StagingDataMigrationError(
      "Refusing staging data migration execute: --execute CLI flag is required.",
    );
  }

  assertStagingDataMigrationDatabasePair({
    sourceDatabase: env.sourceDatabase,
    targetDatabase: env.targetDatabase,
    nodeTestEnv: env.NODE_TEST_ENV === "true",
  });
}

export function assertStagingDataMigrationDatabasePair(input: {
  sourceDatabase?: string;
  targetDatabase?: string;
  nodeTestEnv?: boolean;
}): void {
  const source = input.sourceDatabase?.trim() ?? "";
  const target = input.targetDatabase?.trim() ?? "";

  if (!source || !target) {
    throw new StagingDataMigrationError(
      "Refusing staging data migration: source and target logical database names are required.",
    );
  }

  if (source === target) {
    throw new StagingDataMigrationError(
      "Refusing staging data migration: source database must not equal target database.",
    );
  }

  if (!isApprovedSourceDatabase(source) && !(input.nodeTestEnv && source.startsWith("hu_test_"))) {
    throw new StagingDataMigrationError(
      `Refusing staging data migration: source database "${source}" is not approved (expected ${APPROVED_SOURCE_DATABASE}).`,
    );
  }

  if (!isAllowedMigrationTargetDatabase(target, { nodeTestEnv: input.nodeTestEnv })) {
    throw new StagingDataMigrationError(
      `Refusing staging data migration: target database "${target}" is not allowed (expected ${APPROVED_TARGET_DATABASE}).`,
    );
  }

  if (target === APPROVED_SOURCE_DATABASE) {
    throw new StagingDataMigrationError(
      "Refusing staging data migration: target must not be humanity_union_dev.",
    );
  }
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function assertDryRunPerformsNoWrites(argv: readonly string[] = process.argv): void {
  if (isExecuteModeRequested(argv) && process.env.ALLOW_STAGING_DATA_MIGRATION !== "true") {
    throw new StagingDataMigrationError(
      `Refusing --execute without ${STAGING_DATA_MIGRATION_FLAG}=true.`,
    );
  }
}
