/**
 * HU-LC-05B.1 — the legacy Petition page shows the current session's signature
 * state (server `viewerHasSigned`), never the bootstrap participant's.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Petition, PetitionState } from "@hu/types";

import type { ClientAuthStatus } from "../auth/use-client-auth-status";
import { SignatureSection } from "./components/SignatureSection";
import {
  deriveNextMeaningfulAction,
  isSignatureWithdrawalAvailable,
  resolveSignatureSectionState,
  type ViewerSignatureStatus,
} from "./petition-utils";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));

function petition(status: PetitionState, withdrawalPermitted = false): Petition {
  return {
    petitionId: "petition-lc05b1",
    collectiveDecisionId: "decision-lc05b1",
    status,
    createdAt: "2026-11-08T00:00:00.000Z",
    updatedAt: "2026-11-08T00:00:00.000Z",
    subject: {
      decisionId: "decision-lc05b1",
      initiativeId: "initiative-lc05b1",
      title: "Fixture",
      summary: "Fixture summary.",
    },
    policy: {
      withdrawalPolicy: { withdrawalPermitted, withdrawalPolicyDescription: null },
    },
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
    outcome: null,
  } as unknown as Petition;
}

function render(input: {
  status: PetitionState;
  authStatus: ClientAuthStatus;
  viewerSignature: ViewerSignatureStatus;
  withdrawalPermitted?: boolean;
}): string {
  return renderToStaticMarkup(
    createElement(SignatureSection, {
      petition: petition(input.status, input.withdrawalPermitted),
      authStatus: input.authStatus,
      viewerSignature: input.viewerSignature,
      registrationGatewayMessage: "Sign in or register to sign this Petition.",
      onPetitionUpdated: () => undefined,
      onViewerSignatureChange: () => undefined,
      onSignatureStatusStale: () => undefined,
    }),
  );
}

describe("HU-LC-05B.1 — resolveSignatureSectionState", () => {
  const resolve = (
    authStatus: ClientAuthStatus,
    viewerSignature: ViewerSignatureStatus,
    petitionStatus: PetitionState = "Open",
    justSigned = false,
  ) => resolveSignatureSectionState({ authStatus, viewerSignature, justSigned, petitionStatus });

  it("signed-in Participant who has not signed", () => {
    assert.equal(resolve("authenticated", "unsigned"), "unsigned");
  });

  it("successful signature in this session", () => {
    assert.equal(resolve("authenticated", "signed", "Open", true), "just_signed");
  });

  it("already signed (including after reload, before any action)", () => {
    assert.equal(resolve("authenticated", "signed"), "already_signed");
    assert.equal(resolve("authenticated", "signed", "Closed"), "already_signed");
  });

  it("anonymous visitors are never shown as signers", () => {
    for (const viewerSignature of ["unknown", "signed", "unsigned", "unavailable"] as const) {
      assert.equal(resolve("unauthenticated", viewerSignature), "sign_in");
      assert.equal(resolve("unauthenticated", viewerSignature, "Closed"), "not_open");
    }
  });

  it("waits for the session and the server before deciding", () => {
    assert.equal(resolve("pending", "signed"), "checking");
    assert.equal(resolve("authenticated", "unknown"), "checking");
  });

  it("unconfirmed status still offers signing (the server rejects duplicates)", () => {
    assert.equal(resolve("authenticated", "unavailable"), "status_unavailable");
  });

  it("not-open Petitions without a viewer signature", () => {
    assert.equal(resolve("authenticated", "unsigned", "Published"), "not_open");
    assert.equal(resolve("authenticated", "unsigned", "Closed"), "not_open");
  });
});

describe("HU-LC-05B.1 — SignatureSection rendering", () => {
  it("signed-in unsigned Participant sees the Sign button", () => {
    const html = render({
      status: "Open",
      authStatus: "authenticated",
      viewerSignature: "unsigned",
    });
    assert.match(html, /Sign this Petition/);
    assert.doesNotMatch(html, /Already Signed/);
  });

  it("already-signed Participant sees Already Signed and no Sign button", () => {
    const html = render({ status: "Open", authStatus: "authenticated", viewerSignature: "signed" });
    assert.match(html, /Already Signed/);
    assert.doesNotMatch(html, /Sign this Petition/);
    assert.match(html, /cannot be changed here/);
  });

  it("withdrawal is offered only where the policy permits it", () => {
    const permitted = render({
      status: "Open",
      authStatus: "authenticated",
      viewerSignature: "signed",
      withdrawalPermitted: true,
    });
    assert.match(permitted, /Withdraw signature/);
    const closed = render({
      status: "Closed",
      authStatus: "authenticated",
      viewerSignature: "signed",
      withdrawalPermitted: true,
    });
    assert.doesNotMatch(closed, /Withdraw signature/);
  });

  it("anonymous visitor sees sign-in guidance, not a signer state or Sign button", () => {
    const html = render({
      status: "Open",
      authStatus: "unauthenticated",
      viewerSignature: "signed",
    });
    assert.match(html, /Sign in or register to sign this Petition\./);
    assert.doesNotMatch(html, /Already Signed|Signature Recorded|Sign this Petition/);
  });

  it("pending session shows a neutral checking state", () => {
    const html = render({ status: "Open", authStatus: "pending", viewerSignature: "unknown" });
    assert.match(html, /Checking your signature status/);
  });
});

describe("HU-LC-05B.1 — guidance and withdrawal rules", () => {
  it("next action follows the viewer's own signature", () => {
    assert.equal(deriveNextMeaningfulAction(petition("Open"), false).title, "Sign this Petition");
    assert.equal(
      deriveNextMeaningfulAction(petition("Open"), true).title,
      "Continue civic journey",
    );
  });

  it("withdrawal availability requires an Open Petition and a permitting policy", () => {
    assert.equal(isSignatureWithdrawalAvailable(petition("Open", true)), true);
    assert.equal(isSignatureWithdrawalAvailable(petition("Open", false)), false);
    assert.equal(isSignatureWithdrawalAvailable(petition("Closed", true)), false);
  });
});

describe("HU-LC-05B.1 — no bootstrap or client-supplied signer identity", () => {
  const read = (relative: string) => readFileSync(path.join(HERE, relative), "utf8");

  it("the legacy Petition page components never use the bootstrap participant", () => {
    for (const file of [
      "components/SignatureSection.tsx",
      "components/PetitionWorkspace.tsx",
      "components/NextMeaningfulAction.tsx",
      "use-viewer-petition-signature.ts",
    ]) {
      const source = read(file);
      assert.doesNotMatch(source, /BOOTSTRAP_PARTICIPANT_ID|member-bootstrap-001/, file);
    }
  });

  it("signing sends no participantId; state comes from the server projection", () => {
    assert.doesNotMatch(read("components/SignatureSection.tsx"), /participantId/);
    assert.match(read("use-viewer-petition-signature.ts"), /viewerHasSigned/);
  });
});
