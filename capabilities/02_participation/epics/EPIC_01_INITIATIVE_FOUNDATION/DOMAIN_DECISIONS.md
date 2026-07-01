# DOMAIN_DECISIONS

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

Humanity Union Platform

Domain Decisions

Version 1.0

---

# Purpose

This document records architectural decisions that define the stable behavior of the Initiative domain.

These decisions guide implementation and future evolution.

They are intended to remain stable over time.

---

# Decision 01

## Initiative is the Aggregate Root

Proposal, Discussion, Poll, Petition, and Implementation are lifecycle phases of a single Initiative.

No separate Aggregate Root shall be introduced for these phases.

---

# Decision 02

## Initiative Identity is Permanent

Every Initiative receives one permanent identity.

Lifecycle progression never changes Initiative identity.

---

# Decision 03

## Lifecycle Represents Evolution

Lifecycle stages represent the evolution of one Initiative.

Transitions change state only.

They never replace the Initiative.

---

# Decision 04

## Timeline is Append-Only

Timeline represents permanent historical evidence.

Historical events are never deleted.

Historical events are never rewritten.

New events extend history.

---

# Decision 05

## Revision Preserves History

Every Revision creates a new historical version.

Previous revisions remain immutable.

Transparency requires complete revision history.

---

# Decision 06

## Contribution Represents Constructive Participation

Contribution records meaningful participation.

Contribution is not a score.

Contribution becomes part of Initiative history.

---

# Decision 07

## Stewardship Differs from Ownership

Ownership identifies original authorship.

Stewardship governs Initiative evolution.

Ownership remains permanent.

Stewardship may evolve.

---

# Decision 08

## Archive Preserves Initiatives

Archive never removes Initiative history.

Archived Initiatives remain part of Humanity Union history.

---

# Decision 09

## Revival Continues Initiative History

Revival reactivates an existing Initiative.

Revival never creates a new Initiative identity.

---

# Decision 10

## Merge Preserves Lineage

Merged Initiatives preserve historical lineage.

Historical relationships remain traceable.

No Initiative history is destroyed.

---

# Decision 11

## Historical Integrity

Historical records are extended.

Historical records are never rewritten.

This principle applies to:

- Timeline
- Revisions
- Contributions
- Lifecycle Events

---

# Decision 12

## Progressive Bootstrap

Bootstrap implementation introduces only the minimum required functionality.

Future capabilities may expand Initiative behavior without redesigning the domain.

---

# Decision 13

## Domain Boundaries

Initiative owns:

- lifecycle
- stewardship
- revisions
- timeline
- contributions

Initiative references:

- Members
- Organizations
- Communities

Initiative never owns those domains.

---

# Decision 14

## Public Participation

Public participation is governed through explicit visibility rules.

Visibility never changes Initiative identity.

Future Visibility & Consent capabilities may extend participation visibility.

---

# Decision 15

## Initiative Continuity

Every Initiative remains one continuous social process.

The Initiative may evolve for years while preserving one identity, one history, and one timeline.

---

# Engineering Principles

These decisions implement:

- Domain First
- Domain Ownership
- Domain Gravity
- Ubiquitous Language
- Constructive Participation
- Initiative Continuity
- Continuous Contribution
- Initiative Stewardship
- Living Initiatives
- Historical Integrity
- Progressive Bootstrap

---

# Final Principle

A strong society does not preserve only successful ideas.

It preserves the history of every constructive effort to improve the future.
