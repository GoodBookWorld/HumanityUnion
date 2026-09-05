# Public Localization Developer Contract (Pack 08K)

**Normative one-pager.** Participant-facing semantic text localizes by default.

## What you must do

1. Build a **sanitized participant-facing presentation** (`PublicPresentationNode`).
2. Explicitly wrap **identity / technical / private / manual / UI / terminology** values with the typed helpers (`protectedIdentity`, `protectedTechnical`, …).
3. Pass the presentation through the **Public Localization Boundary** (`localizePublicPresentation` / `ensureLocalizedPublicPresentation`).
4. **Never** render canonical semantic domain prose directly in governed participant UI.
5. Treat translation scheduling, persistence, and locale resolution as **infrastructure** — not feature code.

## GOOD

```ts
import {
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationNode,
} from "@hu/types";
import { localizePublicPresentation } from "../language/public-localized-presentation";

const presentation: PublicPresentationNode = {
  id: protectedTechnical(artifact.id),
  authorName: protectedIdentity(artifact.authorName),
  title: artifact.title,
  summary: artifact.summary,
  sections: artifact.sections.map((s) => ({
    heading: s.heading,
    paragraphs: s.paragraphs,
  })),
};

const localized = localizePublicPresentation({
  identity: {
    sourceKind: "future_public_artifact",
    sourceRecordId: artifact.id,
    presentationSchemaVersion: "08K.1",
  },
  sourceLanguage: "en",
  targetLanguage: uiLocale,
  presentation,
  translations: currentPathMap, // from content_translations / ensure*
});

// Render ONLY from localized.presentation — never artifact.title
return <h1>{(localized.presentation as { title: string }).title}</h1>;
```

New semantic keys (e.g. `completelyNewSemanticProperty`) translate **without** allowlist / resolver / registry edits.

## FORBIDDEN

```tsx
// ❌ Raw canonical domain prose in participant UI
export function ArtifactCard({ artifact }) {
  return (
    <article>
      <h2>{artifact.title}</h2>
      <p>{artifact.description}</p>
      <p>{artifact.completelyNewSemanticProperty}</p>
    </article>
  );
}
```

Also forbidden:

- Per-component translation resolvers / field allowlist enrollment for new prose keys
- Treating a partially translated tree as `COMPLETE`
- Sending domain aggregates / private fields to the provider
- Gemini (or any provider) during SSR
- Re-registering silent English as `INTENTIONAL_LOCALIZATION_DEBT`

## Classification cheat-sheet

| Text kind | Path |
|-----------|------|
| Semantic public prose | `PublicLocalizedPresentation` |
| UI chrome | next-intl / `uiDictionaryValue` |
| Names, IDs, URLs, secrets | explicit `protected*` helpers |

See also: `LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md` § Pack 08K.
