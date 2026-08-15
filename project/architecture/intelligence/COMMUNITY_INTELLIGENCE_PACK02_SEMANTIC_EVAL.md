# Community Intelligence Pack 02 — Semantic re-rank evaluation

## Question

Does optional semantic re-ranking (Gemini / embeddings) add enough value over
deterministic token overlap to justify Pack 02 implementation?

## Deterministic weak spots observed

| Pattern | Deterministic behavior | Semantic potential |
|---------|------------------------|--------------------|
| Synonyms (bike / cycling / bicycle) | Weak unless shared stems | Likely stronger |
| Paraphrase with little token overlap | Often misses | Likely stronger |
| Multilingual equivalents | Not covered | Needs language-aware model |
| Complementary concepts already labeled | Pack 01 complementary focus groups cover common civic pairs | Marginal |

## Decision for Pack 02

**Do not implement a live semantic provider in Pack 02.**

Reasons:

1. Candidate selection is already bounded and explainable; Gemini must never own discovery.
2. Pack 01 complementary/related classification already covers many “different wording, same domain” cases via activity area + focus groups.
3. Introducing Gemini for re-rank adds latency, cost, and a public-content egress surface before corpus size proves need.
4. Deterministic CI must remain the canonical fallback; shipping an unused semantic path increases maintenance without measured gain.

## Future design (when justified)

```
public Initiatives
→ deterministic bounded candidates (≤20)
→ optional semantic re-rank
→ top ≤5 with existing explainability reasons
```

Never: full corpus → Gemini on every request.
Never: private drafts / messages / documents / hidden profile fields.

## Provider seam

`CommunitySimilarityProvider` remains the only extension point
(`deterministic` | `semantic_future`). Pack 02 keeps resolver on deterministic.
