import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * UX Evolution Pack 03 Part 2/9/10/12 — Initiative Cover Media persistence
 * and authorization tests (createInitiativeDraft / saveInitiativeDraft),
 * exercising the real `resolveCoverMediaUpdate` synchronization logic in
 * `initiative.service.ts`.
 *
 * Forced to `INITIATIVE_PERSISTENCE=memory` *before* the first import of
 * `initiative.store.js` anywhere in this process (mirrors the pattern in
 * `test/unit/participation-area/participation-area-cleanup.test.ts`), so
 * this test can never write a residual fixture Initiative into the real,
 * file-backed `.runtime/initiatives.json` used by the dev server.
 */
process.env.INITIATIVE_PERSISTENCE = "memory";

const { createInitiativeDraft, saveInitiativeDraft } = await import(
  "../../../src/modules/initiatives/initiative.service.js"
);
const { getInitiativeById } = await import("../../../src/modules/initiatives/initiative.store.js");
const { resolveInitiativeCoverMedia } = await import("@hu/types");

const STEWARD_IDENTITY = { participantId: "cover-media-steward" };
const OTHER_IDENTITY = { participantId: "cover-media-intruder" };

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Cover Media Fixture Initiative",
    description: "Fixture Initiative for cover media persistence tests.",
    activityArea: "Environment and Climate",
    ...overrides,
  } as never;
}

describe("createInitiativeDraft / saveInitiativeDraft — coverMedia sync (resolveCoverMediaUpdate)", () => {
  it("creates a legacy image-only Initiative unaffected when coverMedia is omitted (test #1, #26)", () => {
    const initiative = createInitiativeDraft(STEWARD_IDENTITY, draftInput({ imageUrl: "/api/v1/media/files/initiatives/legacy.jpg" }));

    assert.equal(initiative.metadata.imageUrl, "/api/v1/media/files/initiatives/legacy.jpg");
    assert.equal(initiative.metadata.coverMedia, undefined);
    assert.deepEqual(resolveInitiativeCoverMedia(initiative.metadata), {
      type: "image",
      url: "/api/v1/media/files/initiatives/legacy.jpg",
      verificationStatus: "approved",
    });
  });

  it("keeps imageUrl in sync when coverMedia is an approved image", () => {
    const initiative = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({
        coverMedia: {
          type: "image",
          url: "/api/v1/media/files/initiatives/new-cover.jpg",
          verificationStatus: "approved",
        },
      }),
    );

    assert.equal(initiative.metadata.imageUrl, "/api/v1/media/files/initiatives/new-cover.jpg");
    assert.equal(initiative.metadata.coverMedia?.type, "image");
  });

  it("clears the legacy imageUrl when coverMedia is set to an external video (no stale image fallback)", () => {
    const initiative = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({
        coverMedia: {
          type: "video_external",
          url: "https://vimeo.com/76979871",
          provider: "vimeo",
          providerVideoId: "76979871",
          verificationStatus: "approved",
        },
      }),
    );

    assert.equal(initiative.metadata.imageUrl, undefined);
    assert.equal(initiative.metadata.coverMedia?.type, "video_external");
  });

  it("replaces an existing image with a video link on save, clearing imageUrl (test #9 layout/#20 adjacent)", () => {
    const created = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({ imageUrl: "/api/v1/media/files/initiatives/before.jpg" }),
    );

    const updated = saveInitiativeDraft(STEWARD_IDENTITY, created.initiativeId, {
      coverMedia: {
        type: "video_external",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        provider: "youtube",
        providerVideoId: "dQw4w9WgXcQ",
        verificationStatus: "approved",
      },
    });

    assert.equal(updated.metadata.imageUrl, undefined);
    assert.equal(updated.metadata.coverMedia?.provider, "youtube");
  });

  it("clears both coverMedia and imageUrl on an explicit Remove Media action", () => {
    const created = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({ imageUrl: "/api/v1/media/files/initiatives/before-remove.jpg" }),
    );

    const updated = saveInitiativeDraft(STEWARD_IDENTITY, created.initiativeId, {
      clearCoverMedia: true,
    });

    assert.equal(updated.metadata.imageUrl, undefined);
    assert.equal(updated.metadata.coverMedia, undefined);
    assert.equal(resolveInitiativeCoverMedia(updated.metadata), undefined);
  });

  it("leaves coverMedia/imageUrl untouched when a save omits both fields entirely", () => {
    const created = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({ imageUrl: "/api/v1/media/files/initiatives/untouched.jpg" }),
    );

    const updated = saveInitiativeDraft(STEWARD_IDENTITY, created.initiativeId, {
      title: "Renamed Fixture Initiative",
    });

    assert.equal(updated.metadata.imageUrl, "/api/v1/media/files/initiatives/untouched.jpg");
  });

  it("rejects a cover media change from a participant who does not own the Initiative (test #21)", () => {
    const created = createInitiativeDraft(
      STEWARD_IDENTITY,
      draftInput({ imageUrl: "/api/v1/media/files/initiatives/owned.jpg" }),
    );

    assert.throws(
      () =>
        saveInitiativeDraft(OTHER_IDENTITY, created.initiativeId, {
          clearCoverMedia: true,
        }),
      /You do not have access to this initiative\./,
    );

    // Confirm the media survived the rejected attempt (test #20 adjacent).
    assert.equal(
      getInitiativeById(created.initiativeId)?.metadata.imageUrl,
      "/api/v1/media/files/initiatives/owned.jpg",
    );
  });
});
