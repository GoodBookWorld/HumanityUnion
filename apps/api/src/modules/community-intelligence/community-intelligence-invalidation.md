# Community Intelligence invalidation boundary (Pack 02)

## Persistence decision

Pack 02 retains **ephemeral calculation + TTL cache** (Option A).

Durable `CommunityInitiativeRelationship` edges are **not** introduced yet because:

- candidate pool is capped (80) and results at 5;
- recalculation cost is bounded deterministic token overlap;
- publish/update frequency does not justify graph storage today;
- invalidation for a pair-wise edge graph would add complexity without proven query-volume pressure.

Future durable edges remain optional if Initiative corpus growth or semantic re-rank caching warrants them.

## Invalidate / recompute when

- Initiative publish / republish / projected content update (title, description, category, activity area, tags, geography)
- Published Collaborative Analysis changes public themes used as signals
- Explicit cache clear (tests / algorithm version bump)

Cache entries store `algorithmVersion`; mismatched versions are treated as misses.

## Do NOT invalidate because

- private Direct Message changes
- Collaboration Channel / private chat changes
- private Shared Documents
- hidden profile/skills/location changes
- unrelated Notification read state
