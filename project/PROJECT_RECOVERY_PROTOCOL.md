# PROJECT_RECOVERY_PROTOCOL

Humanity Union

Engineering Recovery Protocol

Version 1.0

---

# Purpose

This document defines the standard recovery procedure after any interruption of development.

The interruption may be caused by:

- Chat restart
- New ChatGPT session
- Computer replacement
- Long development pause
- Team member replacement
- AI assistant replacement

The objective is to restore productive development within minutes.

---

# Recovery Principle

Humanity Union development must never depend on a single conversation, developer, or AI session.

The project itself must contain all critical engineering knowledge.

---

# Recovery Procedure

## Step 1

Open:

PROJECT_DASHBOARD.md

Determine:

- Current Capability
- Current Epic
- Current Guide

Estimated time:

30 seconds

---

## Step 2

Read:

PROJECT_STATE.md

Determine:

- Current platform status
- Current architecture
- Current implementation state

Estimated time:

2–3 minutes

---

## Step 3

Review:

NEXT_SESSION.md

Determine:

- Immediate objective
- Next implementation task

Estimated time:

1 minute

---

## Step 4

Review current Epic documentation.

Read:

- Epic Specification
- Domain Design
- Domain Model
- Domain Decisions (if available)

Estimated time:

5 minutes

---

## Step 5

Verify implementation status.

Run:

pnpm typecheck

Review:

git status

Confirm repository integrity.

---

## Step 6

Continue implementation.

Never skip unfinished Guides.

Never implement functionality outside the approved Guide.

---

# Engineering Rules

Always follow:

- Blueprint
- Architectural Principles
- Engineering Methodology
- Domain First
- Stable Domains
- One Guide = One Engineering Cycle

---

# Recovery Checklist

Confirm:

✓ Dashboard reviewed

✓ Project State reviewed

✓ Next Session reviewed

✓ Current Guide identified

✓ Repository verified

✓ TypeScript verified

✓ Documentation synchronized

---

# Recovery Time Target

Expected recovery time:

Less than 10 minutes.

---

# Disaster Recovery

If documentation and repository disagree:

Documentation must be reviewed.

Repository state becomes authoritative for implementation.

Documentation is then synchronized.

---

# AI Assistant Recovery

When starting a new AI session:

Provide:

1. PROJECT_DASHBOARD.md

2. PROJECT_STATE.md

3. Current Epic

4. Current Guide

5. Current Cursor report

The new AI session should be able to continue development without reconstructing project history.

---

# Final Principle

The Humanity Union project must remain understandable and recoverable independently of any single developer, AI assistant, or conversation.

Engineering continuity is part of the platform architecture.
