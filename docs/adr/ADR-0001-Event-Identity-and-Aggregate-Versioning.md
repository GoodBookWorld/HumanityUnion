# ADR-0001: Event Identity and Aggregate Versioning

## Status

Accepted — Sprint 3B (2026-07-22); amended Sprint 4B (2026-07-22) for Proposal event identity

## Context

Humanity Union uses a canonical event catalogue, transactional outbox, and projection consumers. As new bounded contexts (Activity, Discussion, …) land, event identifiers and aggregate versioning must stay consistent so:

- idempotent consumers can deduplicate safely
- future lifecycle events do not collide with creation events
- projections never invent authoritative aggregate version

This ADR freezes identity rules before additional domain events appear beyond Sprint 3A–3B.

## Decision

### 1. Aggregate identity

Authoritative write-model aggregates (MVP):

| Aggregate | Identity field | Notes |
|-----------|----------------|-------|
| Member | `memberId` | Registration anchor |
| Workspace | `workspaceId` (`workspace:{memberId}`) | **Projection only** — not a write aggregate |
| Activity | `activityId` | Civic trace anchor (ADR-002) |
| Discussion | `discussionId` | Deliberation container; references `activityId` |
| Proposal | `proposalId` | Governance candidate; references `activityId` and optional `discussionId` |

Projections (Workspace, Inbox, Search, …) derive identity from upstream aggregates and events. They do not publish catalogue lifecycle commands.

### 2. AggregateVersion rules

- Initial version is **1** on first persisted aggregate state (`ACTIVITY_AGGREGATE_VERSION_INITIAL`, `DISCUSSION_AGGREGATE_VERSION_INITIAL`, `PROPOSAL_AGGREGATE_VERSION_INITIAL`, …).
- `aggregateVersion` increments **only** on authoritative aggregate state transitions (commands that mutate lifecycle or material fields governed by the aggregate).
- Projections maintain their own `projectionVersion` (or equivalent) and **never** copy or own aggregate `aggregateVersion`.
- Clients must not supply `aggregateVersion` on commands.

### 3. Event identity rules

**General rule:**

```text
<event-name-kebab-case>:<aggregateId>
```

Where `<aggregateId>` is the stable identifier of the aggregate that emitted the event (`memberId`, `activityId`, `discussionId`, …).

**Approved MVP event IDs (frozen):**

| Catalogue event | Event ID format | Aggregate |
|-----------------|-----------------|-----------|
| `MemberRegistered` | `member-registered:{memberId}` | Member |
| `ActivityCreated` | `activity-created:{activityId}` | Activity |
| `DiscussionCreated` | `discussion-created:{discussionId}` | Discussion |
| `ProposalCreated` | `proposal-created:{proposalId}` | Proposal |
| `ProposalSubmitted` | `proposal-submitted:{proposalId}` | Proposal |

**Forbidden generic patterns**

Do **not** use aggregate-only prefixes such as:

- `activity:{activityId}`
- `discussion:{discussionId}`
- `proposal:{proposalId}`

Reason: future lifecycle events must remain independently addressable, for example:

- `activity-created:{activityId}`
- `activity-revised:{activityId}`
- `activity-closed:{activityId}`
- `discussion-created:{discussionId}`
- `discussion-closed:{discussionId}`
- `proposal-created:{proposalId}`
- `proposal-submitted:{proposalId}`
- `proposal-revised:{proposalId}`

Each event name maps to its own deterministic ID namespace.

**Sprint 3A verification**

`ActivityCreated` uses `activity-created:{activityId}`. No change required.

**Catalogue note**

Engineering catalogue also documents `DiscussionOpened` as the deliberation-opened vocabulary for later `OpenDiscussion` flows. Sprint 3B introduces the first Discussion write slice with catalogue event **`DiscussionCreated`** and ID **`discussion-created:{discussionId}`** per this ADR. When additional lifecycle commands ship, they receive distinct event names and ID prefixes (`discussion-closed:{discussionId}`, …).

**Sprint 4B — Proposal semantics**

- **`ProposalCreated`** (`proposal-created:{proposalId}`): the Proposal draft aggregate was persisted (`status: draft`, `aggregateVersion: 1`). Enables Workspace and downstream projections to track draft existence without treating submission as creation.
- **`ProposalSubmitted`** (`proposal-submitted:{proposalId}`): an existing draft completed the `SubmitProposal` transition (`status: submitted`, `aggregateVersion: 2`). This is the gate for future Decision eligibility.

Do **not** use a generic `proposal:{proposalId}` event ID for either event.

### 4. CorrelationId

- Every command handler resolves a `correlationId` from (in order): explicit input, request correlation context, or actor identity.
- The same `correlationId` is written to aggregate-adjacent logs and outbox envelope metadata for the emitted event.
- Projection consumers propagate `correlationId` into structured logs; they do not rewrite correlation chains.

### 5. CausationId

- When event B is directly caused by processing event A, set `causationId` to A's `eventId`.
- Top-level member commands (registration, create activity, create discussion) use `causationId: null` unless explicitly chaining from a prior committed event.
- Consumers must not emit synthetic domain events with fabricated causation.

### 6. SchemaVersion

- Canonical envelope includes `schemaVersion` (currently `1` for MVP catalogue subset).
- Payload shape changes require a new schema version; consumers validate expected event name and required payload fields.
- Breaking payload changes must not reuse the same schema version.

## Consequences

- Event IDs are deterministic per aggregate birth event, enabling idempotent outbox consumers.
- Future Activity/Discussion lifecycle events have reserved ID namespaces.
- Workspace projections remain read-only with separate versioning semantics.
- Tests must assert envelope `eventId` patterns for new catalogue events.

## Compliance

Implementations must:

1. Use catalogue constants from `catalogue-events.ts`.
2. Build event IDs via dedicated `build*EventId()` helpers — not ad hoc string concatenation in handlers.
3. Include only approved payload fields in catalogue events.
4. Commit aggregate + outbox in one Mongo transaction.
