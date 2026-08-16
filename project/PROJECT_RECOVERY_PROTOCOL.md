# PROJECT_RECOVERY_PROTOCOL

Humanity Union

Engineering Recovery Protocol

Version 1.1

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

# Entry Point (AI / human)

**Start here first:**

`architecture/recovery/chat-agent/README.md`

Paste-ready new-chat prompt:

`architecture/recovery/chat-agent/NEW_CHAT_RECOVERY_PROMPT.md`

That README defines the full reading sequence, authority hierarchy, architecture protections, Bash execution matrix, and working relationship. Do not duplicate it here.

Canonical live handoff (current objective):

`project/NEXT_SESSION.md`

---

# Recovery Procedure

## Step 0

Open:

`architecture/recovery/chat-agent/README.md`

Follow its recovery sequence.

Estimated time:

1–2 minutes to orient

---

## Step 1

Open:

`project/PROJECT_DASHBOARD.md`

Determine:

- Current focus / Pack
- Branch
- Project health

Estimated time:

30 seconds

---

## Step 2

Read:

`project/PROJECT_STATE.md`

Determine:

- Current platform status
- Operator-verified staging facts vs repository-verifiable facts
- Operator-observed blockers

Estimated time:

2–3 minutes

---

## Step 3

Review:

`project/NEXT_SESSION.md`

Determine:

- Immediate objective
- Next Pack / implementation task

Estimated time:

1 minute

---

## Step 4

Review current Pack or Epic documentation named by `NEXT_SESSION.md`.

For architecture constraints, follow the chat-agent README links to ADRs, `RECOVERY_STATUS`, Development Baseline, and lifecycle docs.

Estimated time:

5 minutes

---

## Step 5

Verify implementation status.

Run (label location: **CURSOR AGENT** or **LOCAL MAC TERMINAL** as appropriate):

```
pnpm typecheck
```

Review:

```
git status
```

Confirm repository integrity.

---

## Step 6

Continue only after owner approval when starting a new AI session.

Never implement outside the approved Pack or Guide.

Never let a stale live-state document override a normative ADR.

Never treat superseded ADR-002 (Activity-root) as current architecture.

---

# Engineering Rules

Always follow:

- Blueprint
- Architectural Principles
- Engineering Methodology
- Domain First
- Stable Domains
- One Guide / one Pack = one Engineering Cycle
- Chat Agent Continuity maintenance rule (chat-agent README + `.cursor/rules.md`)

---

# Recovery Checklist

Confirm:

✓ Chat-agent README reviewed

✓ Dashboard reviewed

✓ Project State reviewed

✓ Next Session reviewed

✓ Current Pack/Guide identified

✓ Repository verified

✓ Documentation authority hierarchy understood

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

A stale live-state document must not override a normative ADR.

A superseded ADR must not override its replacement.

---

# AI Assistant Recovery

When starting a new AI session:

1. Open `architecture/recovery/chat-agent/README.md` (or paste `NEW_CHAT_RECOVERY_PROMPT.md`)
2. Follow the README recovery sequence
3. Read `project/NEXT_SESSION.md` for the current objective
4. Return a recovery report; wait for owner approval before issuing Cursor work

The new AI session should be able to continue development without reconstructing project history from chat alone.

---

# Final Principle

The Humanity Union project must remain understandable and recoverable independently of any single developer, AI assistant, or conversation.

Engineering continuity is part of the platform architecture.
