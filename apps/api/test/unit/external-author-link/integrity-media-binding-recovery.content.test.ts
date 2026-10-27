import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import express from "express";

import { grantBlogCapabilitiesForTests } from "../../../src/modules/blog/blog.service.js";
import {
  listBlogMemoryPostsForTests,
  resetBlogMemoryPersistenceForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { resetSafetyProviderForTests } from "../../../src/modules/lifecycle-safety/safety-provider.js";
import { setIntegrityMediaBindingRecoveryInterruptForTests } from "../../../src/modules/external-author-link/external-author-link.binding-recovery.js";
import {
  buildArticleIngestPayload,
  resetArticleIngestReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.hmac.js";
import {
  listArticleDeliveriesForTests,
  resetArticleDeliveriesForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import articleIngestRouter from "../../../src/modules/external-author-link/external-author-link.article-ingest.routes.js";
import { resetArticleIngestLocksForTests } from "../../../src/modules/external-author-link/external-author-link.article-ingest.service.js";
import {
  INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV,
  INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_ARTICLE_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_ARTICLE_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  resetIntegrityMediaBindingRecoveryReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import { setProvisionMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.constants.js";
import {
  createMemoryIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
  type IntegrityMediaAuthorMessageStore,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import type { IntegrityMediaAuthorMessageRecord } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.types.js";

const LINK_SECRET = "binding-recovery-content-link-secret";
const ARTICLE_SECRET = "binding-recovery-content-article-secret";
const CATEGORY = "conscious_existence";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HISTORICAL_MEMBER = "11111111-1111-4111-8111-111111111111";
const REPLACEMENT_MEMBER = "22222222-2222-4222-8222-222222222222";
const ADMIN_MEMBER = "33333333-3333-4333-8333-333333333333";
const HISTORICAL_INSTANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const HISTORICAL_REVISION = 4;
const RESULT_CODE = "contentResultCode_0123456789abcdefABCDEF";
const RECOVERY_ID = "recovery-content-0001-abc";
const PUBLICATION_ID = "pub-recovery-content-01";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

interface ArticleRequest {
  publicationId: string;
  authorId: string;
  huMemberId: string;
  title: string;
  excerpt: string;
  content: string;
  language: string;
  publishedAt: string;
  canonicalUrl: string;
  target: string;
  operation?: "update";
  contentRevision?: number;
}

const savedEnv = new Map<string, string | undefined>();
const ENV_KEYS = [
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV,
];

let server: Server;
let baseUrl = "";
let linkStore: ExternalAuthorLinkStore;
let messageStore: IntegrityMediaAuthorMessageStore;
let articleTimestamp = 0;

describe("Integrity Media binding recovery leaves collaboration content in place", () => {
  before(async () => {
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
    }

    const app = express();
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    app.use("/api/v1/integrations/integrity-media", articleIngestRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorMessageStoreForTests(null);
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    setProvisionMemoryForTests(null);
    resetSafetyProviderForTests();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(async () => {
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = LINK_SECRET;
    process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";
    process.env[INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV] = ARTICLE_SECRET;
    process.env[INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV] = CATEGORY;
    articleTimestamp = Math.floor(Date.now() / 1000);

    resetBlogMemoryPersistenceForTests();
    resetArticleDeliveriesForTests();
    resetArticleIngestReplayCacheForTests();
    resetArticleIngestLocksForTests();
    resetSafetyProviderForTests();
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    setProvisionMemoryForTests(null);

    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    messageStore = createMemoryIntegrityMediaAuthorMessageStore();
    setIntegrityMediaAuthorMessageStoreForTests(messageStore);

    await linkStore.insertLink({
      source: INTEGRITY_MEDIA_SOURCE,
      externalAuthorId: AUTHOR,
      memberId: HISTORICAL_MEMBER,
      state: "linked",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      confirmedAt: "2026-01-02T00:00:00.000Z",
      disconnectedAt: null,
      collaborationStatus: "active",
      authorActivationPending: false,
      linkRevision: HISTORICAL_REVISION,
      linkInstanceId: HISTORICAL_INSTANCE,
      linkFinalization: "confirmed",
    });
    await linkStore.insertResult({
      resultCode: RESULT_CODE,
      source: INTEGRITY_MEDIA_SOURCE,
      attemptState: "contentAttemptState01",
      memberId: REPLACEMENT_MEMBER,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });
    await grantBlogCapabilitiesForTests({
      participantId: HISTORICAL_MEMBER,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
  });

  it("does not move Blog posts, article deliveries, or messages to the replacement member", async () => {
    const published = await postArticle(articleBody());
    assert.equal(published.status, 200);
    assert.equal(published.body.data?.status, "published");
    await seedMessages();

    const postsBefore = listBlogMemoryPostsForTests().map((post) => structuredClone(post));
    const deliveriesBefore = listArticleDeliveriesForTests().map((row) => structuredClone(row));
    const messagesBefore = await messageStore.list();
    assert.equal(postsBefore.length, 1);
    assert.equal(postsBefore[0]?.authorParticipantId, HISTORICAL_MEMBER);
    assert.equal(deliveriesBefore.length, 1);
    assert.equal(messagesBefore.length, 2);

    const recovered = await recover();
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.data?.memberId, REPLACEMENT_MEMBER);

    assert.deepEqual(listBlogMemoryPostsForTests(), postsBefore);
    assert.deepEqual(listArticleDeliveriesForTests(), deliveriesBefore);
    assert.deepEqual(await messageStore.list(), messagesBefore);
    assert.ok(
      listBlogMemoryPostsForTests().every((post) => post.authorParticipantId === HISTORICAL_MEMBER),
    );
    assert.ok(
      (await messageStore.list()).every((message) => message.recipientMemberId === HISTORICAL_MEMBER),
    );

    const replacementHistory = await messageStore.listHistory({
      recipientMemberId: REPLACEMENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      limit: 50,
      before: null,
    });
    const historicalHistory = await messageStore.listHistory({
      recipientMemberId: HISTORICAL_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      limit: 50,
      before: null,
    });
    assert.equal(replacementHistory.records.length, 0);
    assert.equal(historicalHistory.records.length, 2);
  });

  it("keeps an article update naming the historical member an author mismatch", async () => {
    assert.equal((await postArticle(articleBody())).status, 200);
    const postsBefore = listBlogMemoryPostsForTests().map((post) => structuredClone(post));
    const deliveriesBefore = listArticleDeliveriesForTests().map((row) => structuredClone(row));

    assert.equal((await recover()).status, 200);
    const update = await postArticle({
      ...articleBody(),
      title: "Edited after recovery",
      operation: "update",
      contentRevision: 2,
    });

    assert.equal(update.status, 409);
    assert.equal(update.body.meta.code, "author_member_mismatch");
    assert.deepEqual(listBlogMemoryPostsForTests(), postsBefore);
    assert.deepEqual(listArticleDeliveriesForTests(), deliveriesBefore);
  });

  it("does not accept article delivery for the replacement member while the link is provisional", async () => {
    assert.equal((await recover()).status, 200);
    const response = await postArticle({
      ...articleBody(),
      publicationId: "pub-recovery-content-02",
      canonicalUrl: "https://example.com/articles/pub-recovery-content-02",
      huMemberId: REPLACEMENT_MEMBER,
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "link_not_active");
    assert.deepEqual(listBlogMemoryPostsForTests(), []);
    assert.deepEqual(listArticleDeliveriesForTests(), []);
  });
});

function articleBody(): ArticleRequest {
  return {
    publicationId: PUBLICATION_ID,
    authorId: AUTHOR,
    huMemberId: HISTORICAL_MEMBER,
    title: "Public article before recovery",
    excerpt: "A short public excerpt for the Humanity Union Blog.",
    content: "<p>A public article for the Humanity Union Blog.</p>",
    language: "en",
    publishedAt: "2024-06-01",
    canonicalUrl: `https://example.com/articles/${PUBLICATION_ID}`,
    target: "staging",
  };
}

async function postArticle(body: ArticleRequest): Promise<{ status: number; body: ApiBody }> {
  articleTimestamp += 1;
  const timestamp = String(articleTimestamp);
  const signature = signIntegrityMediaLinkRedeem(
    ARTICLE_SECRET,
    buildArticleIngestPayload({
      timestamp,
      publicationId: body.publicationId,
      authorId: body.authorId,
      huMemberId: body.huMemberId,
      target: body.target,
      language: body.language,
      publishedAt: body.publishedAt,
      canonicalUrl: new URL(body.canonicalUrl).toString(),
      title: body.title.trim().replace(/\s+/g, " "),
      excerpt: body.excerpt.trim().replace(/\s+/g, " "),
      content: body.content,
      ...(body.operation === "update"
        ? { operation: "update" as const, contentRevision: body.contentRevision }
        : {}),
    }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrations/integrity-media/articles`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [INTEGRITY_MEDIA_ARTICLE_TIMESTAMP_HEADER]: timestamp,
      [INTEGRITY_MEDIA_ARTICLE_SIGNATURE_HEADER]: signature,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function recover(): Promise<{ status: number; body: ApiBody }> {
  const request = {
    resultCode: RESULT_CODE,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: HISTORICAL_MEMBER,
    expectedHuLinkRevision: HISTORICAL_REVISION,
    expectedHuLinkInstanceId: HISTORICAL_INSTANCE,
    recoveryId: RECOVERY_ID,
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    LINK_SECRET,
    buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...request }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/binding-recovery/redeem`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify(request),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function seedMessages(): Promise<void> {
  const base = {
    destination: INTEGRITY_MEDIA_SOURCE,
    recipientMemberId: HISTORICAL_MEMBER,
    recipientExternalAuthorId: AUTHOR,
    kind: "chat" as const,
    category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
    cta: null,
    linkRevision: HISTORICAL_REVISION,
    attemptCount: 1,
    lastAttemptAt: "2026-01-03T00:00:00.000Z",
    nextAttemptAt: null,
    lastErrorCode: null,
  };
  const records: IntegrityMediaAuthorMessageRecord[] = [
    {
      ...base,
      messageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      actorMemberId: ADMIN_MEMBER,
      direction: "hu_to_im",
      title: "Outbound note",
      body: "A message sent to the historical member before recovery.",
      status: "delivered",
      deliveredAt: "2026-01-03T00:00:00.000Z",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      ...base,
      messageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
      actorMemberId: HISTORICAL_MEMBER,
      direction: "im_to_hu",
      title: "Reply",
      body: "A reply recorded from the historical member before recovery.",
      replyToMessageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      status: "recorded",
      deliveredAt: null,
      createdAt: "2026-01-04T00:00:00.000Z",
      updatedAt: "2026-01-04T00:00:00.000Z",
    },
  ];

  for (const record of records) {
    assert.equal(await messageStore.insert(record), "inserted");
  }
}
