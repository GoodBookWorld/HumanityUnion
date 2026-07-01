# STATE_MACHINE

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Version 1.0

---

# Purpose

Define the lifecycle of the CollaborativeAnalysis aggregate.

This state machine governs the analytical process.

It does not govern the Initiative lifecycle.

---

# Principle

Every Aggregate owns its own lifecycle.

CollaborativeAnalysis and Initiative evolve independently.

---

# Lifecycle

Not Started

↓

Active

↓

Requirements Met

↓

Completed

↓

Archived

---

# State Definitions

## Not Started

The Initiative exists.

Collaborative Analysis has not yet begun.

Characteristics:

- no Contributions;
- no Signals;
- no Analysis Summary;
- Readiness is zero.

Allowed transitions:

→ Active

---

## Active

Collaborative Analysis is open.

Participants may:

- create Contributions;
- submit Signals;
- improve Initiative quality;
- propose Summaries.

Readiness is continuously evaluated.

Allowed transitions:

→ Requirements Met

---

## Requirements Met

Progress Policy has been satisfied.

All required conditions are fulfilled.

Examples:

- required Contributions;
- required Signals;
- expert review;
- regional review;
- participation threshold.

Collaborative Analysis is ready for formal completion.

Allowed transitions:

→ Completed

↓

Active

If new analytical work becomes necessary.

---

## Completed

Collaborative Analysis has finished.

The Initiative is prepared for Poll.

Analysis remains readable.

Historical data remains immutable.

No new Contributions are accepted unless the analysis is reopened.

Allowed transitions:

→ Archived

---

## Archived

Historical preservation state.

Collaborative Analysis becomes read-only.

All analytical history remains available.

No further transitions.

---

# Transition Rules

Not Started

↓

Active

A participant begins Collaborative Analysis.

---

Active

↓

Requirements Met

Progress Policy becomes satisfied.

---

Requirements Met

↓

Completed

Initiative Steward confirms readiness.

(Automation may be introduced in future versions according to approved Progress Policy.)

---

Requirements Met

↓

Active

Additional analytical work becomes necessary.

Examples:

- new evidence;
- significant correction;
- policy changes;
- Initiative revision.

---

Completed

↓

Archived

The Initiative advances beyond Collaborative Analysis.

---

# Domain Invariants

Collaborative Analysis guarantees:

- historical integrity;
- immutable Contributions;
- additive analysis;
- transparent Readiness;
- explicit Progress Policy.

---

# Relationship to Initiative

CollaborativeAnalysis lifecycle

≠

Initiative lifecycle

Collaborative Analysis prepares the Initiative.

The Initiative owns the overall participation journey.

---

# Relationship to Poll

Completed Collaborative Analysis

↓

Ready for Poll

↓

Poll

Poll belongs to a separate Epic.

---

# Bootstrap Scope

Version 1 includes:

- Not Started
- Active
- Requirements Met
- Completed
- Archived

Deferred:

- Paused
- Reopened
- Superseded
- Merged

---

# Future Extensions

Future versions may support:

- temporary suspension;
- merge of analyses;
- split analyses;
- multi-stage reviews;
- expert review phases.

These extensions must preserve the lifecycle defined here.

---

# Engineering Principles

This lifecycle follows:

- Independent Lifecycles
- Progressive Bootstrap
- Historical Integrity
- Human Leadership
- Collective Intelligence Foundation

---

# Final Principle

Collaborative Analysis evolves through structured collaboration.

Its lifecycle measures analytical maturity, not political approval.
