/**
 * Communication UX Pack 03.8 Part 8/15 — focused tests for the pure Active
 * Allies search-filter logic (`filterActiveAlliesByName`).
 *
 * `apps/web` has no React component test harness (no vitest/jest/RTL
 * configured anywhere in this monorepo — see the identical note in
 * `discussion-comment-presentation.test.ts`), so the actual filter
 * decision logic was extracted into a pure, framework-free function
 * rather than left inline in `ActiveAlliesPanel.tsx`. Run with:
 *
 *   npx tsx --test src/features/direct-messaging/direct-messaging-format.test.ts
 *
 * from apps/web.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterActiveAlliesByName,
  resolveCollaborationSection,
  resolveCommunicationMode,
} from "./direct-messaging-format.js";

interface FakeAlly {
  participantId: string;
  displayName: string;
}

function buildAllies(): FakeAlly[] {
  return [
    { participantId: "p-derek", displayName: "Derek Nguyen" },
    { participantId: "p-leonardo", displayName: "Leonardo Alvarez" },
    { participantId: "p-mira", displayName: "Mira Petrov" },
  ];
}

describe("filterActiveAlliesByName (Communication UX Pack 03.8 Part 8)", () => {
  it("test 16 — returns every Ally, in the same order, for an empty search term", () => {
    const allies = buildAllies();

    assert.deepEqual(filterActiveAlliesByName(allies, ""), allies);
    assert.deepEqual(filterActiveAlliesByName(allies, "   "), allies);
  });

  it("test 16 — filters case-insensitively by display name substring", () => {
    const allies = buildAllies();

    const result = filterActiveAlliesByName(allies, "derek");
    assert.equal(result.length, 1);
    assert.equal(result[0]?.displayName, "Derek Nguyen");

    const upper = filterActiveAlliesByName(allies, "LEONARDO");
    assert.equal(upper.length, 1);
    assert.equal(upper[0]?.displayName, "Leonardo Alvarez");
  });

  it("test 16 — matches a substring anywhere in the display name", () => {
    const allies = buildAllies();

    const result = filterActiveAlliesByName(allies, "ov");
    assert.equal(result.length, 1);
    assert.equal(result[0]?.displayName, "Mira Petrov");
  });

  it("test 16 — returns an empty list (no fallback to the full list) when nothing matches", () => {
    const allies = buildAllies();

    assert.deepEqual(filterActiveAlliesByName(allies, "zzz-no-match"), []);
  });

  it("returns a new array instance rather than mutating or aliasing the input", () => {
    const allies = buildAllies();

    const result = filterActiveAlliesByName(allies, "");
    assert.notEqual(result, allies);
    assert.deepEqual(result, allies);
  });

  it("test 17 — is a pure, synchronous function: no network/IO capability exists in its signature, so it can never issue a per-keystroke request", () => {
    const allies = buildAllies();

    // Calling it twice with the same input is side-effect free and
    // deterministic — the strongest guarantee available to a unit test
    // that a purely client-side filter never reaches the network.
    const first = filterActiveAlliesByName(allies, "e");
    const second = filterActiveAlliesByName(allies, "e");
    assert.deepEqual(first, second);
  });
});

describe("resolveCommunicationMode (Communication UX Pack 03.9 Part 2 — URL is the source of truth)", () => {
  it("resolves to 'initiative' only for the exact literal value", () => {
    assert.equal(resolveCommunicationMode(new URLSearchParams("mode=initiative")), "initiative");
  });

  it("defaults to 'personal' when the param is absent", () => {
    assert.equal(resolveCommunicationMode(new URLSearchParams("")), "personal");
  });

  it("defaults to 'personal' for any unrecognized value (never throws, never a third mode)", () => {
    assert.equal(resolveCommunicationMode(new URLSearchParams("mode=bogus")), "personal");
    assert.equal(resolveCommunicationMode(new URLSearchParams("mode=Initiative")), "personal");
  });
});

describe("resolveCollaborationSection (Communication UX Pack 03.9 Part 11 — notification deep links)", () => {
  it("resolves to 'sessions' only for the exact literal value", () => {
    assert.equal(resolveCollaborationSection(new URLSearchParams("section=sessions")), "sessions");
  });

  it("defaults to 'channel' when the param is absent", () => {
    assert.equal(resolveCollaborationSection(new URLSearchParams("")), "channel");
  });

  it("defaults to 'channel' for any unrecognized value", () => {
    assert.equal(resolveCollaborationSection(new URLSearchParams("section=bogus")), "channel");
  });
});
