import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { getPersistenceMode } from "./public-civic-archive.store.js";

export function logCivicArchiveRuntimeDiagnostic(): void {
  const database = process.env.MONGODB_DATABASE?.trim() || "unset";
  const verificationMode = process.env.HU_VERIFICATION_MODE === "true";
  const persistence = getPersistenceMode();
  const collection = MONGO_COLLECTIONS.publicCivicArchiveRecords;

  console.log(
    `[civic-archive] database=${database} persistence=${persistence} collection=${collection} verificationMode=${verificationMode}`,
  );
}

export function assertNormalCivicArchiveRuntimeDatabase(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (process.env.HU_VERIFICATION_MODE === "true") {
    console.warn(
      "[civic-archive] HU_VERIFICATION_MODE=true during API startup. Public archive queries must not run in verification mode.",
    );
  }

  const database = process.env.MONGODB_DATABASE?.trim();

  if (database?.startsWith("humanity_union_verify_")) {
    throw new Error(
      "Civic Archive API startup refused: verification database must not be used for normal runtime.",
    );
  }

  if (
    isMongoConfigured() &&
    database === "humanity_union_dev" &&
    getPersistenceMode() === "file" &&
    !process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE?.trim()
  ) {
    console.warn(
      "[civic-archive] MongoDB is configured for humanity_union_dev but civic archive persistence defaulted to file. Set PUBLIC_CIVIC_ARCHIVE_PERSISTENCE=mongodb or rely on the automatic Mongo default.",
    );
  }
}
