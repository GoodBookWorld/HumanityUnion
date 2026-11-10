/**
 * HU-LC-05C.4C.3A — Sign / Withdraw refresh the public Petition's signature
 * counters from the server immediately, without navigation or reload.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

import type { PublicPetitionProjection } from "@hu/types";

import { createPetitionSignatureRefresher } from "./petition-signature-refresh";

const here = path.dirname(fileURLToPath(import.meta.url));

function projection(
  petitionId: string,
  input: {
    viewerHasSigned: boolean;
    participantSignatures: number;
    memberSignatures?: number;
    visitorSignals?: number;
  },
): PublicPetitionProjection {
  return {
    petitionIdentity: { petitionId, title: `Petition ${petitionId}` },
    viewerHasSigned: input.viewerHasSigned,
    supportBreakdown: {
      participantSignatures: input.participantSignatures,
      memberSignatures: input.memberSignatures ?? 0,
      visitorSignals: input.visitorSignals ?? 0,
    },
  } as unknown as PublicPetitionProjection;
}

/** A fetch whose responses the test resolves or rejects explicitly. */
function controlledFetch() {
  const pending: Array<{
    petitionId: string;
    resolve: (value: PublicPetitionProjection) => void;
    reject: (error: Error) => void;
  }> = [];
  const fetchProjection = (petitionId: string) =>
    new Promise<PublicPetitionProjection>((resolve, reject) => {
      pending.push({ petitionId, resolve, reject });
    });
  return { fetchProjection, pending };
}

let state: PublicPetitionProjection | null;
let showPetition: (petitionId: string) => void = () => undefined;

function harness() {
  const fetch = controlledFetch();
  const refresher = createPetitionSignatureRefresher(
    {
      fetchProjection: fetch.fetchProjection,
      applyProjection: (update) => {
        state = update(state);
      },
    },
    "petition-a",
  );
  showPetition = refresher.showPetition;
  return { refresh: refresher.afterSignatureChange, pending: fetch.pending };
}

const counts = (value: PublicPetitionProjection | null) => value?.supportBreakdown;

describe("HU-LC-05C.4C.3A — Petition signature counters refresh", () => {
  beforeEach(() => {
    state = projection("petition-a", { viewerHasSigned: false, participantSignatures: 0 });
  });

  it("A — signing shows the signed state immediately, without inventing counts", () => {
    const { refresh, pending } = harness();
    void refresh("petition-a", true);

    assert.equal(state?.viewerHasSigned, true);
    assert.deepEqual(counts(state), {
      participantSignatures: 0,
      memberSignatures: 0,
      visitorSignals: 0,
    });
    assert.deepEqual(
      pending.map((request) => request.petitionId),
      ["petition-a"],
    );
  });

  it("B — signing then shows the server's counts, all three fields", async () => {
    const { refresh, pending } = harness();
    const done = refresh("petition-a", true);
    const fresh = projection("petition-a", {
      viewerHasSigned: true,
      participantSignatures: 1,
      memberSignatures: 1,
      visitorSignals: 4,
    });
    pending[0]!.resolve(fresh);
    await done;

    assert.equal(state, fresh);
    assert.deepEqual(counts(state), {
      participantSignatures: 1,
      memberSignatures: 1,
      visitorSignals: 4,
    });
  });

  it("C — withdrawal updates at once, then shows the server's counts", async () => {
    state = projection("petition-a", { viewerHasSigned: true, participantSignatures: 1 });
    const { refresh, pending } = harness();
    const done = refresh("petition-a", false);
    assert.equal(state?.viewerHasSigned, false);
    assert.equal(counts(state)?.participantSignatures, 1);

    pending[0]!.resolve(
      projection("petition-a", { viewerHasSigned: false, participantSignatures: 0 }),
    );
    await done;
    assert.equal(state?.viewerHasSigned, false);
    assert.equal(counts(state)?.participantSignatures, 0);
  });

  it("D — a failed refresh keeps the immediate signed state", async () => {
    const { refresh, pending } = harness();
    const done = refresh("petition-a", true);
    pending[0]!.reject(new Error("Network unavailable"));
    await done;

    assert.equal(state?.viewerHasSigned, true);
    assert.equal(counts(state)?.participantSignatures, 0);
  });

  it("E — switching Petition during the refresh never shows the other Petition's counts", async () => {
    const { refresh, pending } = harness();
    const done = refresh("petition-a", true);

    // The view moves to Petition B before A's refresh returns.
    showPetition("petition-b");
    const petitionB = projection("petition-b", {
      viewerHasSigned: false,
      participantSignatures: 7,
    });
    state = petitionB;
    pending[0]!.resolve(
      projection("petition-a", { viewerHasSigned: true, participantSignatures: 1 }),
    );
    await done;

    assert.equal(state, petitionB);
  });

  it("E — a switch that has not replaced the old projection yet still ignores the late response", async () => {
    const { refresh, pending } = harness();
    const done = refresh("petition-a", true);
    const immediate = state;

    // Petition B is now selected; its projection is still loading.
    showPetition("petition-b");
    pending[0]!.resolve(
      projection("petition-a", { viewerHasSigned: true, participantSignatures: 1 }),
    );
    await done;

    assert.equal(state, immediate);
    assert.equal(counts(state)?.participantSignatures, 0);
  });

  it("E — a response for a different Petition is ignored", async () => {
    const { refresh, pending } = harness();
    const done = refresh("petition-a", true);
    pending[0]!.resolve(
      projection("petition-b", { viewerHasSigned: true, participantSignatures: 9 }),
    );
    await done;

    assert.equal(state?.petitionIdentity.petitionId, "petition-a");
    assert.equal(counts(state)?.participantSignatures, 0);
  });

  it("E — an older refresh never overwrites a newer change", async () => {
    const { refresh, pending } = harness();
    const signed = refresh("petition-a", true);
    const withdrawn = refresh("petition-a", false);

    pending[1]!.resolve(
      projection("petition-a", { viewerHasSigned: false, participantSignatures: 0 }),
    );
    await withdrawn;
    pending[0]!.resolve(
      projection("petition-a", { viewerHasSigned: true, participantSignatures: 1 }),
    );
    await signed;

    assert.equal(state?.viewerHasSigned, false);
    assert.equal(counts(state)?.participantSignatures, 0);
  });

  it("the immediate update never touches another Petition's projection", () => {
    state = projection("petition-b", { viewerHasSigned: false, participantSignatures: 3 });
    const { refresh } = harness();
    void refresh("petition-a", true);

    assert.equal(state?.petitionIdentity.petitionId, "petition-b");
    assert.equal(state?.viewerHasSigned, false);
  });

  it("the public result wires Sign / Withdraw to the server refresh", () => {
    const source = readFileSync(
      path.join(here, "components/InitiativePetitionPublicResult.tsx"),
      "utf8",
    );
    assert.match(
      source,
      /createPetitionSignatureRefresher\(\s*\{ fetchProjection: getPublicPetition, applyProjection: setProjection \},\s*petitionId,\s*\)/,
    );
    assert.match(source, /signatureRefresher\.showPetition\(petitionId\)/);
    assert.match(
      source,
      /onSignatureChange=\{\(viewerHasSigned\) =>\s*\{?\s*void signatureRefresher\.afterSignatureChange\(\s*petitionIdentity\.petitionId,\s*viewerHasSigned,\s*\)/,
    );
    assert.doesNotMatch(source, /(participantSignatures|memberSignatures|visitorSignals)\s*[+-]/);
  });
});
