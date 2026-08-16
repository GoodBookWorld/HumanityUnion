import {
  APPROVED_TARGET_DATABASE,
  STAGING_MEDIA_MIGRATION_FLAG,
  isAllowedMediaMigrationTargetDatabase,
} from "./constants.js";

export class StagingHistoricalMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingHistoricalMediaError";
  }
}

export interface StagingMediaMigrationGuardInput {
  NODE_ENV?: string;
  PLATFORM_MODE?: string;
  ALLOW_STAGING_MEDIA_MIGRATION?: string;
  MEDIA_STORAGE_PROVIDER?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
  NODE_TEST_ENV?: string;
  targetDatabase?: string;
  execute?: boolean;
  /** When true (tests), allow MEDIA_STORAGE_PROVIDER=memory. */
  allowMemoryProvider?: boolean;
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function assertStagingMediaMigrationExecuteGuards(
  env: StagingMediaMigrationGuardInput,
): void {
  if (env.NODE_ENV !== "production") {
    throw new StagingHistoricalMediaError(
      "Refusing staging media migration execute: NODE_ENV must be production.",
    );
  }
  if (env.PLATFORM_MODE?.trim() !== "staging") {
    throw new StagingHistoricalMediaError(
      "Refusing staging media migration execute: PLATFORM_MODE must be staging.",
    );
  }
  if (env.ALLOW_STAGING_MEDIA_MIGRATION !== "true") {
    throw new StagingHistoricalMediaError(
      `Refusing staging media migration execute: set ${STAGING_MEDIA_MIGRATION_FLAG}=true.`,
    );
  }
  if (!env.execute) {
    throw new StagingHistoricalMediaError(
      "Refusing staging media migration execute: --execute CLI flag is required.",
    );
  }

  const provider = env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (provider === "memory" && env.allowMemoryProvider) {
    // isolated automated tests only
  } else if (provider !== "r2") {
    throw new StagingHistoricalMediaError(
      "Refusing staging media migration execute: MEDIA_STORAGE_PROVIDER must be r2.",
    );
  } else {
    const required = [
      env.R2_ACCOUNT_ID,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY,
      env.R2_BUCKET,
      env.R2_PUBLIC_BASE_URL,
    ];
    if (required.some((value) => !value?.trim())) {
      throw new StagingHistoricalMediaError(
        "Refusing staging media migration execute: R2 configuration is incomplete.",
      );
    }
  }

  const database = env.targetDatabase?.trim() ?? "";
  if (
    !isAllowedMediaMigrationTargetDatabase(database, {
      nodeTestEnv: env.NODE_TEST_ENV === "true",
    })
  ) {
    throw new StagingHistoricalMediaError(
      `Refusing staging media migration: target database "${database}" is not allowed (expected ${APPROVED_TARGET_DATABASE}).`,
    );
  }
}
