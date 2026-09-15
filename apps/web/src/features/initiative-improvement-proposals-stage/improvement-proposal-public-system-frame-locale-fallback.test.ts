/**
 * Public Improvement Proposals — WEB_UI system-frame fallback when CT incomplete.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  composeImprovementProposalHuSystemFields,
  lifecycleStageToken,
  type ControlledVocabularyLabelLookup,
  type ImprovementProposalHuSystemGeneration,
} from "@hu/types";

import { buildImprovementProposalPublicPresentationFields } from "./build-improvement-proposal-public-presentation-fields.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

const ukMessages = JSON.parse(
  readFileSync(path.resolve(webSrc, "features/i18n/messages/uk.json"), "utf8"),
) as {
  initiativeExperience: {
    author: { proposal: { generated: Record<string, string> } };
    stages: Record<string, string>;
  };
};

function ukT(key: string, values?: Record<string, string | number | Date>): string {
  if (key.startsWith("author.proposal.generated.")) {
    const leaf = key.slice("author.proposal.generated.".length);
    let template = ukMessages.initiativeExperience.author.proposal.generated[leaf] ?? key;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        template = template.replace(new RegExp(`\\{${k}[^}]*\\}`, "g"), String(v));
      }
    }
    return template;
  }
  if (key.startsWith("stages.")) {
    const stageId = key.slice("stages.".length);
    return ukMessages.initiativeExperience.stages[stageId] ?? key;
  }
  return key;
}

const labelLookup: ControlledVocabularyLabelLookup = {
  discussion: {
    webUiControlledLabel: ukMessages.initiativeExperience.stages.discussion,
    stageId: "discussion",
    registryCanonicalEnglishLabel: "Discussion",
  },
};

const generation: ImprovementProposalHuSystemGeneration = {
  descriptionKind: "raised_times",
  raisedCount: 2,
  reasonKind: "raised_by",
  participantCount: 2,
  category: "Funding",
  discussionStageToken: lifecycleStageToken("discussion"),
  helpfulCount: 3,
  memberCount: 2,
  supportingSourcesKind: "helpful_reactions",
};

describe("Improvement Proposals public system-frame locale fallback", () => {
  it("non-English presentation + missing CT path uses WEB_UI frames, not English glue", () => {
    const participantExcerpt = '- "We need clearer timelines"\n- "Please publish dates"';
    const fields = buildImprovementProposalPublicPresentationFields({
      proposal: {
        title: "{lifecycleStage:proposal}: We need clearer timelines",
        summary: "We need clearer timelines",
        description: participantExcerpt,
        reason: "",
        expectedImprovement: "",
        supportingSources: "",
        relatedDiscussionReferences: "/initiatives/public/i1#discussion",
        huSystemGeneration: generation,
      },
      t: ukT,
      labelLookup,
    });

    assert.doesNotMatch(fields.description, /This idea was raised/i);
    assert.doesNotMatch(fields.reason, /Raised by \d+ participant/i);
    assert.doesNotMatch(fields.supportingSources, /Helpful reaction\(s\) across/i);
    assert.match(fields.description, /Цю ідею піднімали|піднімали/i);
    assert.ok(fields.description.includes(participantExcerpt));
    assert.match(fields.reason, /Funding/);
    assert.equal(fields.summary, "We need clearer timelines");
  });

  it("author-edited free-text reason is preserved (not overwritten by WEB_UI)", () => {
    const fields = buildImprovementProposalPublicPresentationFields({
      proposal: {
        title: "T",
        summary: "S",
        description: "participant only",
        reason: "Author wrote this reason in English",
        expectedImprovement: "E",
        supportingSources: "",
        relatedDiscussionReferences: "",
        huSystemGeneration: generation,
      },
      t: ukT,
      labelLookup,
    });
    assert.equal(fields.reason, "Author wrote this reason in English");
    assert.equal(fields.description.split("\n").at(-1), "participant only");
  });

  it("composeImprovementProposalHuSystemFields remains the shared WEB_UI composer", () => {
    const composed = composeImprovementProposalHuSystemFields({
      generation,
      descriptionExcerpts: "excerpt-a",
      t: ukT,
      labelLookup,
    });
    assert.doesNotMatch(composed.reason, /Raised by/);
    assert.match(composed.description, /excerpt-a/);
  });

  it("PublicResult wires presentation helper + PublicTranslatedFields (not English CT glue fallback)", () => {
    const publicResult = read(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.match(publicResult, /buildImprovementProposalPublicPresentationFields/);
    assert.match(publicResult, /PublicTranslatedFields/);
    assert.doesNotMatch(publicResult, /buildImprovementProposalCtFields/);
    assert.match(publicResult, /huSystemGeneration|labelLookup/);
  });

  it("PublicTranslatedFields ordinary reading uses caller fallbackFields without CT apply", () => {
    const fields = read("features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /const fields = fallbackFields/);
    assert.doesNotMatch(fields, /resolveTranslatedContent/);
    assert.doesNotMatch(fields, /incompleteDisplay/);
  });

  it("English CT source helper remains for warm/discovery (unchanged English frames)", () => {
    const ct = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/build-improvement-proposal-ct-fields.ts"),
      "utf8",
    );
    assert.match(ct, /composeEnglishSystemFrames/);
    assert.match(ct, /This idea was raised/);
  });
});
