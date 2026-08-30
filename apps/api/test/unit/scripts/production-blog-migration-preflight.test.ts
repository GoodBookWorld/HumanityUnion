import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  InMemoryBlogR2Inspector,
  assertNoSecretLeak,
  classifyBlogDestinationR2Object,
  classifyHumanPotentialCategory,
  classifyMediaUrlHost,
  classifySeedCategoryPair,
  extractMediaReferencesFromPost,
  runProductionBlogMigrationPreflight,
  storageKeyFromMediaUrl,
  stripForbiddenReportFields,
  verifyCanonicalBlogR2Objects,
} from "../../../src/modules/production-blog-migration/index.js";

type MemDoc = Document & { _id?: string };

function getPath(doc: MemDoc, path: string): unknown {
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, doc);
}

function matchesFilter(doc: MemDoc, filter: Document): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, value] of Object.entries(filter)) {
    const actual = getPath(doc, key);
    if (String(actual) !== String(value)) return false;
  }
  return true;
}

class MemoryCursor {
  constructor(private readonly docs: MemDoc[]) {}
  project(_p: Document) {
    return this;
  }
  async toArray() {
    return this.docs.map((d) => ({ ...d }));
  }
}

class MemoryCollection {
  constructor(
    private readonly store: Map<string, MemDoc[]>,
    private readonly name: string,
  ) {}
  private rows(): MemDoc[] {
    return this.store.get(this.name) ?? [];
  }
  async findOne(filter: Document) {
    return this.rows().find((doc) => matchesFilter(doc, filter)) ?? null;
  }
  find(filter: Document = {}) {
    return new MemoryCursor(this.rows().filter((doc) => matchesFilter(doc, filter)));
  }
  async countDocuments(filter: Document = {}) {
    return this.rows().filter((doc) => matchesFilter(doc, filter)).length;
  }
}

class MemoryDb {
  readonly store = new Map<string, MemDoc[]>();
  collection(name: string) {
    if (!this.store.has(name)) this.store.set(name, []);
    return new MemoryCollection(this.store, name);
  }
  seed(name: string, docs: MemDoc[]) {
    this.store.set(
      name,
      docs.map((d) => ({ ...d })),
    );
  }
  asDb(): Db {
    return this as unknown as Db;
  }
}

const AUTHOR = "participant-author-1";
const ACTOR = "participant-actor-1";
const GRANTER = "participant-granter-1";
const DECIDER = "participant-decider-1";
const LINKED = "participant-linked-1";

function seedCategory(
  categoryId: string,
  extras: Partial<MemDoc> = {},
): MemDoc {
  const slug =
    categoryId === "conscious_existence"
      ? "conscious-existence"
      : categoryId === "human_security"
        ? "human-security"
        : categoryId === "our_life"
          ? "our-life"
          : "human-potential";
  const name =
    categoryId === "conscious_existence"
      ? "Conscious Existence"
      : categoryId === "human_security"
        ? "Human Security"
        : categoryId === "our_life"
          ? "Our Life"
          : "Human Potential";
  return {
    _id: categoryId,
    categoryId,
    slug,
    name,
    status: "active",
    sortOrder: 1,
    ...extras,
  };
}

function seedPerfectSource(): {
  source: MemoryDb;
  dest: MemoryDb;
} {
  const source = new MemoryDb();
  const dest = new MemoryDb();

  const categories = [
    ...EXPECTED_SEED_CATEGORY_IDS.map((id, i) => seedCategory(id, { sortOrder: i + 1 })),
    seedCategory(EXPECTED_INSERT_CATEGORY_ID, { sortOrder: 4 }),
  ];
  source.seed("blog_categories", categories);
  dest.seed(
    "blog_categories",
    EXPECTED_SEED_CATEGORY_IDS.map((id, i) => seedCategory(id, { sortOrder: i + 1 })),
  );

  const posts: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts; i += 1) {
    const postId = `blog-post-${i}`;
    const mediaId = `media-${i}`;
    posts.push({
      _id: postId,
      postId,
      slug: `slug-${i}`,
      authorParticipantId: AUTHOR,
      categoryId: categories[i % categories.length]!.categoryId,
      status: "published",
      coverMedia: {
        mediaId,
        mediaUrl: `https://media-staging.huws.org/blog/${mediaId}.png`,
      },
      optimization: {
        socialImage: {
          mediaId,
          mediaUrl: `https://media-staging.huws.org/blog/${mediaId}.png`,
        },
      },
      content: `<p>Hello</p><img src="/api/v1/media/files/blog/${mediaId}.png" alt="x" />`,
    });
  }
  source.seed("blog_posts", posts);

  const mediaDocs = posts.map((p, i) => ({
    _id: `media-${i}`,
    mediaId: `media-${i}`,
    storageKey: `blog/media-${i}.png`,
    mediaUrl: `https://media-staging.huws.org/blog/media-${i}.png`,
    purpose: "blog-image",
    ownerParticipantId: AUTHOR,
  }));
  source.seed("media_upload_records", mediaDocs);
  dest.seed("media_upload_records", []);

  const subscribers: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers; i += 1) {
    subscribers.push({
      _id: `sub-${i}`,
      subscriberId: `sub-${i}`,
      emailNormalized: `user${i}@example.com`,
      emailDisplay: `user${i}@example.com`,
      subscriptionType: "blog_publications",
      status: i < 6 ? "not_confirmed" : "subscribed",
      confirmTokenHash: `hash-confirm-${i}`,
      unsubscribeTokenHash: `hash-unsub-${i}`,
      ...(i >= 15 ? { participantId: LINKED } : {}),
    });
  }
  source.seed("blog_subscribers", subscribers);

  const deliveries: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_publication_deliveries; i += 1) {
    deliveries.push({
      _id: `del-${i}`,
      deliveryId: `del-${i}`,
      postId: posts[i % posts.length]!.postId,
      subscriberId: subscribers[i % subscribers.length]!.subscriberId,
      status: "sent",
    });
  }
  source.seed("blog_publication_deliveries", deliveries);

  source.seed("blog_reactions", [
    {
      _id: "rxn-0",
      reactionId: "rxn-0",
      postId: posts[0]!.postId,
      actorParticipantId: ACTOR,
      reaction: "helpful",
    },
    {
      _id: "rxn-1",
      reactionId: "rxn-1",
      postId: posts[1]!.postId,
      actorParticipantId: ACTOR,
      reaction: "helpful",
    },
    {
      _id: "rxn-2",
      reactionId: "rxn-2",
      postId: posts[2]!.postId,
      actorParticipantId: ACTOR,
      reaction: "not_helpful",
    },
  ]);

  source.seed("blog_capability_grants", [
    { _id: "g1", participantId: AUTHOR, grantedByParticipantId: GRANTER },
    { _id: "g2", participantId: ACTOR, grantedByParticipantId: GRANTER },
    { _id: "g3", participantId: LINKED, grantedByParticipantId: GRANTER },
  ]);

  source.seed("blog_author_applications", [
    {
      _id: "app-1",
      applicationId: "app-1",
      participantId: AUTHOR,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["conscious_existence"],
    },
    {
      _id: "app-2",
      applicationId: "app-2",
      participantId: ACTOR,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["human_potential"],
    },
    {
      _id: "app-3",
      applicationId: "app-3",
      participantId: LINKED,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["our_life"],
    },
  ]);

  for (const name of [
    "blog_subscription_settings",
    "blog_admin_subscriber_messages",
    "blog_admin_subscriber_message_deliveries",
    "blog_comments",
  ] as const) {
    source.seed(name, []);
    dest.seed(name, []);
  }
  dest.seed("blog_posts", []);
  dest.seed("blog_subscribers", []);
  dest.seed("blog_publication_deliveries", []);
  dest.seed("blog_reactions", []);
  dest.seed("blog_capability_grants", []);
  dest.seed("blog_author_applications", []);

  for (const memberId of [AUTHOR, ACTOR, GRANTER, DECIDER, LINKED]) {
    const members = dest.store.get("members") ?? [];
    members.push({ _id: memberId, memberId });
    dest.store.set("members", members);
  }

  return { source, dest };
}

describe("Blog migration category classifiers", () => {
  it("classifies seed equivalence and divergence", () => {
    const base = {
      categoryId: "conscious_existence",
      slug: "conscious-existence",
      name: "Conscious Existence",
      status: "active",
      sortOrder: 1,
    };
    assert.equal(
      classifySeedCategoryPair({ source: base, destination: base }).classification,
      "EQUIVALENT",
    );
    assert.equal(
      classifySeedCategoryPair({
        source: base,
        destination: { ...base, sortOrder: 9 },
      }).classification,
      "EQUIVALENT_SORT_ORDER_DIFFERS",
    );
    assert.equal(
      classifySeedCategoryPair({
        source: base,
        destination: { ...base, name: "Other" },
      }).classification,
      "DIVERGENT",
    );
  });

  it("classifies human_potential insert and collisions", () => {
    const source = {
      categoryId: EXPECTED_INSERT_CATEGORY_ID,
      slug: "human-potential",
      name: "Human Potential",
      status: "active",
      sortOrder: 4,
    };
    assert.equal(
      classifyHumanPotentialCategory({
        source,
        destinationById: null,
        destinationBySlug: null,
      }).classification,
      "INSERT",
    );
    assert.equal(
      classifyHumanPotentialCategory({
        source,
        destinationById: source,
        destinationBySlug: null,
      }).classification,
      "DESTINATION_ID_COLLISION",
    );
    assert.equal(
      classifyHumanPotentialCategory({
        source,
        destinationById: null,
        destinationBySlug: {
          categoryId: "other",
          slug: "human-potential",
          name: "X",
          status: "active",
        },
      }).classification,
      "DESTINATION_SLUG_COLLISION",
    );
  });
});

describe("Blog migration media extraction", () => {
  it("extracts cover, social, and HTML img references", () => {
    const refs = extractMediaReferencesFromPost({
      postId: "blog-1",
      coverMedia: {
        mediaId: "m1",
        mediaUrl: "https://media-staging.huws.org/blog/m1.png",
      },
      optimization: {
        socialImage: {
          mediaId: "m2",
          mediaUrl: "https://media.huws.org/blog/m2.png",
        },
      },
      content: `<img src="/api/v1/media/files/blog/m3.png" /><img src='https://cdn.example/x.png' />`,
    });
    assert.equal(refs.length, 4);
    assert.ok(refs.some((r) => r.source === "coverMedia" && r.mediaId === "m1"));
    assert.ok(refs.some((r) => r.source === "socialImage" && r.mediaId === "m2"));
    assert.equal(refs.filter((r) => r.source === "content_img").length, 2);
    assert.equal(
      refs.find((r) => r.mediaId === "m1")?.hostClassification,
      "canonical_media_id",
    );
    assert.equal(
      refs.find((r) => r.mediaUrl?.includes("cdn.example"))?.hostClassification,
      "external_https_preserve",
    );
  });

  it("structured coverMedia with mediaId + r2.dev URL stays canonical", () => {
    const refs = extractMediaReferencesFromPost({
      postId: "blog-r2",
      coverMedia: {
        mediaId: "media-cover-1",
        mediaUrl:
          "https://pub-abc123.r2.dev/blog/media-cover-1.png",
      },
    });
    assert.equal(refs.length, 1);
    assert.equal(refs[0]!.hostClassification, "canonical_media_id");
    assert.equal(refs[0]!.mediaId, "media-cover-1");
    assert.equal(refs[0]!.externalHost, null);
  });

  it("socialImage with mediaId stays canonical even on arbitrary HTTPS host", () => {
    const refs = extractMediaReferencesFromPost({
      postId: "blog-social",
      optimization: {
        socialImage: {
          mediaId: "media-social-1",
          mediaUrl: "https://cdn.cloudflare.com/random/path.png",
        },
      },
    });
    assert.equal(refs[0]!.hostClassification, "canonical_media_id");
    assert.equal(refs[0]!.source, "socialImage");
  });

  it("host classification cannot demote canonical mediaId to external", () => {
    assert.equal(
      classifyMediaUrlHost("https://pub-xyz.r2.dev/blog/x.png"),
      "external_https_preserve",
    );
    const refs = extractMediaReferencesFromPost({
      postId: "blog-demote",
      coverMedia: {
        mediaId: "owned-1",
        mediaUrl: "https://pub-xyz.r2.dev/blog/x.png",
      },
    });
    assert.equal(refs[0]!.hostClassification, "canonical_media_id");
    assert.notEqual(refs[0]!.hostClassification, "external_https_preserve");
  });

  it("classifies external HTTPS HTML image as EXTERNAL_HTTPS_PRESERVE", () => {
    assert.equal(
      classifyMediaUrlHost(
        "https://i0.wp.com/huws.org/wp-content/uploads/2024/01/world-protection.jpg",
      ),
      "external_https_preserve",
    );
    const refs = extractMediaReferencesFromPost({
      postId: "blog-81dfe8bf-08b4-488e-8c90-ccc5a240422a",
      coverMedia: {
        mediaId: "cover-1",
        mediaUrl: "https://pub-abc.r2.dev/blog/cover-1.png",
      },
      content: `<p>Hello</p><img src="https://i0.wp.com/huws.org/wp-content/uploads/2024/01/world-protection.jpg" alt="WPC" />`,
    });
    const cover = refs.find((r) => r.source === "coverMedia");
    assert.equal(cover?.hostClassification, "canonical_media_id");
    const external = refs.find((r) => r.hostClassification === "external_https_preserve");
    assert.ok(external);
    assert.equal(external!.externalHost, "i0.wp.com");
    assert.equal(external!.source, "content_img");
    assert.equal(external!.mediaId, null);
  });

  it("external URL is not converted to storageKey", () => {
    assert.equal(
      storageKeyFromMediaUrl(
        "https://i0.wp.com/huws.org/wp-content/uploads/2024/01/world-protection.jpg",
      ),
      null,
    );
    assert.equal(
      storageKeyFromMediaUrl("/api/v1/media/files/blog/cover-1.png"),
      "blog/cover-1.png",
    );
    assert.equal(
      storageKeyFromMediaUrl("https://media.huws.org/blog/cover-1.png"),
      "blog/cover-1.png",
    );
  });
});

describe("Production Blog migration preflight — Task 02", () => {
  it("exact expected inventory → PASS (R2 deferred)", async () => {
    const { source, dest } = seedPerfectSource();
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      sourceDatabase: "humanity_union_staging",
      destinationDatabase: "humanity_union_production",
      r2Configured: false,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        emailSends: 0,
        outboxWrites: 0,
      },
    });
    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.sourceInventory.counts.blog_posts, 14);
    assert.equal(report.categories.humanPotential.classification, "INSERT");
    assert.equal(report.media.uniqueMediaIds.length, 14);
    assert.equal(report.media.uniqueStorageKeys.length, 14);
    assert.equal(report.media.canonicalStructuredMediaCount, 28); // cover + social per post
    assert.equal(report.media.r2ObjectVerification, "DEFERRED");
    assert.equal(report.media.expectedCanonicalObjects, 14);
    assert.equal(report.media.mediaCopyReady, false);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.tokenPolicy.rotateTokens, false);
    assertNoSecretLeak(JSON.stringify(report));
  });

  it("r2.dev cover mediaUrl with mediaId resolves storageKeys (not external preserve)", async () => {
    const { source, dest } = seedPerfectSource();
    for (const post of source.store.get("blog_posts")!) {
      const mediaId = (post.coverMedia as { mediaId: string }).mediaId;
      post.coverMedia = {
        mediaId,
        mediaUrl: `https://pub-staging.r2.dev/blog/${mediaId}.png`,
      };
      post.optimization = undefined;
      post.content = "<p>no images</p>";
    }
    // One post keeps legacy external HTML image
    const first = source.store.get("blog_posts")![0]!;
    first.content = `<img src="https://i0.wp.com/huws.org/wp-content/uploads/x.jpg" />`;

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        emailSends: 0,
        outboxWrites: 0,
      },
    });
    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.media.bySource.coverMedia, 14);
    assert.equal(report.media.bySource.content_img, 1);
    assert.equal(report.media.canonicalStructuredMediaCount, 14);
    assert.equal(report.media.externalHttpsPreserveCount, 1);
    assert.deepEqual(report.media.externalHttpsHosts, ["i0.wp.com"]);
    assert.equal(report.media.uniqueMediaIds.length, 14);
    assert.equal(report.media.uniqueStorageKeys.length, 14);
    assert.equal(report.media.missingMediaRecords.length, 0);
    assert.equal(report.media.unresolvedReferences, 0);
    assert.equal(report.media.mediaCopyReady, false);
  });

  it("category divergence → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    dest.store.get("blog_categories")![0]!.name = "Renamed";
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.ok(report.blockers.some((b) => /divergent/i.test(b)));
  });

  it("human_potential destination id collision → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    dest.seed("blog_categories", [
      ...dest.store.get("blog_categories")!,
      seedCategory(EXPECTED_INSERT_CATEGORY_ID),
    ]);
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.equal(
      report.categories.humanPotential.classification,
      "DESTINATION_ID_COLLISION",
    );
  });

  it("subscriber email-type collision reports opaque subscriberId only", async () => {
    const { source, dest } = seedPerfectSource();
    dest.seed("blog_subscribers", [
      {
        _id: "prod-sub",
        subscriberId: "prod-sub",
        emailNormalized: "user0@example.com",
        subscriptionType: "blog_publications",
      },
    ]);
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.deepEqual(report.destinationCollisions.subscriberEmailTypeOpaqueIds, ["sub-0"]);
    const text = JSON.stringify(report);
    assert.equal(text.includes("user0@example.com"), false);
    assert.equal(text.includes("emailNormalized"), false);
    assertNoSecretLeak(text);
  });

  it("composite business-key collisions (delivery + reaction)", async () => {
    const { source, dest } = seedPerfectSource();
    dest.seed("blog_publication_deliveries", [
      {
        _id: "d",
        deliveryId: "other-del",
        postId: "blog-post-0",
        subscriberId: "sub-0",
      },
    ]);
    dest.seed("blog_reactions", [
      {
        _id: "r",
        reactionId: "other-rxn",
        postId: "blog-post-0",
        actorParticipantId: ACTOR,
      },
    ]);
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.ok(report.destinationCollisions.deliveryPostSubscriber.includes("blog-post-0::sub-0"));
    assert.ok(
      report.destinationCollisions.reactionPostActor.includes(`blog-post-0::${ACTOR}`),
    );
  });

  it("Participant FK failure → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    dest.seed("members", []);
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.ok(report.participantForeignKeys.missing.length > 0);
  });

  it("missing media record → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    source.seed("media_upload_records", []);
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.ok(report.media.missingMediaRecords.length > 0);
  });

  it("external HTTPS HTML image preserved — does not block or invent storageKey", async () => {
    const { source, dest } = seedPerfectSource();
    const posts = source.store.get("blog_posts")!;
    const target = posts.find((p) => p.postId === "blog-post-0")!;
    target.postId = "blog-81dfe8bf-08b4-488e-8c90-ccc5a240422a";
    target._id = "blog-81dfe8bf-08b4-488e-8c90-ccc5a240422a";
    target.title = "World Protection Corps";
    target.content = `<p>Legacy</p><img src="https://i0.wp.com/huws.org/wp-content/uploads/2024/01/world-protection.jpg" alt="WPC" />`;
    // Keep cover mediaId media-0 with existing upload record.
    target.coverMedia = {
      mediaId: "media-0",
      mediaUrl: "https://media-staging.huws.org/blog/media-0.png",
    };
    target.optimization = {
      socialImage: {
        mediaId: "media-0",
        mediaUrl: "https://media-staging.huws.org/blog/media-0.png",
      },
    };
    // Fix delivery/reaction FKs that pointed at blog-post-0
    for (const d of source.store.get("blog_publication_deliveries") ?? []) {
      if (d.postId === "blog-post-0") {
        d.postId = "blog-81dfe8bf-08b4-488e-8c90-ccc5a240422a";
      }
    }
    for (const r of source.store.get("blog_reactions") ?? []) {
      if (r.postId === "blog-post-0") {
        r.postId = "blog-81dfe8bf-08b4-488e-8c90-ccc5a240422a";
      }
    }

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        emailSends: 0,
        outboxWrites: 0,
      },
    });
    assert.equal(report.overallVerdict, "PASS");
    assert.ok(report.media.externalHttpsPreserveCount >= 1);
    assert.ok(report.media.externalHttpsHosts.includes("i0.wp.com"));
    assert.equal(report.media.unresolvedReferences, 0);
    assert.equal(report.media.missingMediaRecords.length, 0);
    assert.equal(
      report.media.uniqueStorageKeys.some((k) => /i0\.wp\.com|wp-content/i.test(k)),
      false,
    );
    const text = JSON.stringify(report);
    assert.equal(text.includes("world-protection.jpg"), false);
    assertNoSecretLeak(text);
  });

  it("no sensitive values in serialized reports", async () => {
    const { source, dest } = seedPerfectSource();
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    const stripped = stripForbiddenReportFields({
      ...report,
      leak: {
        emailNormalized: "secret@example.com",
        confirmTokenHash: "abc",
        content: "<p>private</p>",
      },
    });
    const text = JSON.stringify(stripped);
    assert.equal(text.includes("secret@example.com"), false);
    assert.equal(text.includes("confirmTokenHash"), false);
    assert.equal(text.includes("<p>private</p>"), false);
    assertNoSecretLeak(JSON.stringify(report));
  });

  it("zero-write proof refuses PASS when counters nonzero", async () => {
    const { source, dest } = seedPerfectSource();
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
      mutationCounters: {
        mongoWrites: 1,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        emailSends: 0,
        outboxWrites: 0,
      },
    });
    assert.equal(report.overallVerdict, "BLOCKED");
    assert.ok(report.blockers.some((b) => /mutation detected/i.test(b)));
  });

  it("R2 deferred when credentials unset", async () => {
    const { source, dest } = seedPerfectSource();
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
    });
    assert.equal(report.media.r2ObjectVerification, "DEFERRED");
    assert.equal(report.media.expectedCanonicalObjects, 14);
    assert.equal(report.media.mediaCopyReady, false);
  });
});

describe("Production Blog migration preflight — Task 03 R2", () => {
  const ZERO_MUTATIONS = {
    mongoWrites: 0,
    putObjectCalls: 0,
    deleteObjectCalls: 0,
    emailSends: 0,
    outboxWrites: 0,
  } as const;

  function seedAllSourcePresent(inspector: InMemoryBlogR2Inspector): string[] {
    const keys: string[] = [];
    for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts; i += 1) {
      const key = `blog/media-${i}.png`;
      keys.push(key);
      inspector.seedSource(key, {
        body: Buffer.from(`blog-media-body-${i}`),
        contentType: "image/png",
      });
    }
    return keys;
  }

  it("all source present + destination absent → PASS + mediaCopyReady", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    seedAllSourcePresent(inspector);

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: true,
      r2Inspector: inspector,
      mutationCounters: ZERO_MUTATIONS,
    });

    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.media.r2ObjectVerification, "PASS");
    assert.equal(report.media.expectedCanonicalObjects, 14);
    assert.equal(report.media.sourceObjectsPresent, 14);
    assert.deepEqual(report.media.sourceObjectsMissing, []);
    assert.equal(report.media.destinationAbsent, 14);
    assert.equal(report.media.destinationEquivalent, 0);
    assert.deepEqual(report.media.destinationCollisions, []);
    assert.equal(report.media.mediaCopyReady, true);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
  });

  it("safely equivalent destination → PASS + mediaCopyReady", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const keys = seedAllSourcePresent(inspector);
    for (const key of keys) {
      const head = await inspector.headSourceObject(key);
      assert.ok(head);
      inspector.seedDestination(key, { ...head });
    }

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: true,
      r2Inspector: inspector,
      mutationCounters: ZERO_MUTATIONS,
    });

    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.media.r2ObjectVerification, "PASS");
    assert.equal(report.media.destinationAbsent, 0);
    assert.equal(report.media.destinationEquivalent, 14);
    assert.deepEqual(report.media.destinationCollisions, []);
    assert.equal(report.media.mediaCopyReady, true);
  });

  it("missing source object → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    seedAllSourcePresent(inspector);
    inspector.source.delete("blog/media-3.png");

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: true,
      r2Inspector: inspector,
      mutationCounters: ZERO_MUTATIONS,
    });

    assert.equal(report.overallVerdict, "BLOCKED");
    assert.equal(report.media.r2ObjectVerification, "FAIL");
    assert.equal(report.media.sourceObjectsPresent, 13);
    assert.deepEqual(report.media.sourceObjectsMissing, ["blog/media-3.png"]);
    assert.equal(report.media.mediaCopyReady, false);
    assert.ok(report.blockers.some((b) => /Source R2 object missing/i.test(b)));
  });

  it("destination collision (length-only, no hash) → BLOCKED", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    seedAllSourcePresent(inspector);
    inspector.seedDestination("blog/media-0.png", {
      contentLength: Buffer.from("blog-media-body-0").byteLength,
      contentType: "image/png",
      checksumSHA256: null,
    });

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: true,
      r2Inspector: inspector,
      mutationCounters: ZERO_MUTATIONS,
    });

    assert.equal(report.overallVerdict, "BLOCKED");
    assert.equal(report.media.r2ObjectVerification, "FAIL");
    assert.deepEqual(report.media.destinationCollisions, ["blog/media-0.png"]);
    assert.equal(report.media.mediaCopyReady, false);
    assert.ok(report.blockers.some((b) => /Destination R2 collision/i.test(b)));
  });

  it("external HTTPS image excluded from R2 verification keys", async () => {
    const { source, dest } = seedPerfectSource();
    const first = source.store.get("blog_posts")![0]!;
    first.content = `<p>x</p><img src="https://i0.wp.com/huws.org/wp-content/uploads/2024/01/world-protection.jpg" />`;
    first.optimization = undefined;

    const inspector = new InMemoryBlogR2Inspector();
    seedAllSourcePresent(inspector);

    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: true,
      r2Inspector: inspector,
      mutationCounters: ZERO_MUTATIONS,
    });

    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.media.externalHttpsPreserveCount, 1);
    assert.deepEqual(report.media.externalHttpsHosts, ["i0.wp.com"]);
    assert.equal(report.media.expectedCanonicalObjects, 14);
    assert.equal(report.media.uniqueStorageKeys.length, 14);
    assert.equal(
      report.media.uniqueStorageKeys.some((k) => /i0\.wp\.com|wp-content/i.test(k)),
      false,
    );
    assert.equal(report.media.r2ObjectVerification, "PASS");
    assert.equal(report.media.mediaCopyReady, true);
    const text = JSON.stringify(report);
    assert.equal(text.includes("world-protection.jpg"), false);
  });

  it("zero PUT/DELETE during R2 preflight", async () => {
    const inspector = new InMemoryBlogR2Inspector();
    const keys = seedAllSourcePresent(inspector);
    const r2 = await verifyCanonicalBlogR2Objects({ storageKeys: keys, inspector });
    assert.equal(r2.putObjectCalls, 0);
    assert.equal(r2.deleteObjectCalls, 0);
    assert.equal(inspector.getWriteCount(), 0);
    assert.equal(inspector.getDeleteCount(), 0);
    assert.equal(r2.r2ObjectVerification, "PASS");
  });

  it("PutObject detection refuses R2 PASS", async () => {
    const inspector = new InMemoryBlogR2Inspector();
    seedAllSourcePresent(inspector);
    inspector.writeCount = 1;
    const r2 = await verifyCanonicalBlogR2Objects({
      storageKeys: ["blog/media-0.png"],
      inspector,
    });
    assert.equal(r2.r2ObjectVerification, "FAIL");
    assert.equal(r2.mediaCopyReady, false);
    assert.ok(r2.blockers.some((b) => /PutObject\/DeleteObject/i.test(b)));
  });

  it("classify: ABSENT / EQUIVALENT / COLLISION", () => {
    const source = {
      contentLength: 10,
      contentType: "image/png",
      checksumSHA256: "a".repeat(64),
    };
    assert.equal(
      classifyBlogDestinationR2Object({ source, destination: null }),
      "ABSENT",
    );
    assert.equal(
      classifyBlogDestinationR2Object({
        source,
        destination: { ...source },
      }),
      "EQUIVALENT",
    );
    assert.equal(
      classifyBlogDestinationR2Object({
        source,
        destination: { ...source, checksumSHA256: null },
      }),
      "COLLISION",
    );
    assert.equal(
      classifyBlogDestinationR2Object({
        source,
        destination: { ...source, contentLength: 11 },
      }),
      "COLLISION",
    );
  });

  it("Mongo preflight still PASS with R2 deferred (no regression)", async () => {
    const { source, dest } = seedPerfectSource();
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      r2Configured: false,
      mutationCounters: ZERO_MUTATIONS,
    });
    assert.equal(report.overallVerdict, "PASS");
    assert.equal(report.media.r2ObjectVerification, "DEFERRED");
    assert.equal(report.media.expectedCanonicalObjects, 14);
    assert.equal(report.media.uniqueMediaIds.length, 14);
    assert.equal(report.media.mediaCopyReady, false);
  });
});
