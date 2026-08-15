# Community Intelligence v1.0

## Purpose

Help Participants discover related civic work, possible overlaps, complementary Initiatives, and collaboration opportunities — without becoming an engagement engine.

Goals:

- Reduce duplication
- Improve collaboration
- Connect related civic work
- Help Participants discover relevant knowledge and people

## Boundary

`CommunityIntelligenceService` (API module `apps/api/src/modules/community-intelligence`)

Provider-independent seam:

```
CommunitySimilarityProvider
  └── DeterministicCommunitySimilarityProvider (Pack 01)
  └── (future) semantic providers — optional re-rank only
```

Never couple domain logic to Gemini.

## Relationship classifications

| Type | Meaning |
|------|---------|
| `possible_duplicate` | Strong topical overlap — advisory only |
| `related` | Shared themes / area / keywords |
| `complementary` | Shared domain with different problem-part focus |

The system never auto-merges or suppresses Initiatives.

## Signals (public only)

- Normalized title / description terms
- Activity area / category
- Tags / keywords
- Geographic scope when present on the Initiative
- Public Collaborative Analysis free-text themes (title/summary/risks/questions)

Excluded:

- Private messages
- Hidden skills / location
- Private profile fields
- Author-private analysis snapshots (`mostDiscussedTopics`)

## Surfaces

| Surface | Audience | Behavior |
|---------|----------|----------|
| Public Initiative Related Initiatives | Public | Non-personalized; deterministic SSR/client markup |
| Creation overlap check | Authenticated Author | Advisory; never blocks; Pack 03 notice actions |
| Workspace Collaboration Opportunities | Authenticated | Personalized, bounded (≤5) |
| Assistant | Authenticated | Structured CI block only when asked |

### Pack 03 — Creation overlap notice actions

- Trigger: explicit Publish boundary (not per-keystroke).
- Strong overlap only (`hasStrongOverlap`); empty/unrelated drafts show no notice.
- `View Initiative` / `Consider collaboration` open the related public Initiative in a **new tab** so the Author draft is preserved.
- `Consider collaboration` opens `?filter=collaboration#discussion`. It never auto-creates Ally relationships, never auto-sends messages, and never merges Initiatives.
- `Continue creating` dismisses the notice for the current draft fingerprint; material draft changes may re-check on the next Publish.
- CI API failure shows an optional non-blocking status; creation still proceeds.

## Performance

- Candidate retrieval bounded (`MAX_CANDIDATES = 80`)
- Prefer same activity area first
- Results capped (`MAX_RELATED = 5`)
- Short TTL cache per source Initiative (`60s`) with `algorithmVersion`
- Invalidation on Initiative publish/update and published Collaborative Analysis changes
- Pack 02 persistence decision: ephemeral calculation + TTL cache (no durable edges yet)

## Reminder integration

- Strong priority matches (≥2 preference signals) may create Reminder candidates
- Pack 02: high-confidence collaboration opportunities may create Reminder candidates
- Both use `createReminderIfEligibleWithCooldown` (active idempotency + day-scale cooldown + `generationKey`)
- Weak single-keyword matches do not notify
- Preference gate today: existing `interestMatchNotificationsEnabled` (no CI-specific taxonomy yet)

## Algorithm version

Internal `COMMUNITY_SIMILARITY_ALGORITHM_VERSION` (`ci-similarity-v1.1`). Exposed on structured API diagnostics; not a Participant-facing score explanation.

## Safety / fairness

- No human-worth rankings
- No ideology profiles
- No sensitive attribute inference
- Popularity is not truth
- Explainability required (`reasons[]`)

## Future packs

- Optional semantic re-rank behind the same seam (see `COMMUNITY_INTELLIGENCE_PACK02_SEMANTIC_EVAL.md` — deferred)
- Optional durable relationship edges if corpus/query volume warrants them
- Optional preference keys: “Initiatives matching my priorities” / “Collaboration opportunities”
- Richer public theme projections when product wants them
