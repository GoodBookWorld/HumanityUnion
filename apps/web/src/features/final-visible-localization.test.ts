/**
 * Final visible localization — Biography/Skills PLP reconnect, Assistant widget,
 * Improvement Proposal warm scope.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");
const apiSrc = path.resolve(here, "../../../api/src");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("Final visible localization fix", () => {
  it("Assistant workspace widget does not override WEB_UI copy with English description", () => {
    const home = readWeb("features/workspace-home/components/WorkspaceHomeAssistant.tsx");
    const unavailable = readWeb(
      "features/initiatives/components/InitiativesUnavailableWorkspace.tsx",
    );
    const widget = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantWidget.tsx",
    );
    assert.match(home, /HumanityUnionAssistantWidget\s+surfaceId="workspace"/);
    assert.doesNotMatch(home, /description=\{/);
    assert.doesNotMatch(home, /I can help you understand your Workspace/);
    assert.match(unavailable, /surfaceId="initiatives"/);
    assert.doesNotMatch(unavailable, /description=/);
    assert.match(widget, /assistantWidgetCopyKey/);
    assert.match(widget, /useLocalizedBrand/);
  });

  it("Biography/Skills public presentation reconnects participant_public PLP", () => {
    const service = readApi("modules/member-profile/member-profile.service.ts");
    const apply = readApi(
      "modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.ts",
    );
    const adapter = readApi(
      "modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
    );
    const enqueue = readApi(
      "modules/language/published-localized-presentation/universal/adapters/enqueue-participant-public-plp.ts",
    );
    const preview = readWeb("features/member-profile/components/OwnerProfilePreview.tsx");

    assert.match(adapter, /skills:\s*"MACHINE_CONTENT"/);
    assert.match(adapter, /findMemberProfileByProfileId/);
    assert.match(apply, /resolvePublishedPresentation/);
    assert.match(apply, /PUBLISHED_LOCALIZED/);
    assert.match(service, /applyParticipantPublicPlpToProjection/);
    assert.match(service, /enqueueParticipantPublicPlpBuilds/);
    assert.match(enqueue, /resolvePlpAutoBuildLocales/);
    assert.match(preview, /getMyPublicMemberProfilePreview\(locale\)/);
    assert.doesNotMatch(service, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
  });

  it("Improvement Proposal staging warm remains kind-bounded and CURRENT-skipping", () => {
    const scope = readApi(
      "modules/language/content-translation-staging-warm-operator-scope.ts",
    );
    const warm = readApi("scripts/warm-staging-content-translations.ts");
    assert.match(scope, /improvement_proposal/);
    assert.match(scope, /--kinds=/);
    assert.match(warm, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
    assert.match(warm, /humanity_union_staging/);
    assert.doesNotMatch(warm, /locale\s*===\s*["']uk["']/);
  });
});
