# Humanity Union AI Media Moderation Architecture

## Version 1.0

### The Provider-Independent Moderation Assistant for Civic Media

---

# Document Purpose

This document defines the long-term architecture for AI-assisted media moderation across the Humanity Union platform.

Humanity Union allows Participants to attach media to their civic work: Initiative cover images, AI-generated illustrations, uploaded videos, external video links, and — in the future — media attached to Public Impact, Civic Archive, and other civic records. Public civic space must remain safe. It must also remain open to legitimate expression, illustration, documentation, and civic storytelling.

This document is an architectural specification. It defines philosophy, pipeline shape, provider abstraction, policy outcomes, and future evolution. It does not prescribe implementation, models, APIs, or database schema.

---

AI Moderation is **not** the final authority.

AI Moderation is **not** a censor.

AI Moderation is **not** a legal compliance system.

AI Moderation is an **assistant** whose sole purpose is to keep obviously unacceptable content out of public civic space while preserving every legitimate form of civic expression.

AI Moderation assists the platform. It never replaces human judgment.

---

# Table of Contents

1. [Purpose](#1-purpose)
2. [Design Principles](#2-design-principles)
3. [Supported Media](#3-supported-media)
4. [Moderation Pipeline](#4-moderation-pipeline)
5. [Technical Validation](#5-technical-validation)
6. [AI Moderation](#6-ai-moderation)
7. [Moderation Policy](#7-moderation-policy)
8. [Review Philosophy](#8-review-philosophy)
9. [AI-Generated Images](#9-ai-generated-images)
10. [Video Moderation](#10-video-moderation)
11. [Humanity Union Policy](#11-humanity-union-policy)
12. [Stored Metadata](#12-stored-metadata)
13. [Privacy](#13-privacy)
14. [Future Evolution](#14-future-evolution)
15. [Architecture Decisions](#15-architecture-decisions)
16. [Out of Scope](#16-out-of-scope)
17. [Future Implementation Roadmap](#17-future-implementation-roadmap)
18. [Guiding Principle](#18-guiding-principle)

---

# 1. Purpose

## Why AI Moderation Exists

Humanity Union is a public civic platform. Media that Participants attach to their civic work — an Initiative's cover image, an illustration, an uploaded video, a linked video — becomes visible to the public the moment it is approved. Public visibility carries public responsibility.

Manual review of every uploaded image and video does not scale to a platform intended to support civic participation at global scale. Some form of automated first-pass assistance is required simply to keep the volume of media manageable for any future human reviewer, and to protect Participants from encountering clearly unacceptable content before a human ever looks at it.

## Why Humanity Union Needs Automated Moderation

Without an automated first pass:

- clearly unacceptable material (explicit sexual content, graphic violence, exploitation) could reach public civic pages before any human notices it;
- legitimate Participants would be exposed to that material simply by browsing Initiatives;
- the platform's civic credibility would be damaged by even a small number of visible violations;
- a purely manual review queue would become a bottleneck that discourages participation, or would be skipped under pressure, defeating its own purpose.

## Why Moderation Protects Public Civic Space

Public civic space is shared space. A Participant publishing an Initiative is not merely expressing themselves privately — they are placing content in front of every other Participant, and potentially the public internet. Moderation exists to protect that shared space from the narrow category of content that is harmful regardless of civic context, not to police the breadth of civic expression itself.

## Why Moderation Should Never Become Unnecessary Censorship

Civic platforms fail when moderation becomes a tool of suppression rather than a tool of safety. Humanity Union's moderation architecture is deliberately narrow: it targets content that is unacceptable in *any* public space — not content that is merely controversial, political, uncomfortable, or unfamiliar. Historical documentation, protest imagery, symbolic art, and difficult-but-legitimate civic subject matter must remain publishable. A moderation system that cannot distinguish between "graphic and unsafe" and "difficult but legitimate" is not fit for a civic platform, and this architecture is built specifically to preserve that distinction through its emphasis on review over rejection (see §8).

---

# 2. Design Principles

## Provider Independence

The moderation architecture must never depend on the internal behavior, output format, or pricing model of a single AI vendor. Every provider — Gemini, GPT, Claude, or a future internal model — must be interchangeable behind the same moderation contract without requiring a redesign of the pipeline, the policy, or the stored outcome shape.

## Deterministic Moderation Pipeline

The sequence of stages a piece of media passes through — technical validation, AI moderation, decision — must always be the same, always execute in the same order, and always produce a recorded outcome. The *provider* used inside the AI moderation stage may vary; the *pipeline shape* must not.

## AI Assists — Not Governs

An AI moderation provider produces a signal, not a verdict. The Decision Engine (§4, §7), not the AI provider, is the component that determines what a Participant and the public see. No AI provider output is ever wired directly to publication or rejection without passing through the platform's own decision policy.

## Preserve Civic Expression

The architecture is optimized to permit the broadest reasonable range of civic, educational, historical, symbolic, and documentary content. Moderation exists to catch the narrow set of clearly unacceptable material, not to enforce taste, ideology, or comfort.

## Explicit Transparency

Every moderation decision is explainable to the platform: what stage produced the outcome, what policy version was applied, and what the resulting state is. Participants are told, in plain language, what happened to their media and what they can do next (§7). They are never shown internal classification detail, provider names, or model reasoning.

## Review Instead of Overblocking

When automated confidence is insufficient to justify either approval or rejection, the architecture routes the media to a reviewable, non-public state rather than guessing in either direction. Uncertainty is resolved by review, never by an automatic assumption of guilt.

## Architecture-First Implementation

No moderation provider is integrated until the deterministic pipeline, the policy contract, and the stored-outcome shape are agreed upon. This prevents any single provider's capabilities or limitations from silently becoming the platform's moderation architecture.

---

# 3. Supported Media

This architecture applies uniformly to every current and planned form of civic media:

| Media Category | Status | Notes |
|---|---|---|
| **Images** (uploaded) | Current | Initiative cover images and similar direct uploads |
| **AI-generated illustrations** | Current / Growing | Produced by Participants using external or platform-integrated generation tools |
| **Uploaded videos** | Future-facing | Architecture defined here; upload itself depends on separate technical-validation infrastructure (§5, §16) |
| **External video links** | Current | YouTube, Vimeo, and future approved providers |
| **Document thumbnails** | Future | Preview images generated from civic documents |
| **Future archive media** | Future | Public Impact, Civic Archive, and other civic records that may carry attached media |

## AI-Generated Origin Is Never a Rejection Reason

Whether an image was drawn by a Participant, photographed, or generated by an AI tool is never, by itself, grounds for moderation action. Moderation evaluates what is visibly depicted in the final media, not how that media was produced. This is expanded in §9.

---

# 4. Moderation Pipeline

Every piece of media submitted for public civic use passes through the same three-stage pipeline before it may reach Publication.

```text
Stage 1: Technical Validation
        ↓
Stage 2: AI Moderation
        ↓
Stage 3: Decision Engine
        ↓
Publication
```

## Stage Responsibilities

| Stage | Responsibility | Failure Behavior |
|---|---|---|
| **1. Technical Validation** | Confirms the media is what it claims to be, is structurally safe, and is within platform limits | Rejects before AI is ever invoked (§5) |
| **2. AI Moderation** | Produces a content-safety signal for media that has already passed technical validation | Cannot itself publish or reject; produces input to Stage 3 (§6) |
| **3. Decision Engine** | Applies platform policy to the AI signal (and, in the future, to prior review outcomes) to produce one of three outcomes | Determines APPROVED / REVIEW_REQUIRED / REJECTED (§7) |

## Expanded Pipeline View

```text
Media Submitted
      ↓
┌─────────────────────────┐
│ Stage 1                 │
│ Technical Validation     │
│  - mime type              │
│  - file signature         │
│  - integrity               │
│  - malware scan            │
│  - size                    │
│  - duration                │
│  - provider validation     │
└─────────────────────────┘
      ↓ (passes)
┌─────────────────────────┐
│ Stage 2                 │
│ AI Moderation            │
│  - provider-independent    │
│    content-safety signal   │
└─────────────────────────┘
      ↓
┌─────────────────────────┐
│ Stage 3                 │
│ Decision Engine          │
│  - applies policy           │
│  - never trusts AI alone    │
└─────────────────────────┘
      ↓
   APPROVED ──────────────→ Publication
   REVIEW_REQUIRED ───────→ Hidden, pending review
   REJECTED ──────────────→ Not published
```

## Pipeline Invariants

- No media reaches Stage 2 without passing Stage 1 in full.
- No media reaches Publication without passing through Stage 3.
- No stage may be skipped, reordered, or bypassed for any media category listed in §3.
- The pipeline shape is identical for every current and future AI provider (§6).

---

# 5. Technical Validation

Technical validation is deterministic, provider-independent, and executes before any AI cost or AI judgment is involved. It answers a narrower question than moderation: not "is this content acceptable?" but "is this file what it claims to be, and is it safe to process at all?"

## What Technical Validation Checks

| Check | Purpose |
|---|---|
| **MIME type** | Confirms the declared file type is one the platform explicitly supports |
| **File signature** | Confirms the file's actual bytes match its declared type, independent of client-supplied labels |
| **Integrity** | Confirms the file is not corrupted or truncated in a way that would make it unreadable or unsafe to render |
| **Malware scan** | Confirms the file does not carry executable or malicious payloads |
| **Size** | Confirms the file is within platform-approved limits |
| **Duration** | For video, confirms runtime is within platform-approved limits |
| **Provider validation** | For external video links, confirms the link belongs to an explicitly approved provider and resolves to a real, canonical video reference |
| **Unsafe embedded content** | Confirms the file does not contain embedded scripts, markup, or other executable structures disguised as media |

## Result

Media that fails any technical validation check is **rejected before AI is ever invoked.** This protects the AI moderation stage from being asked to reason about broken, malicious, or disguised files, and ensures moderation cost is spent only on media that is technically legitimate.

Technical validation failures are not content judgments. A rejected-at-Stage-1 file is not accused of depicting anything unacceptable — it simply never qualified to be evaluated.

---

# 6. AI Moderation

AI Moderation is the second pipeline stage. It receives only media that has already passed technical validation, and it produces a single, provider-independent content-safety signal for the Decision Engine to interpret.

## Provider Abstraction

The platform depends on a general **moderation provider** concept, not on any specific vendor. Conceptually, the platform recognizes one moderation-provider role, and any number of concrete providers may fulfill that role over time:

- **MediaModerationProvider** — the general role every concrete provider fulfills: accept validated media, return a content-safety signal.
- **GeminiProvider** — the first planned concrete implementation of that role.
- **GPTProvider** — a possible future implementation.
- **ClaudeProvider** — a possible future implementation.
- **InternalProvider** — a possible future implementation built and hosted by Humanity Union itself.

No production interface, request format, or response schema is defined by this document. This section describes the *role* a provider plays in the architecture, not its technical contract.

## Provider Interchangeability

Because every concrete provider fulfills the same role, the platform may:

- change which provider is active without changing the pipeline, the policy, or the stored-outcome shape;
- run more than one provider and compare outcomes, if a future need for cross-verification arises;
- retire a provider entirely without any downstream component being aware of the change.

## What the AI Moderation Stage Does Not Do

- It does not decide what is published. That is the Decision Engine's responsibility (§7).
- It does not see, or need to see, Participant identity, Initiative content, or any civic context beyond the media itself.
- It does not persist its own reasoning (§12, §13).
- It does not distinguish "AI-generated" from "human-created" media as an input to its judgment (§9).

---

# 7. Moderation Policy

The Decision Engine (Stage 3) converts the AI Moderation signal into exactly one of three platform-defined outcomes. These outcomes — not the underlying AI signal — are what the rest of the platform, and the Participant, ever see.

## APPROVED

The media is automatically published. No further action is required from the Participant or a reviewer.

## REVIEW_REQUIRED

The media is temporarily hidden from public view pending additional verification. It is not accused of being a violation — it is simply not yet confirmed safe for public display.

The Participant sees:

> "This media requires additional verification before it can be displayed publicly."

## REJECTED

The media is not published. The Participant is invited to submit different media rather than being told their submission was reviewed and condemned in detail.

The Participant sees:

> "This media cannot be approved for public display. Please choose another image or video."

## Policy Table

| Outcome | Public Visibility | Participant Message | Tone |
|---|---|---|---|
| **APPROVED** | Immediate, full | None required | Neutral / silent success |
| **REVIEW_REQUIRED** | None, until reviewed | "This media requires additional verification before it can be displayed publicly." | Neutral, non-accusatory |
| **REJECTED** | None | "This media cannot be approved for public display. Please choose another image or video." | Neutral, non-accusatory, action-oriented |

No outcome message ever names a specific policy category, references AI involvement, or implies wrongdoing by the Participant.

---

# 8. Review Philosophy

The Decision Engine's governing philosophy is asymmetric by design: the cost of wrongly hiding legitimate content must always be weighed against the cost of wrongly publishing unacceptable content, and the architecture resolves that tension toward review, not toward rejection.

## Reject Only Obvious Violations

REJECTED is reserved for content that is unambiguously unacceptable under §11 — not for content that is merely unusual, provocative, or difficult to classify. A clearly identifiable violation may be rejected outright. Anything short of that clarity does not qualify for outright rejection.

## Review Uncertain Cases

Uncertainty is not a reason to reject. It is the specific condition REVIEW_REQUIRED exists to hold. Media that the AI Moderation stage cannot confidently classify one way or the other must be routed to REVIEW_REQUIRED, not defaulted to either APPROVED or REJECTED.

## Do Not Punish Ambiguous Content Automatically

No Participant is penalized, flagged, restricted, or treated as suspect on account of a REVIEW_REQUIRED outcome. It is a neutral, temporary state — a request for more certainty, not a judgment.

---

# 9. AI-Generated Images

Humanity Union explicitly documents that the origin of an image — hand-drawn, photographed, or AI-generated — has no bearing on its moderation outcome.

**AI-generated artwork is NOT a moderation violation.**

Only visible content matters. The moderation pipeline evaluates what is depicted in the final image reaching the platform, exactly as it would evaluate a photograph or a traditionally-created illustration depicting the same content. A civic illustration generated by an AI tool to visualize an Initiative's goals is treated identically to a hand-drawn version of the same illustration.

This principle protects a legitimate and growing form of civic expression: Participants increasingly use generative tools to produce infographics, symbolic art, and illustrative material to support their Initiatives. The architecture must never create a second, stricter standard for that material simply because of how it was produced.

---

# 10. Video Moderation

Video introduces a duration dimension that images do not have. The architecture distinguishes two moderation approaches based on video length, so that moderation depth scales sensibly with content length rather than applying a uniform, one-size-fits-all analysis.

## Short Videos

Short videos are moderated through complete analysis before publication:

| Technique | Purpose |
|---|---|
| **Key frames** | Sampled frames across the video's duration, analyzed as the AI Moderation stage would analyze a still image |
| **Transcript** | Spoken or captioned content, analyzed for unacceptable material carried through audio or text rather than imagery |
| **OCR** | Text visible within the video frame itself (overlays, signage, on-screen text), analyzed for content invisible to key-frame sampling alone |

Short videos are expected to complete moderation before the Participant's next interaction, consistent with the responsiveness of image moderation.

## Long Videos

Long videos are not exhaustively analyzed before an initial state is assigned, because doing so would either be prohibitively slow or prohibitively expensive at platform scale. Instead:

| Technique | Purpose |
|---|---|
| **Preview** | An initial segment or representative sample is analyzed first, sufficient to catch obvious violations quickly |
| **Metadata** | Declared duration, provider, and technical characteristics inform how the video is queued for deeper analysis |
| **Asynchronous verification** | Full moderation continues in the background after an initial state (typically REVIEW_REQUIRED) is assigned, without blocking the Participant's workflow |

## Video Moderation Principle

A video's length must never force a choice between "block civic participation while waiting" and "publish before verification is complete." The short/long distinction exists specifically to avoid that false choice: short videos can afford full analysis without delay, and long videos default to a safe, non-public state while deeper analysis proceeds.

---

# 11. Humanity Union Policy

This section documents illustrative categories of acceptable and unacceptable content for architectural planning purposes. It intentionally does not define platform-wide legal policy, a legal compliance framework, or an exhaustive rulebook — those are governance concerns outside this document's scope (§16).

## Illustrative Acceptable Content

- Educational material
- Historical documentation
- Documentary imagery
- Symbolic and representational art
- Peaceful demonstrations and civic gatherings
- Illustrations supporting an Initiative's goals
- Infographics and data visualizations
- Architecture and the built environment
- Nature and landscape imagery
- Animals
- Scientific graphics and diagrams

## Illustrative Unacceptable Content

- Explicit sexual material
- Severe graphic violence
- Obvious exploitation
- Publicly unsafe media (content whose public display itself creates danger, independent of subject matter)

## Policy Boundary

This list is illustrative, not exhaustive, and is expected to evolve under a versioned policy (§12, §14) rather than be hard-coded into the architecture. The architecture's responsibility is to provide a pipeline and decision framework capable of applying *whatever* the current policy version defines — not to encode the policy's specific boundaries as permanent architectural fact.

---

# 12. Stored Metadata

The platform stores only the outcome of moderation, never the AI provider's reasoning. The following are illustrative future metadata concepts a moderated media record may carry:

| Field Concept | Purpose |
|---|---|
| **moderationProvider** | Which concrete provider (§6) produced the signal behind this outcome |
| **policyVersion** | Which version of the Humanity Union content policy (§11) was in effect when the decision was made |
| **moderationDecision** | The Decision Engine's outcome: APPROVED, REVIEW_REQUIRED, or REJECTED |
| **confidence** | A coarse indication of how certain the signal was, used by the Decision Engine and by any future human reviewer |
| **verifiedAt** | When the decision was produced |
| **requiresReview** | Whether the media is currently pending human review |
| **technicalValidationPassed** | Whether Stage 1 was satisfied, independent of the AI Moderation outcome |

## What Is Never Stored

The platform never stores the AI provider's free-text reasoning, explanation, or classification detail. Only the structured outcome above is retained. This is a deliberate privacy and stability boundary, not an oversight: provider-specific reasoning text is exactly the kind of detail that would make the stored record provider-dependent, undermine §2's provider-independence principle, and risk exposing internal classification detail to future data access (§13).

This section describes conceptual fields for future planning. It does not define a database schema, a TypeScript interface, or an API contract.

---

# 13. Privacy

Media moderation touches Participant-submitted content, and the architecture treats that content with a deliberately narrow data-retention posture.

- **Media is analyzed.** The AI Moderation stage examines the submitted media (and, for video, its audio and on-screen text) to produce a content-safety signal.
- **Reasoning is not stored.** Whatever explanation or classification detail a provider might generate internally while producing that signal is not persisted anywhere on the platform (§12).
- **Only moderation metadata is persisted.** The durable record of a moderation event is limited to the structured outcome fields described in §12 — provider identity, policy version, decision, confidence, timestamps, and review state. No provider-generated narrative text is retained.

This posture keeps the platform's stored data minimal, keeps it provider-independent (a future provider swap does not leave behind incompatible historical reasoning text), and reduces the surface area of sensitive interpretive content the platform would otherwise be responsible for protecting.

---

# 14. Future Evolution

The architecture is designed to accommodate growth without redesign.

| Future Capability | Compatibility Approach |
|---|---|
| **Future providers** | New concrete providers (§6) are added behind the existing MediaModerationProvider role; the pipeline and policy are unaffected |
| **Future human moderation** | REVIEW_REQUIRED already establishes the non-public holding state a human review workflow would act upon; no pipeline change is required to introduce reviewer tooling |
| **Future appeals** | A REJECTED outcome is a platform decision, not an immutable fact; an appeals capability can act on the existing decision record without altering the pipeline that produced it |
| **Future re-verification** | Because `policyVersion` is recorded per decision (§12), previously-decided media can be identified and re-evaluated whenever policy changes, without ambiguity about which policy produced the original outcome |
| **Future policy versions** | §11's illustrative content boundaries are expected to evolve; `policyVersion` metadata exists specifically so that evolution is traceable rather than silent |

The architecture's stability comes from keeping the pipeline shape (§4) and the three-outcome policy contract (§7) fixed, while allowing everything beneath them — providers, policy detail, review tooling, appeal mechanics — to evolve freely.

---

# 15. Architecture Decisions

The following decisions are recorded as binding for any future implementation built against this architecture:

1. **AI assists, it does not govern.** No AI provider output is wired directly to publication or rejection; every signal passes through the platform's own Decision Engine.
2. **The architecture is provider-independent.** Gemini is the first planned implementation, not an architectural dependency. GPT, Claude, and internal providers must be substitutable without redesign.
3. **Review is preferred over false positives.** When automated confidence is insufficient, the architecture routes to REVIEW_REQUIRED rather than guessing toward either APPROVED or REJECTED.
4. **AI-generated origin is never grounds for discrimination.** Moderation evaluates visible content only, never the production method behind it (§9).
5. **The moderation pipeline is deterministic.** Technical validation, AI moderation, and decision always execute in the same order, for every media category, regardless of which concrete provider is active.
6. **Only structured outcome metadata is stored; AI reasoning is never persisted.** This protects both provider independence and Participant privacy (§12, §13).

---

# 16. Out of Scope

This document intentionally does not implement, specify, or define any of the following. They are deferred to future, separately-scoped implementation work:

- Gemini API integration
- Backend services
- Database schema
- Upload endpoints
- User interface design
- Notifications
- Review dashboard
- Human moderation tools
- Exhaustive or legally-binding content policy
- Pricing, quota, or vendor-contract considerations for any AI provider

---

# 17. Future Implementation Roadmap

The following phases are a suggested, logical implementation sequence. They are illustrative planning guidance, not a committed schedule.

| Phase | Focus |
|---|---|
| **Phase 1** | Technical validation — the deterministic, provider-independent Stage 1 checks (§5), built and verified before any AI cost is introduced |
| **Phase 2** | Gemini provider — the first concrete MediaModerationProvider implementation (§6), integrated behind the provider abstraction |
| **Phase 3** | Moderation persistence — durable storage of the structured outcome metadata defined in §12, with no provider reasoning retained |
| **Phase 4** | Review dashboard — human-facing tooling to act on REVIEW_REQUIRED media |
| **Phase 5** | Appeals — a Participant-facing path to contest a REJECTED outcome |
| **Phase 6** | Additional AI providers — GPT, Claude, or an internal provider, added behind the same abstraction established in Phase 2 |

Each phase should be validated independently before the next begins, consistent with the platform's broader practice of bounded, incrementally-verified architectural change.

---

# 18. Guiding Principle

Artificial intelligence protects Humanity Union's public civic space not by deciding what may be said or shown, but by catching the narrow, unambiguous harms that have no place in any public space — while leaving every legitimate act of civic expression, illustration, and documentation to the Participants who created it.

---

**Document:** AI Media Moderation Architecture
**Version:** 1.0
**Status:** Architectural Blueprint
**Depends On:** [Book_01_Foundation/02_CHARTER_OF_ETHICAL_TECHNOLOGY.md](/blueprint/Book_01_Foundation/02_CHARTER_OF_ETHICAL_TECHNOLOGY.md)
**Scope:** Platform-wide AI-assisted media moderation contract
**Implementation:** Out of scope for this document
