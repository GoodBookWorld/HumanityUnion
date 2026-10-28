/**
 * Test-only second API process for real MongoDB race tests (Workflow 09I).
 *
 * Connects only to the parent's disposable local replica set under the same
 * explicit hu_test_ lock, runs one real store or service operation, and prints
 * `READY` immediately before the operation and `RESULT <json>` after it.
 * Never reads MONGODB_URI, MONGODB_DATABASE, or any .env file.
 */
import { randomUUID } from "node:crypto";

import { lockExplicitIsolatedMongoTestConfig } from "../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { redeemIntegrityMediaBindingRecovery } from "../../src/modules/external-author-link/external-author-link.binding-recovery.service.js";
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  signIntegrityMediaLinkRedeem,
} from "../../src/modules/external-author-link/external-author-link.hmac.js";
import { createMongoExternalAuthorLinkStore } from "../../src/modules/external-author-link/external-author-link.store.js";
import {
  buildIntegrityMediaAuthorReplyCanonical,
  hashIntegrityMediaAuthorReplyContent,
  signIntegrityMediaAuthorReply,
} from "../../src/modules/integrity-media-author-messages/integrity-media-author-reply.hmac.js";
import { acceptIntegrityMediaAuthorReply } from "../../src/modules/integrity-media-author-messages/integrity-media-author-reply.service.js";
import {
  createMongoIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
} from "../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";

type ChildCommand =
  | {
      op: "disconnect";
      uri: string;
      database: string;
      externalAuthorId: string;
      memberId: string;
      linkRevision: number;
    }
  | {
      op: "recover";
      uri: string;
      database: string;
      secret: string;
      request: {
        resultCode: string;
        externalAuthorId: string;
        huTarget: string;
        expectedHuMemberId: string;
        expectedHuLinkRevision: number;
        expectedHuLinkInstanceId: string;
        recoveryId: string;
      };
    }
  | {
      op: "reply";
      uri: string;
      database: string;
      secret: string;
      authorId: string;
      memberId: string;
      linkRevision: number;
      body: string;
    };

const LOCAL_URI = /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+(,(127\.0\.0\.1|localhost):\d+)*\/hu_test_[A-Za-z0-9_]+(\?.*)?$/;

async function main(): Promise<void> {
  const command = JSON.parse(process.argv[2] ?? "{}") as ChildCommand;
  if (!LOCAL_URI.test(command.uri)) {
    throw new Error("The child process accepts only the parent's local hu_test_ replica set.");
  }

  process.env.NODE_TEST_ENV = "true";
  process.env.PLATFORM_MODE = "staging";
  lockExplicitIsolatedMongoTestConfig({ uri: command.uri, database: command.database });
  await connectMongoClient();

  try {
    let result: unknown;
    if (command.op === "disconnect") {
      const store = createMongoExternalAuthorLinkStore();
      process.stdout.write("READY\n");
      result = await store.compareAndDisableLink({
        source: INTEGRITY_MEDIA_SOURCE,
        externalAuthorId: command.externalAuthorId,
        memberId: command.memberId,
        linkRevision: command.linkRevision,
        nowIso: new Date().toISOString(),
      });
    } else if (command.op === "recover") {
      process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = command.secret;
      process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";
      const timestamp = String(Math.floor(Date.now() / 1000));
      process.stdout.write("READY\n");
      result = await redeemIntegrityMediaBindingRecovery({
        ...command.request,
        timestamp,
        signature: signIntegrityMediaLinkRedeem(
          command.secret,
          buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...command.request }),
        ),
        secret: command.secret,
      });
    } else {
      setIntegrityMediaAuthorMessageStoreForTests(createMongoIntegrityMediaAuthorMessageStore());
      const messageId = randomUUID();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = signIntegrityMediaAuthorReply(
        command.secret,
        buildIntegrityMediaAuthorReplyCanonical({
          timestamp,
          messageId,
          authorId: command.authorId,
          memberId: command.memberId,
          linkRevision: command.linkRevision,
          replyToMessageId: "",
          contentSha256: hashIntegrityMediaAuthorReplyContent(command.body),
        }),
      );
      process.stdout.write("READY\n");
      result = await acceptIntegrityMediaAuthorReply({
        messageId,
        authorId: command.authorId,
        memberId: command.memberId,
        linkRevision: command.linkRevision,
        body: command.body,
        timestamp,
        signature,
        secret: command.secret,
      });
    }

    process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
  } finally {
    await disconnectMongoClient();
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  },
);
