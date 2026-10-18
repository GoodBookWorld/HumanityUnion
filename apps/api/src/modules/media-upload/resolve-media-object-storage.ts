import { LocalMediaStorageProvider } from "./local-media.provider.js";
import {
  resolveMediaStorageProviderName,
  type MediaObjectStorage,
} from "./media-object-storage.js";
import { MemoryMediaObjectStorage } from "./memory-media.provider.js";
import { R2MediaObjectStorage } from "./r2-media.provider.js";

let cached: MediaObjectStorage | undefined;
let testStorage: MediaObjectStorage | null = null;

/** Unit tests only. Production always resolves the configured provider. */
export function setMediaObjectStorageForTests(storage: MediaObjectStorage | null): void {
  if (storage && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Media storage test double is unavailable.");
  }

  testStorage = storage;
  cached = undefined;
}

export function resolveMediaObjectStorage(): MediaObjectStorage {
  if (testStorage && process.env.NODE_TEST_ENV === "true") {
    return testStorage;
  }

  if (cached) {
    return cached;
  }

  const provider = resolveMediaStorageProviderName();

  switch (provider) {
    case "r2":
      cached = new R2MediaObjectStorage();
      break;
    case "memory":
      cached = new MemoryMediaObjectStorage();
      break;
    case "local":
    default:
      cached = new LocalMediaStorageProvider();
      break;
  }

  return cached;
}

/** Test helper — clears singleton between cases. */
export function __testOnly_resetMediaObjectStorage(): void {
  cached = undefined;
  testStorage = null;
}
