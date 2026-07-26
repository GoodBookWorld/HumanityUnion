import assert from "node:assert/strict";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { findAuthUserByEmail, type AuthUserRecord } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { deleteWorkspaceProjectionByMemberId } from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import { resetMemberRegisteredOutboxForDispatchTests, markMemberRegisteredOutboxPublishedForTests } from "./test-events.js";

export async function registerAndConfirmMemberForTests(input: {
  email: string;
  displayName: string;
}): Promise<AuthUserRecord> {
  await registerAuthUser({
    email: input.email,
    password: "Password123!",
    displayName: input.displayName,
  });

  const user = await findAuthUserByEmail(input.email);
  assert.ok(user);

  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);

  await confirmRegistrationEmailCode({ userId: user.userId, code });
  await deleteWorkspaceProjectionByMemberId(user.memberId);
  await markMemberRegisteredOutboxPublishedForTests(user.memberId);

  return user;
}
