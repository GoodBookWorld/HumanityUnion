# IMPLEMENTATION_GUIDE_03_STORE

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Ready

---

# Purpose

This guide defines how the Petition Aggregate is stored and retrieved.

The Store is responsible for persistence only.

It does not implement business rules.

Business behavior belongs to the Aggregate.

---

# Responsibilities

The Petition Store is responsible for:

- persisting Petition Aggregates;
- loading Petition Aggregates;
- storing Signatures;
- supporting Aggregate lifecycle transitions;
- calculating derived read models;
- preserving historical integrity.

The Store never owns business logic.

---

# Aggregate Storage

One Petition Aggregate contains:

- Aggregate metadata;
- PetitionSubject reference;
- PetitionPolicy;
- lifecycle state;
- ShareLink;
- Signatures;
- derived SupportMetrics;
- PetitionOutcome.

External Aggregates are referenced only by identifiers.

---

# Bootstrap Data

Bootstrap Petition data should include:

- PetitionId;
- CollectiveDecisionId;
- InitiativeId;
- PetitionSubject;
- PetitionPolicy;
- lifecycle state;
- ShareLink;
- empty Signature collection;
- initial SupportMetrics;
- initial PetitionOutcome.

Bootstrap data represents a valid Aggregate.

---

# CRUD Responsibilities

Supported operations:

```text
Create Petition

Load Petition

Update Petition

Archive Petition
```

Deletion is not supported.

Historical records must be preserved.

---

# Signature Storage

Each Signature stores:

- SignatureId;
- PetitionId;
- ParticipantId;
- SignedAt;
- Visibility;
- Status.

A Signature belongs to exactly one Petition.

Duplicate signatures are prohibited.

---

# Immutable Records

Once stored:

- Signature content must never be modified;
- SignedAt must never change;
- ParticipantId must never change.

If policy changes occur later, existing Signatures remain unchanged.

---

# Lifecycle Persistence

Persist every valid state transition.

Examples:

```text
Draft

↓

Ready

↓

Published

↓

Open

↓

Closed

↓

Archived
```

Invalid transitions must never be persisted.

---

# Derived SupportMetrics

SupportMetrics are calculated from Signature records.

Examples:

- total signatures;
- participant signatures;
- registration conversions;
- activity trends;
- support thresholds.

SupportMetrics are never stored as manually editable values.

---

# PetitionOutcome

PetitionOutcome is derived.

Examples:

- Active
- ThresholdReached
- Closed
- Archived

The Store derives Outcome from Aggregate state and SupportMetrics.

Outcome is never independently edited.

---

# Read Models

Read models may expose:

- Petition summary;
- PetitionSubject;
- ShareLink;
- lifecycle state;
- SupportMetrics;
- PetitionOutcome.

Read models should be optimized for display.

Read models never become the source of truth.

---

# structuredClone

Every Aggregate returned from the Store should be protected.

Use:

```text
structuredClone()
```

before returning mutable Aggregate objects.

No consumer should mutate stored Aggregate instances directly.

---

# Error Handling

Expected persistence errors include:

- Aggregate not found;
- duplicate Signature;
- invalid lifecycle transition;
- persistence failure;
- corrupted bootstrap data.

Errors must be deterministic.

---

# Repository Expectations

Repositories should expose operations such as:

```text
create()

findById()

save()

archive()

exists()

list()
```

Repository methods should operate on complete Aggregates.

Repositories must not expose partial mutation APIs.

---

# Performance Expectations

The Store should optimize:

- Petition lookup;
- Signature lookup;
- SupportMetrics derivation;
- public Petition read models.

Optimization must never compromise correctness.

---

# Verification Checklist

Before implementation verify:

- Aggregate boundaries preserved;
- Signature immutability preserved;
- lifecycle persistence matches State Machine;
- SupportMetrics derived correctly;
- PetitionOutcome derived correctly;
- structuredClone protection applied;
- no business logic inside Store;
- repositories operate on Aggregates.

---

# Final Principle

The Petition Store preserves the integrity, history and persistence of the Aggregate while leaving all business behavior to the Domain layer.
