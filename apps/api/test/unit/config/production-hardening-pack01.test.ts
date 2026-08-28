import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

import {
  collectInvalidProductionPersistenceModes,
  DURABLE_PERSISTENCE_ENV_KEYS,
  resolvePersistenceMode,
} from "../../../src/config/production-persistence-contract.js";
import { validateProductionEnvironment } from "../../../src/config/validate-production-environment.js";
import {
  clearAuthRateLimitBucketsForTests,
  createAuthRateLimiter,
} from "../../../src/modules/auth/auth-rate-limit.js";
import { MemoryMediaObjectStorage } from "../../../src/modules/media-upload/memory-media.provider.js";
import { R2MediaObjectStorage } from "../../../src/modules/media-upload/r2-media.provider.js";
import {
  __testOnly_resetMediaObjectStorage,
  resolveMediaObjectStorage,
} from "../../../src/modules/media-upload/resolve-media-object-storage.js";
import type { Request, Response } from "express";

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  __testOnly_resetMediaObjectStorage();
  clearAuthRateLimitBucketsForTests();
});

function buildRequest(): Request {
  return {
    headers: {},
    socket: { remoteAddress: "203.0.113.10" },
  } as unknown as Request;
}

function buildResponse(): { res: Response; statusCode: number | null; body: unknown } {
  const state: { res: Response; statusCode: number | null; body: unknown } = {
    res: null as unknown as Response,
    statusCode: null,
    body: undefined,
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state;
}

describe("Production Hardening Pack 01 — persistence contract", () => {
  it("defaults durable keys to mongodb in production (no silent .runtime file)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.INITIATIVE_PERSISTENCE;
    assert.equal(resolvePersistenceMode("INITIATIVE_PERSISTENCE", "file"), "mongodb");
  });

  it("rejects explicit file/memory for durable keys in production", () => {
    process.env.NODE_ENV = "production";
    process.env.INITIATIVE_PERSISTENCE = "file";
    assert.throws(
      () => resolvePersistenceMode("INITIATIVE_PERSISTENCE", "file"),
      /not allowed when NODE_ENV=production/,
    );
    process.env.NOTIFICATION_PERSISTENCE = "memory";
    assert.deepEqual(collectInvalidProductionPersistenceModes(), [
      "INITIATIVE_PERSISTENCE=file",
      "NOTIFICATION_PERSISTENCE=memory",
    ]);
  });

  it("preserves test/dev memory and file defaults outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.INITIATIVE_PERSISTENCE;
    assert.equal(resolvePersistenceMode("INITIATIVE_PERSISTENCE", "memory"), "memory");
    process.env.INITIATIVE_PERSISTENCE = "file";
    assert.equal(resolvePersistenceMode("INITIATIVE_PERSISTENCE", "memory"), "file");
  });
});

describe("Production Hardening Pack 01 — production config guards", () => {
  function withMinimalProdEnv(extra: Record<string, string> = {}) {
    process.env.NODE_ENV = "production";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
    process.env.MONGODB_DATABASE = "humanity_union_production";
    process.env.JWT_ACCESS_SECRET = "access-secret-for-tests-only";
    process.env.JWT_REFRESH_SECRET = "refresh-secret-for-tests-only";
    process.env.CORS_ORIGIN = "https://huws.org";
    process.env.MEDIA_STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "bucket";
    process.env.R2_PUBLIC_BASE_URL = "https://media.example.org";
    process.env.R2_PRIVATE_BUCKET = "bucket-private";
    process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
    process.env.PLATFORM_MODE = "production";
    // Pack 26A — keep Stripe disabled unless a test enables it explicitly.
    process.env.MEMBERSHIP_PAYMENT_PROVIDER = "mock";
    process.env.MEMBER_BADGE_PAYMENT_PROVIDER = "mock";
    process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED = "false";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_MEMBERSHIP_PRICE_ID;
    delete process.env.STRIPE_MEMBER_BADGE_PRICE_ID;
    // Hermetic email config (do not depend on developer .env).
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.example.org";
    process.env.SMTP_USERNAME = "noreply@example.org";
    process.env.SMTP_PASSWORD = "smtp-password-for-tests-only";
    process.env.SMTP_FROM_EMAIL = "noreply@example.org";
    // Clear durable file/memory values that may be present from apps/api/.env.
    for (const key of DURABLE_PERSISTENCE_ENV_KEYS) {
      delete process.env[key];
    }
    for (const [k, v] of Object.entries(extra)) {
      process.env[k] = v;
    }
  }

  it("rejects wildcard CORS in production", () => {
    withMinimalProdEnv({ CORS_ORIGIN: "*" });
    assert.throws(() => validateProductionEnvironment(), /must not be '\*'/);
  });

  it("rejects missing Mongo URI in production", () => {
    withMinimalProdEnv();
    delete process.env.MONGODB_URI;
    assert.throws(() => validateProductionEnvironment(), /Missing MONGODB_URI/);
  });

  it("rejects local media storage without ephemeral override", () => {
    withMinimalProdEnv({ MEDIA_STORAGE_PROVIDER: "local" });
    delete process.env.MEDIA_ALLOW_EPHEMERAL_LOCAL_STORAGE;
    assert.throws(() => validateProductionEnvironment(), /MEDIA_STORAGE_PROVIDER=local/);
  });

  it("accepts a fully configured production surface", () => {
    withMinimalProdEnv();
    assert.doesNotThrow(() => validateProductionEnvironment());
  });

  it("Pack 26A — rejects Stripe Membership provider without required secrets/Price IDs", () => {
    withMinimalProdEnv({
      MEMBERSHIP_PAYMENT_PROVIDER: "stripe",
    });
    assert.throws(() => validateProductionEnvironment(), /STRIPE_SECRET_KEY/);
    assert.throws(() => validateProductionEnvironment(), /STRIPE_WEBHOOK_SECRET/);
    assert.throws(() => validateProductionEnvironment(), /STRIPE_MEMBERSHIP_PRICE_ID/);
  });

  it("Pack 26A — rejects Stripe Member Badge provider without required Price ID", () => {
    withMinimalProdEnv({
      MEMBER_BADGE_PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    });
    assert.throws(() => validateProductionEnvironment(), /STRIPE_MEMBER_BADGE_PRICE_ID/);
  });

  it("Pack 26A — accepts Stripe when Membership and Badge Price IDs are configured", () => {
    withMinimalProdEnv({
      MEMBERSHIP_PAYMENT_PROVIDER: "stripe",
      MEMBER_BADGE_PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_live_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
      STRIPE_MEMBERSHIP_PRICE_ID: "price_membership",
      STRIPE_MEMBER_BADGE_PRICE_ID: "price_badge",
      MEMBER_BADGE_CONTRIBUTIONS_ENABLED: "false",
    });
    assert.doesNotThrow(() => validateProductionEnvironment());
  });

  it("Pack 26A — rejects legacy Member Badge contributions enabled in production", () => {
    withMinimalProdEnv({
      MEMBER_BADGE_CONTRIBUTIONS_ENABLED: "true",
    });
    assert.throws(
      () => validateProductionEnvironment(),
      /MEMBER_BADGE_CONTRIBUTIONS_ENABLED must be false/,
    );
  });
});

describe("Production Hardening Pack 01 — media object storage", () => {
  it("resolves local provider for tests/dev by default", () => {
    process.env.NODE_ENV = "test";
    delete process.env.MEDIA_STORAGE_PROVIDER;
    __testOnly_resetMediaObjectStorage();
    const storage = resolveMediaObjectStorage();
    assert.equal(storage.constructor.name, "LocalMediaStorageProvider");
  });

  it("memory provider stays provider-independent and never exposes secrets", async () => {
    const storage = new MemoryMediaObjectStorage();
    const saved = await storage.saveFile({
      purpose: "avatar",
      buffer: Buffer.from("bytes"),
      mimeType: "image/png",
      extension: ".png",
    });
    assert.match(saved.storageKey, /^avatars\//);
    assert.match(storage.buildPublicUrl(saved.storageKey), /^\/api\/v1\/media\/files\//);
    assert.equal("secretAccessKey" in storage, false);
  });

  it("R2 adapter builds CDN URLs without embedding credentials", () => {
    const storage = new R2MediaObjectStorage({
      accountId: "acct",
      accessKeyId: "key-id",
      secretAccessKey: "super-secret-value",
      bucket: "hu-media",
      publicBaseUrl: "https://cdn.example.org",
    });
    const url = storage.buildPublicUrl("avatars/1-uuid.png");
    assert.equal(url, "https://cdn.example.org/avatars/1-uuid.png");
    assert.doesNotMatch(url, /super-secret-value/);
    assert.equal(
      Object.prototype.hasOwnProperty.call(storage, "secretAccessKey"),
      false,
    );
  });
});

describe("Production Hardening Pack 01 — private media + email isolation", () => {
  it("shared document downloads remain JWT-gated (not public MediaObjectStorage)", () => {
    const initiativesRoutes = readFileSync(
      new URL(
        "../../../src/modules/shared-documents/shared-documents.initiatives.routes.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(initiativesRoutes, /requireJwtAuthenticationMiddleware/);
    assert.match(initiativesRoutes, /streamSharedDocumentDownload/);
    assert.doesNotMatch(initiativesRoutes, /MEDIA_STORAGE_PROVIDER|R2_PUBLIC_BASE_URL/);
  });

  it("automated email helpers stay on MockEmailProvider", () => {
    const helpers = readFileSync(
      new URL("../../../src/modules/email/email-test-helpers.ts", import.meta.url),
      "utf8",
    );
    assert.match(helpers, /MockEmailProvider/);
    assert.doesNotMatch(helpers, /SmtpEmailProvider|createTransport/);
  });
});

describe("Production Hardening Pack 01 — auth refresh rate limit", () => {
  it("allows legitimate multi-tab refresh volume under the refresh budget", () => {
    process.env.AUTH_REFRESH_RATE_LIMIT_MAX_ATTEMPTS = "5";
    process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS = "900000";
    const limiter = createAuthRateLimiter("auth-refresh");
    const req = buildRequest();
    let nextCalls = 0;

    for (let i = 0; i < 5; i += 1) {
      const { res } = buildResponse();
      limiter(req, res, () => {
        nextCalls += 1;
      });
    }

    assert.equal(nextCalls, 5);
  });

  it("returns calm 429 after refresh budget is exceeded", () => {
    process.env.AUTH_REFRESH_RATE_LIMIT_MAX_ATTEMPTS = "3";
    process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS = "900000";
    const limiter = createAuthRateLimiter("auth-refresh");
    const req = buildRequest();

    for (let i = 0; i < 3; i += 1) {
      const { res } = buildResponse();
      limiter(req, res, () => undefined);
    }

    const blocked = buildResponse();
    limiter(req, blocked.res, () => {
      assert.fail("should not continue");
    });
    assert.equal(blocked.statusCode, 429);
    assert.equal(
      (blocked.body as { message?: string }).message,
      "Too many attempts. Please try again later.",
    );
  });
});
