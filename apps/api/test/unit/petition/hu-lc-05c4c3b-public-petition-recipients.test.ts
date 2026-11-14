/**
 * HU-LC-05C.4C.3B — public Petition projection exposes Author-provided
 * recipients additively; every earlier Petition (no recipients) is unchanged.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Petition, PetitionSubject } from "@hu/types";

import { defaultPetitionPolicy } from "../../../src/modules/petition/petition.defaults.js";
import { buildShareLink } from "../../../src/modules/petition/petition.helpers.js";
import { buildPublicPetitionHref } from "../../../src/modules/petition/public-petition-href.js";
import { toPublicPetitionProjection } from "../../../src/modules/petition/public-petition.projection.js";

function openPetition(subject: Partial<PetitionSubject> = {}): Petition {
  const now = new Date().toISOString();
  return {
    petitionId: "petition-lc05c4c3b-recipients",
    collectiveDecisionId: "decision-lc05c4c3b-recipients",
    status: "Open",
    createdAt: now,
    updatedAt: now,
    subject: {
      decisionId: "decision-lc05c4c3b-recipients",
      initiativeId: "initiative-lc05c4c3b-recipients",
      title: "Safe crossings near every school",
      summary: "Residents ask for protected crossings on school routes.",
      ...subject,
    },
    policy: structuredClone(defaultPetitionPolicy),
    shareLink: null,
    signatures: [],
    supportMetrics: {
      totalSignatures: 0,
      participantSignatures: 0,
      dailyActivity: [],
      supportThresholdStatus: {
        thresholdDefined: false,
        thresholdReached: false,
        currentCount: 0,
        thresholdCount: null,
      },
    },
  } as unknown as Petition;
}

describe("HU-LC-05C.4C.3B — public Petition recipients projection", () => {
  it("projects recorded recipients as trimmed, non-empty public text", async () => {
    const projection = await toPublicPetitionProjection(
      openPetition({ recipients: ["  City Council ", "", "   ", "Department of Transport"] }),
    );

    assert.ok(projection);
    assert.deepEqual(projection.petitionSubject.recipients, [
      "City Council",
      "Department of Transport",
    ]);
  });

  it("omits recipients for Petitions that never recorded any", async () => {
    for (const subject of [{}, { recipients: [] }, { recipients: [" ", ""] }]) {
      const projection = await toPublicPetitionProjection(openPetition(subject));
      assert.ok(projection);
      assert.equal(Object.hasOwn(projection.petitionSubject, "recipients"), false);
    }
  });

  it("ignores malformed stored recipient values instead of failing the public page", async () => {
    const projection = await toPublicPetitionProjection(
      openPetition({ recipients: "City Council" as unknown as readonly string[] }),
    );
    assert.ok(projection);
    assert.equal(Object.hasOwn(projection.petitionSubject, "recipients"), false);

    const mixed = await toPublicPetitionProjection(
      openPetition({ recipients: [42, "Mayor", null] as unknown as readonly string[] }),
    );
    assert.deepEqual(mixed?.petitionSubject.recipients, ["Mayor"]);
  });

  it("keeps every existing subject field and still hides non-public Petitions", async () => {
    const projection = await toPublicPetitionProjection(
      openPetition({
        requestStatement: "Install signalised crossings.",
        expectedOutcome: "Fewer collisions.",
        supportingContext: "Two collisions last year.",
        keyArguments: ["Daily routes"],
        recipients: ["City Council"],
      }),
    );
    assert.ok(projection);
    assert.deepEqual(projection.petitionSubject, {
      subjectType: "Initiative",
      initiativeId: "initiative-lc05c4c3b-recipients",
      title: "Safe crossings near every school",
      summary: "Residents ask for protected crossings on school routes.",
      requestStatement: "Install signalised crossings.",
      expectedOutcome: "Fewer collisions.",
      supportingContext: "Two collisions last year.",
      keyArguments: ["Daily routes"],
      recipients: ["City Council"],
    });

    const draft = {
      ...openPetition({ recipients: ["City Council"] }),
      status: "Draft",
    } as Petition;
    assert.equal(await toPublicPetitionProjection(draft), null);
  });

  it("HU-LC-05C.4C.7F.3 — the canonical public Petition URL selects that Petition", () => {
    assert.equal(
      buildPublicPetitionHref("initiative-a", "petition-b"),
      "/initiatives/public/initiative-a?petition=petition-b#petition",
    );
    assert.equal(
      buildPublicPetitionHref("init/1 a", "pet&2?#"),
      "/initiatives/public/init%2F1%20a?petition=pet%262%3F%23#petition",
    );
    assert.deepEqual(buildShareLink("initiative-a", "petition-b", "2026-11-14T00:00:00.000Z"), {
      url: "/initiatives/public/initiative-a?petition=petition-b#petition",
      createdAt: "2026-11-14T00:00:00.000Z",
    });
  });

  it("HU-LC-05C.4C.7F.3 — two Petitions of one Initiative share distinct URLs", async () => {
    const first = await toPublicPetitionProjection({
      ...openPetition(),
      petitionId: "petition-lc05c4c3b-a",
    });
    const second = await toPublicPetitionProjection({
      ...openPetition(),
      petitionId: "petition-lc05c4c3b-b",
    });
    assert.equal(
      first?.shareReference.url,
      "/initiatives/public/initiative-lc05c4c3b-recipients?petition=petition-lc05c4c3b-a#petition",
    );
    assert.equal(
      second?.shareReference.url,
      "/initiatives/public/initiative-lc05c4c3b-recipients?petition=petition-lc05c4c3b-b#petition",
    );
    assert.notEqual(first?.shareReference.url, second?.shareReference.url);
  });
});
