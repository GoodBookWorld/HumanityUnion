# Humanity Union Lifecycle Safety Architecture

## Version 1.0 — Safety Architecture Pack 01

### Provider-Independent Safety Layer for the Initiative Lifecycle

---

# Document Purpose

This document defines the canonical Safety Layer that filters harmful content
before it becomes part of the Initiative Lifecycle.

It is an architectural specification. It does **not** connect any external AI
provider. Concrete adapters (for example Gemini Safety) are future
implementations of the `SafetyProvider` contract.

---

# 1. Pipeline

```
User Input
    ↓
Safety Validation  (central Lifecycle Safety Service)
    ↓
Accepted  |  Needs Review  |  Rejected
    ↓
Lifecycle Storage   (only when mayEnterLifecycleStorage)
    ↓
Stage Intelligence  (only when mayEnterStageIntelligence)
    ↓
Future AI
```

No unsafe (Rejected) content may enter the Intelligence Layer.

---

# 2. Moderation Categories

- Violence
- Terrorism
- Illegal activity
- Child exploitation
- Harassment
- Hate
- Self-harm encouragement
- Malware
- Spam
- Prompt injection
- AI manipulation attempts
- Private credential leakage
- Other harmful

Canonical ids live in `@hu/types` (`LifecycleSafetyCategoryId`).

---

# 3. Outcomes

| Outcome | Storage | Stage Intelligence | Notify other users |
|---------|---------|--------------------|--------------------|
| Accepted | Yes | Yes | Yes (subject to existing Lifecycle rules) |
| Needs Review | Hold / quarantine only | No | No automatic fan-out |
| Rejected | No | No | **Never** |

---

# 4. SafetyProvider

Provider-independent interface:

- Input: text + surface + initiative context
- Output: `safe` | `uncertain` | `unsafe` + category hits

The central Safety Service maps provider signals to outcomes.
UI never implements censorship logic.
No Gemini/OpenAI/Claude coupling in this pack.

Future adapters:

- Gemini Safety
- Other providers behind the same contract

---

# 5. Protected Surfaces

Every Lifecycle stage plus Discussion and AI prompt contexts:

Discussion, Initiative, Collaborative Analysis, Improvement Proposals,
Revision, Petition, Decision Session, Collective Decision, Implementation
Commitments, Implementation Tracking, Official Responses, Public Impact,
Civic Archive, AI prompt, AI system context.

---

# 6. AI Prompt Protection

Detected (deterministically and/or via future providers):

- Prompt injection
- System prompt extraction
- Instruction override
- “Ignore previous instructions”
- Role manipulation

Rejected prompt material never reaches Stage Intelligence or future AI.

---

# 7. Notifications

Rejected content must never notify other Participants.
Callers must respect `LifecycleSafetyDecision.mayNotifyOtherParticipants`.

---

# 8. Guiding Principle

Safety assists the platform. It does not replace human judgment for
`needs_review`. It never becomes a UI-local censorship layer.
