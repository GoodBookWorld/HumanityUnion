/**
 * TASK-052 — Authentication foundation verification.
 * Run: npm run verify:auth
 *
 * Auth-only gate: registration, email confirmation, login, sessions, password flows,
 * and middleware. Collective Decision verification is a separate required gate
 * (`npm run verify:collective-decision`); see docs/VERIFICATION_ARCHITECTURE.md.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import type { Request } from "express";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import {
  AuthenticationRequiredError,
  AuthPersistenceUnavailableError,
} from "../modules/auth/auth.errors.js";
import { authenticationMiddleware } from "../modules/auth/auth.middleware.js";
import { hashPassword, verifyPassword } from "../modules/auth/auth-password.js";
import { toAuthUserPublic } from "../modules/auth/auth-user.projection.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import {
  deleteAuthSessionsByUserIds,
  findAuthSessionById,
  isAuthSessionActive,
  refreshTokenMatchesSession,
} from "../modules/auth/auth-session.repository.js";
import {
  loginAuthUser,
  logoutAuthSession,
  refreshAuthSession,
  registerAuthUser,
  isEmailConfirmationRequiredResponse,
} from "../modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../modules/auth/auth-email-confirmation.service.js";
import { getLastIssuedConfirmationCodeForTests } from "../modules/email/email-confirmation-code.repository.js";
import { verifyAccessToken, verifyRefreshToken } from "../modules/auth/auth-tokens.js";
import { resolveRequestIdentity } from "../modules/initiatives/identity/resolve-request-identity.js";
import { createInitiativeDraft } from "../modules/initiatives/initiative.service.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `auth-verify-${Date.now()}`;

const FORBIDDEN_PUBLIC_FIELDS = [
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "refreshToken",
  "provider",
] as const;

function verifyAssert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejects(
  fn: () => Promise<unknown>,
  pattern?: RegExp | (new (...args: never[]) => Error),
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected promise rejection.");
  } catch (error) {
    if (typeof pattern === "function") {
      verifyAssert(error instanceof pattern, `Expected ${pattern.name} but got ${String(error)}`);
      return;
    }

    if (pattern && error instanceof Error) {
      verifyAssert(
        pattern.test(error.message),
        `Expected error matching ${pattern}, got ${error.message}`,
      );
    }
  }
}

function expectThrows(fn: () => unknown, ErrorType: new (...args: never[]) => Error): void {
  try {
    fn();
    throw new Error(`Expected ${ErrorType.name}.`);
  } catch (error) {
    verifyAssert(error instanceof ErrorType, `Expected ${ErrorType.name} but got ${String(error)}`);
  }
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    },
  };
}

async function cleanupTestRecords(): Promise<void> {
  const users = await getMongoCollection<{ userId: string; email: string }>(
    MONGO_COLLECTIONS.authUsers,
  )
    .find({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } })
    .toArray();

  const userIds = users.map((user) => user.userId);
  await deleteAuthSessionsByUserIds(userIds);
  await deleteAuthUsersByEmailPrefix(TEST_EMAIL_PREFIX);
}

async function verifyRegistrationAndLogin(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const email = `${TEST_EMAIL_PREFIX}@example.com`;
  const password = "verify-password-123";

  const registered = await registerAuthUser({
    email,
    displayName: "Auth Verify User",
    password,
  });

  verifyAssert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require email confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  verifyAssert(stored !== null, "Registered user must be stored in MongoDB");
  verifyAssert(stored.emailVerificationStatus === "pending", "New account must be unconfirmed.");
  verifyAssert(typeof stored.passwordHash === "string", "Password hash must be stored");
  verifyAssert(stored.passwordHash.startsWith("$2"), "Password must be bcrypt hashed");
  verifyAssert(
    !("password" in (stored as unknown as Record<string, unknown>)),
    "Raw password must not be stored",
  );

  await expectRejects(
    () =>
      registerAuthUser({
        email,
        displayName: "Duplicate",
        password: "another-password-123",
      }),
    /already exists/i,
  );

  await expectRejects(
    () =>
      loginAuthUser({
        email,
        password: "wrong-password-123",
      }),
    /Invalid email or password/i,
  );

  const pendingLogin = await loginAuthUser({ email, password });
  verifyAssert(
    isEmailConfirmationRequiredResponse(pendingLogin),
    "Login before confirmation must require email confirmation.",
  );

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  verifyAssert(code !== null && /^\d{6}$/.test(code), "Confirmation code must be six digits.");

  const confirmed = await confirmRegistrationEmailCode({
    userId: stored.userId,
    code,
  });
  verifyAssert(confirmed.tokens.accessToken.length > 20, "Confirmation must return access token");
  verifyAssert(confirmed.tokens.refreshToken.length > 20, "Confirmation must return refresh token");

  const claims = verifyAccessToken(confirmed.tokens.accessToken);
  verifyAssert(claims.sub === stored.userId, "Access token must include userId");
  verifyAssert(claims.memberId === stored.memberId, "Access token must include memberId");

  const loggedIn = await loginAuthUser({ email, password });
  verifyAssert(
    !isEmailConfirmationRequiredResponse(loggedIn),
    "Verified login must return session.",
  );
  verifyAssert(
    "tokens" in loggedIn && loggedIn.tokens.accessToken.length > 20,
    "Login must return access token",
  );

  return {
    accessToken: loggedIn.tokens.accessToken,
    refreshToken: loggedIn.tokens.refreshToken,
  };
}

async function verifyRefreshAndLogout(refreshToken: string): Promise<void> {
  const refreshed = await refreshAuthSession(refreshToken);
  verifyAssert(refreshed.tokens.accessToken.length > 20, "Refresh must return a new access token");
  verifyAssert(
    refreshed.tokens.refreshToken !== refreshToken,
    "Refresh must rotate the refresh token.",
  );

  await expectRejects(() => refreshAuthSession(refreshToken), /Invalid or expired refresh token/i);

  await logoutAuthSession(refreshed.tokens.refreshToken);

  await expectRejects(
    () => refreshAuthSession(refreshed.tokens.refreshToken),
    /Invalid or expired refresh token/i,
  );
}

async function verifyRequestIdentityFromJwt(accessToken: string): Promise<void> {
  const req = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  } as Request;

  let nextCalled = false;

  authenticationMiddleware(req, createMockResponse() as never, () => {
    nextCalled = true;
  });

  verifyAssert(nextCalled, "Authentication middleware must call next()");
  verifyAssert(Boolean(req.auth?.memberId), "JWT middleware must populate req.auth.memberId");

  const identity = await resolveRequestIdentity(req);
  verifyAssert(
    identity.participantId === req.auth?.memberId,
    "RequestIdentity must resolve from JWT",
  );
}

async function verifyBootstrapFallback(): Promise<void> {
  const previous = process.env.AUTH_BOOTSTRAP_FALLBACK;
  process.env.AUTH_BOOTSTRAP_FALLBACK = "true";

  try {
    const identity = await resolveRequestIdentity({ auth: undefined } as Request);
    verifyAssert(
      identity.participantId === "member-bootstrap-001",
      "Bootstrap fallback must preserve dev identity",
    );
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_BOOTSTRAP_FALLBACK;
    } else {
      process.env.AUTH_BOOTSTRAP_FALLBACK = previous;
    }
  }
}

async function verifyFallbackDisabledRequiresAuth(): Promise<void> {
  const previous = process.env.AUTH_BOOTSTRAP_FALLBACK;
  process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

  try {
    expectThrows(
      async () => await resolveRequestIdentity({ auth: undefined } as Request),
      AuthenticationRequiredError,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_BOOTSTRAP_FALLBACK;
    } else {
      process.env.AUTH_BOOTSTRAP_FALLBACK = previous;
    }
  }
}

async function verifyPublicProjectionSafety(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-public@example.com`;
  await registerAuthUser({
    email,
    displayName: "Public Safety User",
    password: "verify-password-123",
  });

  const stored = await findRawAuthUserByEmail(email);
  verifyAssert(stored !== null, "Registered user must exist.");

  const publicUser = toAuthUserPublic(stored);

  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    verifyAssert(!(field in publicUser), `Public auth projection must not expose ${field}`);
  }

  verifyAssert(publicUser.userId === stored.userId, "Safe public userId is allowed");
}

async function verifyMongoUnavailableError(): Promise<void> {
  const previousUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;

  try {
    await expectRejects(
      () =>
        registerAuthUser({
          email: `${TEST_EMAIL_PREFIX}-offline@example.com`,
          displayName: "Offline User",
          password: "verify-password-123",
        }),
      AuthPersistenceUnavailableError,
    );
  } finally {
    if (previousUri) {
      process.env.MONGODB_URI = previousUri;
      await connectMongoClient();
    }
  }
}

async function verifyPasswordSecurity(): Promise<void> {
  const hash = await hashPassword("verify-password-123");
  verifyAssert(hash.startsWith("$2"), "bcrypt hash prefix expected");
  verifyAssert(
    await verifyPassword("verify-password-123", hash),
    "Password verification must succeed",
  );
  verifyAssert(
    !(await verifyPassword("wrong-password", hash)),
    "Wrong password must fail verification",
  );
}

async function verifySessionPersistence(refreshToken: string): Promise<string> {
  const refreshed = await refreshAuthSession(refreshToken);
  const activeRefreshToken = refreshed.tokens.refreshToken;

  const refreshPayload = verifyRefreshToken(activeRefreshToken);
  const session = await findAuthSessionById(refreshPayload.sessionId);

  verifyAssert(session !== null, "Refresh session must be stored in MongoDB");
  verifyAssert(isAuthSessionActive(session), "Stored session must be active before logout");
  verifyAssert(
    typeof session.refreshTokenHash === "string",
    "Session must store hashed refresh token",
  );
  verifyAssert(
    refreshTokenMatchesSession(activeRefreshToken, session),
    "Rotated refresh token hash must match stored session.",
  );

  return activeRefreshToken;
}

async function verifyCapability02Regression(): Promise<void> {
  const identity = await resolveRequestIdentity({
    auth: {
      id: "auth-bootstrap-001",
      email: "bootstrap@humanityunion.local",
      provider: "email",
      status: "active",
      roles: ["member"],
      memberId: "member-bootstrap-001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as Request);

  const initiative = createInitiativeDraft(identity, {
    title: "Auth Verify Initiative",
    description: "Ensures auth foundation does not break initiative draft creation.",
    communitySlug: "nelson-community-garden",
    activityArea: "infrastructure",
  });

  verifyAssert(initiative.initiativeId.length > 0, "Capability 02 draft creation must still work");
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:auth pass ${pass} ===`);

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for verify:auth.");
  }

  await bootstrapAuthPersistence();
  await cleanupTestRecords();

  await verifyPasswordSecurity();
  const { accessToken, refreshToken } = await verifyRegistrationAndLogin();
  const activeRefreshToken = await verifySessionPersistence(refreshToken);
  await verifyRefreshAndLogout(activeRefreshToken);
  await verifyRequestIdentityFromJwt(accessToken);
  await verifyBootstrapFallback();
  await verifyFallbackDisabledRequiresAuth();
  await verifyPublicProjectionSafety();
  await verifyMongoUnavailableError();
  await verifyCapability02Regression();

  await cleanupTestRecords();

  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for verify:auth.");
  }

  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:auth PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
