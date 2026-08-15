import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoApiSrc = path.resolve(here, "../../../src");

describe("Initiative Mongo bootstrap ordering", () => {
  it("does not persist bootstrap seed during module import for mongodb mode", () => {
    const storeSource = readFileSync(
      path.join(repoApiSrc, "modules/initiatives/initiative.store.ts"),
      "utf8",
    );

    assert.match(
      storeSource,
      /if \(seededBootstrap && persistence\.mode !== ["']mongodb["']\)/,
      "seed persist at import must skip mongodb mode",
    );
    assert.match(
      storeSource,
      /export function syncInitiativeStoreAfterMongoHydrate/,
      "store must expose post-hydrate sync for Mongo bootstrap",
    );
  });

  it("bootstraps Initiative store sync after Mongo hydrate + flush", () => {
    const bootstrapSource = readFileSync(
      path.join(repoApiSrc, "infrastructure/mongodb/bootstrap-mongo-persistence.ts"),
      "utf8",
    );

    assert.match(bootstrapSource, /hydrateInitiativeMongoPersistence/);
    assert.match(bootstrapSource, /syncInitiativeStoreAfterMongoHydrate/);
    assert.match(bootstrapSource, /flushInitiativeMongoPersistence/);

    const hydrateIdx = bootstrapSource.indexOf("hydrateInitiativeMongoPersistence");
    const syncIdx = bootstrapSource.indexOf("syncInitiativeStoreAfterMongoHydrate");
    const flushIdx = bootstrapSource.indexOf("flushInitiativeMongoPersistence();");

    assert.ok(hydrateIdx >= 0 && syncIdx > hydrateIdx, "sync must follow hydrate");
    assert.ok(flushIdx > syncIdx, "flush must follow store sync");
  });

  it("loads mongodb Initiative store without connecting Mongo (no import-time write)", async () => {
    process.env.INITIATIVE_PERSISTENCE = "mongodb";

    const store = await import("../../../src/modules/initiatives/initiative.store.js");

    assert.equal(
      store.getInitiativeById("initiative-bootstrap-001")?.initiativeId,
      "initiative-bootstrap-001",
      "sample Initiative remains available in memory before Mongo sync",
    );
  });
});
