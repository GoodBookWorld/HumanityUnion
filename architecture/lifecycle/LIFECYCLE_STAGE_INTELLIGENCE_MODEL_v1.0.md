# Lifecycle Stage Intelligence Model — v1.0

**Authority:** Lifecycle Architecture Part C ("Stage Intelligence Model"), building on Initiative Lifecycle Part A ("Lifecycle Stage Workspace Foundation"), Part B ("Automated Collaborative Analysis Vertical Slice"), and Lifecycle UX Correction Pack 01 ("Communication Routing, Lifecycle Progress & Notification Center").

**Status:** Architecture specification only. No production code, database schema, API route, or UI component was added, removed, or modified by this document. Every claim about *current* behavior below is grounded in the source files cited inline; every claim about *future/universal* behavior is a normative rule that later stage packs (Improvement Proposals, Revision, Petition, Decision Session, Collective Decision, Implementation Commitments, Implementation Tracking, Official Responses, Public Impact, Civic Archive) MUST follow. This document is the single source of truth for how the AI/Intelligence Layer plugs into the Initiative Lifecycle. Where it uses "MUST" / "MUST NOT" / "NEVER" / "ALWAYS", the rule is binding on every future implementation, not aspirational language.

**Scope boundary:** This document defines a *model* — a contract, a vocabulary, and a set of invariants. It does not define wire formats, does not add fields to `@hu/types`, and does not create any new module. Concrete Part D+ implementation packs are expected to satisfy this model using the primitives that already exist (cited throughout) plus straightforward, additive extensions of them.

---

## Table of Contents

1. [Purpose](#part-1--purpose)
2. [Canonical Principle — One Renderer, Three Presentation Modes](#part-2--canonical-principle)
3. [Universal Stage Model](#part-3--universal-stage-model)
4. [Universal AI Principles](#part-4--universal-ai-principles)
5. [Stage Intelligence Contract](#part-5--stage-intelligence-contract)
6. [Stage-Specific AI Responsibilities](#part-6--stage-specific-ai-responsibilities)
7. [Intelligence Sources](#part-7--intelligence-sources)
8. [Author Workspace](#part-8--author-workspace)
9. [Public Workspace](#part-9--public-workspace)
10. [Preview Mode](#part-10--preview-mode)
11. [Publication Rules](#part-11--publication-rules)
12. [Lifecycle Notifications](#part-12--lifecycle-notifications)
13. [Reminder Integration](#part-13--reminder-integration)
14. [Stage Transition Rules](#part-14--stage-transition-rules)
15. [Future AI Providers](#part-15--future-ai-providers)
16. [Engineering Principles & Compatibility](#part-16--engineering-principles--compatibility)
17. [Deliverables](#part-17--deliverables)
18. [Validation & Final Architecture Review](#part-18--validation--final-architecture-review)

---

## Part 1 — Purpose

This document defines the **universal Intelligence Model** shared by every stage of the Initiative Lifecycle:

```text
Initiative
  ↓
Discussion
  ↓
Collaborative Analysis            ◄── first implemented vertical slice (Part B)
  ↓
Improvement Proposals
  ↓
Revision
  ↓
Petition
  ↓
Decision Session
  ↓
Collective Decision
  ↓
Implementation Commitments
  ↓
Implementation Tracking
  ↓
Official Responses
  ↓
Public Impact
  ↓
Civic Archive
```

This ordering is not new — it is the exact 12-stage registry already codified in
`packages/types/src/domain/initiative-lifecycle-stage.ts`
(`INITIATIVE_LIFECYCLE_STAGE_REGISTRY`), which this document treats as canonical and
non-negotiable. "Initiative" is stage `order: 0` and is the only stage where
`authorModeApplies: false` — Author Mode begins at Collaborative Analysis, per the
existing `isInitiativeLifecycleAuthorWorkspaceStage` rule.

The Intelligence Model exists to answer one question consistently for all twelve
stages: **"How does AI assistance enter a Lifecycle stage without becoming twelve
different, incompatible AI features?"**

The answer has two halves:

1. **One structural contract** (Parts 3 and 5) that every stage's AI Assistant must
   satisfy, regardless of what that stage's content actually is.
2. **One authority model** (Part 4) that never changes: the AI is always advisory,
   the Author is always the one who publishes.

Everything else in this document — sources, notifications, reminders, providers — is
a direct consequence of those two halves.

---

## Part 2 — Canonical Principle

### The rule

> **`InitiativeLifecycleStageWorkspace` is the only canonical implementation of every
> Lifecycle stage.**
>
> Author Mode, Preview Mode, and Public Mode are never separate implementations.
> They are **Presentation Modes** of the same canonical Stage Workspace.

This is not a new rule invented by this document — it is the founding rule of
Initiative Lifecycle Part A, and Part B (Collaborative Analysis) is the proof that it
holds under a real, non-trivial stage. This document elevates it to a permanent
architectural invariant that governs every future stage pack.

### What "one renderer" concretely means today

The renderer is
`apps/web/src/features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx`.
It is parameterized by exactly:

- an `InitiativeLifecycleStageProjection` (server-computed, one per Initiative × stage
  × viewer — `packages/types/src/domain/initiative-lifecycle-stage-projection.ts`), and
- a small number of **stage-specific render-prop slots** (source panel, editor,
  AI sidebar, public result) supplied by the calling stage feature.

The three Presentation Modes are derived, never separately coded:

| Presentation Mode | How it is derived | Server/Client |
|---|---|---|
| **Author Workspace** | `projection.presentationMode === "author_workspace"` — server resolves this from real identity via `resolveInitiativeLifecyclePresentationMode` (`apps/api/src/shared/initiative-lifecycle-stage`). Only ever true for the Initiative's own Author, only on stages where `authorModeApplies` is true. | Server-authoritative |
| **Public Preview** | Author Workspace **plus** the client-only boolean `isPreviewMode` (`InitiativeLifecycleStageWorkspace.tsx`). Sets `data-presentation-mode="public_preview"`; renders the exact same public sidebar and read-only content the true Public Mode renders, sourced from the *draft* instead of the *published record*. | Client toggle on top of Author Workspace |
| **Public Viewer** | `projection.presentationMode === "public"` — every viewer who is not the Author (Active Ally, other Participant, or Guest), on every stage. | Server-authoritative |

No stage feature is permitted to introduce a fourth mode, a parallel component tree,
or a bespoke "public version of the editor." If a stage needs to show something
differently to the public, it does so by branching *inside* the one render-prop slot
(e.g. `publicResultSlot`), keyed off the mode the shell already passed it — never by
mounting a second component tree.

### Why this prevents architectural divergence

1. **No drift between "what the Author edits" and "what the public sees."** When
   Author view and Public view are two different components, they inevitably diverge
   over time (a field added to one, a style fixed in the other, a bug fixed in only
   one). One renderer makes divergence structurally impossible — there is only one
   place a Collaborative Analysis's title can be rendered.
2. **Preview is trustworthy by construction.** Because Preview literally *is* the
   Public renderer (Part 10), an Author previewing their draft is guaranteed to see
   exactly what will go live. A separate "preview component" can never make this
   guarantee — it can only approximate it, and approximations rot.
3. **New stages inherit correctness for free.** A new stage pack (e.g. Improvement
   Proposals) does not re-solve "how do Author/Preview/Public work" — it only supplies
   its own domain content into the existing slots. Every cross-cutting fix (accessibility,
   focus management, save-button feedback, header metadata) is written once and
   applies to all twelve stages simultaneously.
4. **AI assistance cannot leak into the public surface by accident.** Because the AI
   Assistant sidebar is a slot that is only ever mounted when
   `presentationMode === "author_workspace" && !isPreviewMode`, there is no code path
   where an AI control could render for a Guest — the shell itself enforces this
   (Part 8/9), not each stage's own vigilance.
5. **One migration path for future AI providers.** Because every stage's AI surface
   is a slot inside the same shell, swapping or upgrading the underlying AI provider
   (Part 15) is a backend seam change, never a frontend rewrite across twelve
   components.

**This rule has no exceptions.** A future stage pack that finds it "easier" to build
a dedicated component for its public view is, by definition, proposing a regression
against this document and must not proceed without an explicit architecture
amendment.

---

## Part 3 — Universal Stage Model

Every Lifecycle stage that supports Author drafting (`supportsDraft: true` in the
stage registry) follows the same nine-step workflow:

```text
Automatic Collection
        ↓
Stage Intelligence
        ↓
AI Recommendations
        ↓
Author Editing
        ↓
Preview
        ↓
Save Draft
        ↓
Publish
        ↓
Public Participation
        ↓
Notification
```

Stages without a draft/publish cycle (`supportsDraft: false` — e.g. Collective
Decision, Implementation Tracking today) still pass through **Automatic Collection →
Stage Intelligence → Public Participation → Notification**; the Author
Editing/Preview/Save Draft/Publish steps simply collapse because there is no draft
concept to edit. The model degrades gracefully rather than forking into a second
model.

### Step-by-step responsibilities

**1. Automatic Collection** — *System responsibility. Fully automatic. No AI.*
The platform assembles a **Source Snapshot** from data that already exists in other
domains (Discussion comments, Helpful/Not Helpful counts, Proposal-marked comments,
Ready-to-Collaborate participants, Active Allies, prior stage results, referenced
attachments). This is deterministic aggregation, not generation. Collaborative
Analysis's `InitiativeAnalysisSourceSnapshot` (built by
`initiative-analysis-source-snapshot-builder.ts`) is the reference implementation;
every future stage supplies its own snapshot builder but exposes the same
`InitiativeLifecycleSourceSnapshotSummary` shape
(`packages/types/src/domain/initiative-lifecycle-source-snapshot.ts`) to the shell.
**Editable: no. Read-only: yes, entirely.**

**2. Stage Intelligence** — *System + AI responsibility. Deterministic today, AI-assisted tomorrow (Part 15).*
The Source Snapshot is analyzed to surface themes, contradictions, missing evidence,
and open questions — the "Detected …" sections of the Stage Intelligence Contract
(Part 5). Today (Collaborative Analysis) this analysis is deterministic code, not a
model call; the contract is written so that a future AI provider can replace the
deterministic analyzer without changing what the Author Workspace or AI Assistant
sidebar consume. **Editable: no. Read-only: yes.**

**3. AI Recommendations** — *AI responsibility (or its deterministic stand-in). Advisory only.*
From Stage Intelligence, the system proposes: a generated draft, suggested wording
improvements, and a prioritized list of gaps/contradictions/unanswered questions.
This is the `InitiativeLifecycleAiAssistResult` contract
(`packages/types/src/domain/initiative-lifecycle-ai-assist.ts`): every recommendation
carries a `provenanceNote` ("Based on 3 Collaboration Channel contributions") and is
explicitly marked `isPlaceholder` when no real provider is wired. **Editable: not
directly** — a recommendation becomes editable content only once the Author explicitly
accepts it into their draft (see Step 4). Recommendations themselves are never
silently merged into the draft.

**4. Author Editing** — *Human responsibility. This is the only step where content becomes mutable.*
The Author works in the Stage Workspace's editor slot, either starting from a
generated draft (Step 3) or writing from scratch. All draft fields are Author-owned
and Author-editable. **Editable: yes, exclusively by the Author (or a delegate the
domain explicitly grants — Part A's `viewerRole` vocabulary has no such delegate today
beyond the Author).**

**5. Preview** — *Human-triggered, system-rendered. Read-only, using the Public renderer.*
The Author reviews their current draft rendered exactly as the public will eventually
see it (Part 10). **Editable: no** — Preview is strictly a read-only reflection of the
current draft; there is no "edit in preview."

**6. Save Draft** — *Human-triggered, system-persisted.*
The Author's edits are persisted as the stage's current (unpublished) draft. This is
a private write — visible only to the Author, never to Active Allies, other
Participants, or Guests. **Editable: implicitly yes** — Save Draft is what makes
subsequent edits durable; it never changes visibility.

**7. Publish** — *Human-triggered (Author, with explicit confirmation), system-executed.*
The draft becomes the stage's canonical public result: version is recorded,
publication metadata is stamped, the previous published version (if any) is preserved
as history, and the next Lifecycle stage is unlocked (Part 11). **Editable: no** —
once published, the record for that version is immutable; the Author may only publish
a *new* version by repeating Steps 4–7.

**8. Public Participation** — *Human responsibility (any eligible viewer), domain-specific.*
Once published, the general public interacts with the result according to that
stage's own participation model — reacting (Collaborative Analysis's Support / Do Not
Support), signing (Petition), voting (Collective Decision), etc. **Editable: no** for
the published content itself; the participation *action* (a reaction, a signature, a
vote) is a new, separate, additive record — it never mutates the published stage
content.

**9. Notification** — *Fully automatic system responsibility.*
Publishing fires exactly one canonical `InitiativeLifecycleStagePublished` domain
event, which fans out to Active Allies as one Notification (Part 12) and, where
applicable, one forward-looking Reminder (Part 13). **Editable: no** — notifications
are generated, never authored by hand.

### Read-only vs. editable, summarized

| Step | Who acts | Editable content produced? |
|---|---|---|
| Automatic Collection | System | No — read-only Source Snapshot |
| Stage Intelligence | System/AI | No — read-only analysis |
| AI Recommendations | AI | No (until explicitly accepted in Step 4) |
| Author Editing | Author | **Yes** — the only mutable step |
| Preview | Author (view only) | No |
| Save Draft | Author (trigger), System (persist) | No new edits — persists step 4's edits |
| Publish | Author (trigger), System (execute) | No — locks the version |
| Public Participation | Any eligible viewer | No (adds a separate participation record) |
| Notification | System | No — generated only |

---

## Part 4 — Universal AI Principles

These rules are immutable and apply to every AI Assistant on every stage, for all
time. They are deliberately written as prohibitions first, capabilities second,
because the prohibitions are what make the AI Assistant safe to introduce into a
civic-participation platform at all.

### The AI Assistant NEVER

- publishes anything
- votes on anything
- approves anything
- rejects anything
- decides anything on behalf of a human
- moves the Initiative to a different Lifecycle stage
- changes Initiative content autonomously (i.e., without an explicit Author action
  accepting the change)

### The AI Assistant ONLY

- collects information (via the Source Snapshot — Step 1 of Part 3)
- structures information (Stage Intelligence — Step 2)
- finds patterns (`summarize_source_themes`)
- detects contradictions (`identify_contradictions`)
- detects missing information (`identify_missing_information`)
- generates draft text (`generate_draft`)
- improves clarity (`improve_wording`)
- suggests improvements
- identifies risks
- identifies unanswered questions
- helps the Author — and only the Author; the AI Assistant sidebar is never mounted
  for a non-Author viewer (Part 8/9)

This list is not illustrative — it is exhaustive. It is intentionally identical to
the `InitiativeLifecycleAiAssistOperation` union already defined in
`packages/types/src/domain/initiative-lifecycle-ai-assist.ts`
(`generate_draft | regenerate_section | improve_wording |
identify_missing_information | identify_contradictions | summarize_source_themes`).
Any future stage-specific AI capability MUST be expressible as one of these
operations (or a straightforward additive union member of the same *kind* —
information, structuring, suggestion) — never as an operation that writes, publishes,
or transitions state directly.

### The Author is always responsible for publication

No matter how confident, complete, or well-evidenced an AI-generated draft is:

1. The AI never calls `publish`. Only an explicit Author action does.
2. Every AI output the Author did not explicitly accept never enters the published
   record.
3. Publication always requires human confirmation (Part 11).
4. The publication's `publishedByParticipantId` is always a human Author's
   participant id — there is no "published by AI" or "published by system" identity
   anywhere in the model.

This means the AI Assistant's worst-case failure mode is "gave a bad suggestion that
a human then had the opportunity to reject" — never "took an action that altered
public civic record." This is the central safety property of the entire Intelligence
Layer, and every future extension of it must preserve this property exactly.

---

## Part 5 — Stage Intelligence Contract

Every stage's AI Assistant, regardless of its domain content, exposes the same
conceptual sections. The *contents* of each section are stage-specific (Part 6); the
*shape* of the contract never changes. This is the "one AI Assistant sidebar
component, many stage-specific data sources" application of the Part 2 canonical
principle, extended from rendering into intelligence.

| Contract Section | Purpose | Existing type-level anchor |
|---|---|---|
| **Collected Sources** | What raw material this stage's intelligence is built from | `InitiativeLifecycleSourceSnapshotSummary.items` |
| **Detected Themes** | Recurring topics/arguments found across the sources | Stage-specific summary field (e.g. Collaborative Analysis's `mostDiscussedTopics`) |
| **Detected Problems** | Weaknesses, gaps, or risks surfaced by analysis | `InitiativeLifecycleAiCapabilities.canIdentifyGaps` |
| **Detected Contradictions** | Statements in the sources that conflict with each other | `InitiativeLifecycleAiCapabilities.canIdentifyContradictions` |
| **Detected Missing Evidence** | Claims made without supporting source material | Derived from Collected Sources vs. draft content |
| **Suggested Improvements** | Concrete wording/structure suggestions the Author may accept | `InitiativeLifecycleAiAssistOperation = "improve_wording"` |
| **Generated Draft** | The full candidate draft produced from the sources | `AnalysisDraftContent`-shaped stage-specific content (Collaborative Analysis's reference implementation) |
| **Confidence Indicators** | How strong the evidentiary basis is for a given section (e.g. "3 sources" vs. "0 sources — placeholder text") | `InitiativeLifecycleAiAssistSuggestion.provenanceNote` + `isPlaceholder` |
| **Open Questions** | Discussion items nobody has answered yet | Stage-specific summary field (Collaborative Analysis's `openQuestions`) |
| **Next Recommended Actions** | What the Author should plausibly do next | Feeds directly into Reminder generation (Part 13) |

### Contract discipline

- Every section MUST be derivable from the stage's own Source Snapshot (Part 7) —
  never from data the stage does not have permission to read.
- Every section that is empty MUST render as an honest empty/placeholder state
  ("No open questions identified in the discussion yet.") — never omitted silently and
  never fabricated to look non-empty. This mirrors the existing deterministic draft
  builder's `bulletList(..., emptyLabel)` pattern in
  `initiative-analysis-draft-builder.ts`.
- Every section is **read-only** in the AI Assistant sidebar. The only way any of this
  content becomes part of the Author's draft is via an explicit "accept" action in
  Author Editing (Part 3, Step 4) — the contract itself never writes to the draft.
- The contract does not require every section to be *useful* for every stage
  (Civic Archive, for instance, has little use for "Detected Contradictions" — its
  Assistant may simply always render that section as empty/not-applicable). It does
  require every section to be *present in shape* so the shared sidebar component never
  needs stage-specific branching to know what to render.

---

## Part 6 — Stage-Specific AI Responsibilities

Each stage's AI Assistant satisfies the same contract (Part 5) with stage-specific
substance. This is the authoritative responsibility list for every stage's Assistant.

| Stage | AI Assistant Focus |
|---|---|
| **Collaborative Analysis** *(implemented, Part B)* | Understanding the problem · finding evidence · finding contradictions · finding missing discussion |
| **Improvement Proposals** | Proposal consolidation · duplicate detection · proposal quality · proposal classification |
| **Revision** | Editing Initiative text · consistency · clarity · Before/After comparison |
| **Petition** | Clear public request · neutral wording · consistency with Revision |
| **Decision Session** | Decision quality · options · risks · participants · timeline |
| **Collective Decision** | Action structure · responsibility mapping · decision completeness |
| **Implementation Commitments** | Responsibility distribution · commitment readiness · implementation feasibility |
| **Implementation Tracking** | Progress · delays · blocked work · completion analysis |
| **Official Responses** | Institution responses · missing documents · source verification · response completeness |
| **Public Impact** | Neutral impact summary · completed actions · remaining actions · measurable outcomes — **never promotional language** |
| **Civic Archive** | Lessons Learned · Knowledge Contribution · Best Practices · Historical Summary — **no personal praise, no political interpretation, no emotional language** |

### Notes on current registry state vs. this model

The stage registry (`INITIATIVE_LIFECYCLE_STAGE_REGISTRY`) currently marks
`aiAssistCapable: false` for **Collective Decision**, **Official Responses**, and
**Civic Archive**. This document's Part 6 responsibilities table is the *target*
model for when those stages are implemented — it does not retroactively change
today's registry values. Each future stage pack MUST flip its own
`aiAssistCapable` flag to `true` as part of implementing that stage's Assistant (never
before, since a `true` flag with no real Assistant behind it would be a
false-availability defect of exactly the kind Part A's tests already guard against —
see `initiative-lifecycle-stage-projection.test.ts`'s `canGenerateDraft` assertions).

### Tone constraints as first-class AI principles

Public Impact and Civic Archive above carry explicit tone constraints ("never
promotional," "no personal praise," "no political interpretation," "no emotional
language"). These are not stylistic suggestions — they are the same category of rule
as Part 4's "AI never publishes": a violation of stage-specific tone is a defect to be
caught the same way a violation of the publish-authority rule would be (automated test
+ code review), because a platform whose civic record reads as promotional or partisan
has failed its neutrality obligation regardless of what workflow produced the text.

---

## Part 7 — Intelligence Sources

Each stage's Source Snapshot (Part 3, Step 1) draws only from the sources relevant to
that stage — never a blanket "everything about this Initiative" dump. This keeps
every stage's intelligence explainable ("this draft is based on exactly these N
items") and keeps snapshot construction bounded and N+1-safe (Part 16).

Available source categories across the platform:

- Initiative (title, description, category, metadata)
- Discussion (comments, threads)
- Comments — Helpful reactions
- Comments — Not Helpful reactions
- Ready to Collaborate participants
- Active Allies
- Improvement Proposals
- Revision (current + history)
- Petition (signatures, endorsement metrics)
- Decision (Decision Session record, Collective Decision outcome)
- Implementation Commitments
- Implementation Tracking (progress records)
- Official Responses
- Public Impact records
- Platform statistics (participation counts, engagement metrics)
- Attachments / Shared Documents
- Referenced external sources
- Published documents from prior Lifecycle stages

### Per-stage relevance (indicative, not exhaustive)

| Stage | Primary sources |
|---|---|
| Collaborative Analysis | Discussion, Comments (Helpful/Not Helpful), Ready to Collaborate, Active Allies, Proposal-marked comments |
| Improvement Proposals | Collaborative Analysis result, Discussion, Proposal-marked comments |
| Revision | Initiative record, published Collaborative Analysis, accepted Improvement Proposals |
| Petition | Published Revision, Initiative record |
| Decision Session | Petition outcome, Revision, prior discussion |
| Collective Decision | Decision Session record, participation statistics |
| Implementation Commitments | Collective Decision outcome |
| Implementation Tracking | Implementation Commitments |
| Official Responses | Petition/Decision outcome, external institutional correspondence (attachments) |
| Public Impact | Implementation Tracking, Official Responses |
| Civic Archive | Every prior published stage result for this Initiative |

A stage's snapshot builder MUST NOT read a source category outside its declared
relevance list without updating this table — this table is the audit trail for "why
does this stage's AI have access to that data."

---

## Part 8 — Author Workspace

Beginning with Collaborative Analysis (and every `authorModeApplies: true` stage
after it), the canonical Author Workspace:

1. **Hides the standard Public Sidebar.**
2. **Replaces it with the Stage Workspace**, which contains:
   - AI Assistant (Stage Intelligence Contract, Part 5)
   - Sources (read-only Source Snapshot panel)
   - Draft Status (presentation status, version, last updated / published metadata)
   - Open Questions
   - **Generate** (triggers `generate_draft`)
   - **Edit** (the draft editor itself)
   - **Preview** (Part 10)
   - **Save Draft**
   - **Publish** (Part 11)
   - **Next Stage** (navigation once unlocked — Part 14)

These map directly onto the existing `InitiativeLifecycleAuthorActionId` vocabulary
(`generate_draft | regenerate_section | improve_wording | save_draft | preview |
publish | open_public_preview | continue_to_next_stage` —
`packages/types/src/domain/initiative-lifecycle-author-action.ts`). Every future
stage's Author Workspace MUST express its actions using this vocabulary; a
stage-specific action name is only acceptable if it is a genuinely new *kind* of
action, at which point this document (and the shared type) must be amended
deliberately, not silently forked per stage.

### Why this improves Author productivity

- **One mental model across all twelve stages.** An Author who has drafted a
  Collaborative Analysis already knows exactly how to draft a Revision, a Petition, or
  a Public Impact report — same buttons, same panel layout, same AI Assistant
  location. There is no per-stage relearning cost.
- **Sources are always visible, never re-derived by the Author manually.** Because
  Automatic Collection (Part 3, Step 1) already assembled the relevant material, the
  Author starts from "here is everything relevant" rather than from a blank page and a
  separate tab full of Discussion comments to re-read.
- **AI Recommendations shorten the path from zero to a reviewable draft.** Generate →
  Edit is materially faster than write-from-scratch, while Edit always remains
  available and authoritative — the Author is never forced to accept an AI draft
  verbatim.
- **Preview eliminates "did I actually save this correctly" anxiety**, because Preview
  is provably identical to what will publish (Part 2/10).
- **Draft Status makes state legible.** An Author returning after days away
  immediately sees whether they have unpublished changes, when they last edited, and
  whether the current draft's source snapshot is stale relative to new Discussion
  activity — without needing to reconstruct that context from memory.

---

## Part 9 — Public Workspace

Visitors — Active Allies, other Participants, and Guests alike, i.e. every viewer for
whom `presentationMode === "public"` — always see:

- **Published result** — the canonical, versioned public content for this stage.
- **Standard Public Sidebar** — the same sidebar every other public stage uses; never
  replaced by the Stage Workspace's Author panel.
- **Participation action** — the stage's own public participation affordance (React,
  Sign, Vote, etc.), when the stage has one (`hasPublicParticipationAction`).

Visitors NEVER see:

- editing controls of any kind
- AI controls of any kind (no Generate button, no AI Assistant sidebar, not even in a
  disabled state — the controls are absent from the DOM, not merely disabled, so there
  is nothing to inspect or re-enable client-side)
- draft information (draft status, draft content, source snapshot staleness)
- unpublished content of any kind, under any circumstance, including a "sneak peek"

This is not merely a UI convention — it is an authorization boundary. The projection
the server returns for a `"public"` viewer MUST NOT include unpublished fields at all
(no data to hide, not merely data the client chooses not to render), matching the
existing `InitiativeLifecycleStageMetadata` design where `publishedRecordId` is `null`
whenever `canViewPublicResult` is `false`.

---

## Part 10 — Preview Mode

Preview uses **the same renderer as Public** (Part 2). The only difference: it
displays the Author's current draft instead of the published version.

Concretely, Preview is Author Workspace (`presentationMode === "author_workspace"`)
plus the client-side `isPreviewMode` flag. When that flag is set:

- the shell hides every Author editing control,
- the shell mounts the exact same public-result slot and public sidebar a true Public
  viewer would see,
- the public-result slot is fed the **current draft** rather than the published
  record whenever a draft exists and nothing has been published yet, or whenever the
  draft has unpublished changes relative to the last published version, and
- the shell is clearly labeled ("Public Preview") so the Author is never confused
  about which mode they are in (Part 18 accessibility requirement: labeling must not
  rely on color alone).

### Why Preview must never become a separate implementation

1. **A separate preview component can silently drift from the real Public renderer.**
   This happened once already in this codebase's own history: Collaborative
   Analysis's Preview initially showed a stale "Nothing has been published yet" state
   because the shell's projection was fetched once at mount and never refreshed when a
   draft was created afterward. The fix was not "build a smarter preview component" —
   it was to refetch the *same* projection the Public renderer already consumes,
   whenever Preview mode is entered, and to feed the *same* public-result slot from the
   draft instead of the published record. The bug was only fully closed because Preview
   reuses the Public rendering path rather than approximating it.
2. **Guaranteed WYSIWYG.** Because Preview literally renders through the same
   component tree, any future fix or feature added to the Public renderer (accessibility
   improvement, new metadata field, layout change) automatically applies to Preview with
   zero additional work and zero risk of the two diverging.
3. **No duplicated public-sidebar logic.** A hand-built "preview sidebar" would need to
   reproduce every rule the real Public Sidebar enforces (participation eligibility,
   reaction state, guest-vs-member differences). Reuse makes that reproduction
   unnecessary and therefore impossible to get wrong.
4. **It is the direct, load-bearing application of Part 2's canonical principle.**
   If Preview were allowed to be a separate implementation "just this once," the
   canonical-renderer rule would cease to be a rule at all — it would be a suggestion
   with one already-known exception, which future stage packs would be entitled to
   extend into more exceptions.

---

## Part 11 — Publication Rules

**Only an explicit Publish action creates public content.** There is no autosave-to-public,
no scheduled auto-publish, no "publish on next Author login" — publication is always
a deliberate, singular Author decision.

Publishing MUST, atomically and in this conceptual order:

1. **Lock the current version.** The version being published becomes immutable the
   instant it is published; a subsequent edit always produces a *new* version, never a
   mutation of a published one.
2. **Create version history.** The previously published version (if any) remains
   permanently retrievable — publication is additive to history, never destructive of
   it.
3. **Record publication metadata.** At minimum: `publishedAt`, `version`,
   `publishedByParticipantId` — the exact fields already present on
   `InitiativeLifecycleStageMetadata`.
4. **Unlock the next Lifecycle stage.** Per Part 14 — this is the mechanism by which
   the Lifecycle actually advances.
5. **Create a Lifecycle notification.** Per Part 12 — exactly one fan-out event, never
   zero, never duplicated.
6. **Update the Public View.** The next visitor to load the stage sees the newly
   published result; there is no propagation delay built into the model (any caching
   layer added later must not introduce staleness that violates this).

### Author confirmation is mandatory

Every publication action requires the Author to explicitly confirm intent before it
executes (a distinct confirmation step from clicking "Publish" once — e.g. a
confirmation dialog, per the existing Save-button-phase interaction pattern already
used elsewhere in the Workspace). This exists specifically to prevent an accidental
click from creating irreversible public civic record — "irreversible" because Part
11.1 makes every published version permanent history, not something a Publish-undo
could quietly erase.

### Idempotency

Publication must be safe to retry (network failure, duplicate click, at-least-once
event delivery). The existing pattern — deterministic event ids keyed by
`(initiativeId, stageId, stageVersion, publicationKind)`, and an outbox
dispatcher that claims `(consumerId, eventId)` exactly once — is the model every
stage's publish operation MUST follow: retrying a publish call that already
succeeded must be a no-op observable-outcome-wise, never a second notification
fan-out, never a second version increment.

---

## Part 12 — Lifecycle Notifications

Every published stage automatically creates **exactly one standard notification per
recipient**, fanned out from a single canonical domain event
(`InitiativeLifecycleStagePublished`).

### Recipients

- **Active Allies** of the Initiative.
- **Never the publishing Author.** The Author is always excluded from the fan-out
  recipient set, regardless of whether they also hold an Active Ally relationship to
  their own Initiative.

### Notification structure

Every Lifecycle notification carries:

- Stage published (which stage)
- Initiative title
- Stage name
- Publication time
- Deep link (directly to the published stage, in the existing public hash-route
  format — never a generic "something changed, go look" link)

### Constraints

- **Informational only.** A Lifecycle notification never contains an action a
  recipient can take that mutates anything (no "approve from this notification," no
  embedded voting control).
- **Never includes AI draft content.** A notification announces that a stage was
  published — it never echoes the draft, the AI's suggestions, or any unpublished
  material. Only the already-public, already-versioned result is referenced (via the
  deep link), never inlined speculative content.
- **One event, one fan-out, no per-stage reinvention.** Because
  `InitiativeLifecycleStagePublished` is stage-agnostic (its payload is
  `{ initiativeId, initiativeTitle, stageId, stageLabel, stageArtifactId,
  stageVersion, actorParticipantId, publicationKind, relatedUrl, occurredAt }`), the
  existing single consumer
  (`handleInitiativeLifecycleStagePublishedNotification`) already handles every
  future stage's notification fan-out without modification — a new stage pack that
  publishes through the canonical event needs to write zero new notification code.
- **Batched identity resolution.** Recipient identity resolution (participant → user
  → profile) happens once per publication event, in one batched call, never once per
  recipient (Part 16 — no N+1).
- **Belongs strictly to the "Notifications" communication category**, never
  "Messages" (Lifecycle UX Correction Pack 01, Part 1) — a stage publication is a
  platform/Initiative event, not person-to-person communication, and must never be
  routed, displayed, or archived as if it were a message.

---

## Part 13 — Reminder Integration

Reminders are a **distinct domain from Notifications** (Lifecycle UX Correction Pack
01, Part 1/7) and MUST remain architecturally independent of them: a Reminder is a
suggested *future action*, a Notification is a record of a *past event*. The same
publication can — and typically does — produce one of each, but they are never the
same record, never share a persistence collection, and a failure to generate a
Reminder must never prevent or delay a Notification (and vice versa).

### How future Reminder generation connects to the Lifecycle

The already-implemented pattern (in
`initiative-lifecycle-stage-notification.consumer.ts`) is the canonical integration
point: on every `InitiativeLifecycleStagePublished` event, after fanning out the
Notification, the same consumer optionally calls the injected `createReminder`
dependency (backed by `createReminderIfNotExists` — idempotent by
`(recipient, category, relatedEntityId)`) to generate a "Continue next Lifecycle
stage" Reminder for each Active Ally, pointing at the next unlocked stage.

This same integration point generalizes to every Reminder source this model
anticipates:

| Reminder source | Trigger | Category (existing `CommunicationReminderCategory`) |
|---|---|---|
| Continue next Lifecycle stage | Any stage publication | Mapped stage category (`analysis`, `proposal`, `revision`, `petition`, `decision`, `collective_decision`, `implementation`, `official_response`, `public_impact`) |
| Review AI suggestions | An Author has an ungenerated/unreviewed AI recommendation sitting idle past some threshold | Same as the current stage's category |
| Upcoming Collaboration Session | A session is scheduled (already implemented — `initiative-collaboration-sessions-reminders.ts`) | `session` |
| Pending Commitment | An Implementation Commitment awaits the Participant's response | `implementation` |
| Tracking overdue | An Implementation Tracking entry passes its expected date without an update | `implementation` |
| Official Response received | An institution's Official Response is published | `official_response` |
| Impact review available | Public Impact is published | `public_impact` |
| Priority Initiative recommendation | A new Initiative matches the Participant's selected Priority Topics | `initiative` |

### Non-negotiable Reminder properties

- **Idempotent.** A Participant with an active Reminder for the same
  `(category, relatedEntityId)` never receives a duplicate — every generation source
  calls the same `createReminderIfNotExists` entry point unconditionally rather than
  tracking its own dedup state.
- **Informational, never spam.** Reminders describe an opportunity or a
  responsibility; they never nag (no re-notification of the same still-pending item),
  and Priority-Topic-matched Initiative reminders in particular are explicitly optional
  and informational — never a growth/engagement dark pattern.
- **Independent lifecycle from Notifications.** Completing/archiving a Reminder never
  reads, mutates, or archives any Notification, and vice versa.
- **Reusable across every future stage** without new plumbing — a new stage pack
  wires its own trigger into the existing `createReminderIfNotExists` seam and, if
  needed, adds one new `CommunicationReminderCategory` union member; it never builds a
  parallel reminder mechanism.

---

## Part 14 — Stage Transition Rules

Every transition from one Lifecycle stage to the next requires, universally and
without exception:

```text
Published current stage
        ↓
Completed publication (Part 11's six-step sequence, fully executed)
        ↓
Version recorded
        ↓
Notification created (Part 12)
        ↓
Previous stage preserved (immutable, permanently retrievable)
        ↓
Next stage unlocked
```

**Stages are never skipped automatically.** There is no code path, configuration
flag, or AI action that advances the Lifecycle past a stage that has not itself been
published. Concretely:

- Unlocking stage *N+1* is a direct, synchronous consequence of stage *N*'s
  publication — never a background job, never a time-based auto-advance, never an AI
  decision.
- A stage that does not support a draft/publish cycle at all
  (`supportsDraft: false`) is unlocked by the *prior* stage's publication exactly the
  same way; it simply has no publication step of its own to gate the *following*
  stage's unlock (its own "completion" criteria are domain-specific and out of scope
  for this document, but they, too, must never be automatic-AI-driven).
- **Previous stages remain immutable** once superseded by the next stage's unlock —
  their published history is permanently preserved and permanently viewable, never
  hidden or rewritten by a later stage's activity.

This rule is what makes the Lifecycle a genuine *lifecycle* rather than a loose
collection of independently-publishable artifacts: it guarantees that anyone examining
an Initiative's civic history sees a strictly ordered, gapless, human-authored
sequence of publications.

---

## Part 15 — Future AI Providers

**The Intelligence Layer MUST be provider-independent.** No part of the platform
architecture may hard-depend on a specific AI vendor.

### The existing precedent this document generalizes

Two independent seams in the current codebase already establish exactly this pattern,
and every future stage's AI integration MUST follow the same shape:

1. **`WorkspaceAssistantProvider`**
   (`apps/api/src/modules/workspace-assistant/assistant-engine/workspace-assistant-provider.ts`) —
   an interface (`generateAssistantResponse`) with a `resolveWorkspaceAssistantProvider()`
   factory that switches on an environment variable
   (`WORKSPACE_ASSISTANT_PROVIDER=mock|ai_assisted`) between a deterministic
   `MockWorkspaceAssistantProvider` and a real `AiWorkspaceAssistantProvider`. No
   caller ever imports a concrete provider directly.
2. **`AnalysisDraftProvider`**
   (`apps/api/src/modules/initiative-collaborative-analysis/initiative-analysis-draft-builder.ts`) —
   the same shape, scoped to Collaborative Analysis's draft generation: an interface
   (`generateDraft`), a `deterministicAnalysisDraftProvider` implementation (today's
   only implementation, explicitly documented as a placeholder for a future
   Gemini-backed one), and a `resolveAnalysisDraftProvider()` resolution point that
   every caller (`generateAnalysisDraft`) depends on — never on the concrete
   implementation.

### The universal rule this generalizes into

Every stage's AI-touching functionality (draft generation, section regeneration,
wording improvement, contradiction/gap detection, summarization) MUST be expressed
behind a `{Stage}{Capability}Provider`-shaped interface with:

- exactly one resolution function (`resolve{...}Provider()`),
- exactly one environment-driven (or equivalent config-driven) switch between
  implementations,
- zero call sites that import a concrete provider class/function directly.

Possible future providers include OpenAI, Gemini, Claude, a locally-hosted LLM, or
further internal deterministic models — the architecture must be indifferent to which
one is behind the seam at any given time, and must support more than one being active
simultaneously for different stages if that is ever desired (e.g. Collaborative
Analysis on one provider, Petition wording assistance on another) without any
cross-stage coupling.

### What this buys the platform

- **Vendor risk isolation.** A pricing change, an outage, or a policy change from one
  AI vendor never requires a rewrite — only a new provider implementation behind an
  already-existing seam.
- **Deterministic-by-default is always available.** Every provider interface's first,
  reference implementation is deterministic and non-AI (as Collaborative Analysis's
  is today) — this is not merely a bootstrapping convenience, it is a permanent
  fallback path that guarantees the platform never becomes *unable to function*
  without a live AI vendor connection.
- **Testability.** Every AI-touching feature can be fully unit-tested against a
  deterministic provider without network access, mocking, or nondeterminism —
  exactly as Collaborative Analysis's draft builder tests already do.

---

## Part 16 — Engineering Principles & Compatibility

This model is confirmed compatible with, and builds directly on, every
previously-shipped Lifecycle-adjacent capability:

| Prior capability | Compatibility confirmation |
|---|---|
| **Lifecycle Stage Workspace Foundation** (Part A) | This document's Part 2/3/5 are direct elaborations of Part A's `InitiativeLifecycleStageProjection`, `InitiativeLifecycleStageMetadata`, `InitiativeLifecycleAiCapabilities`, and `InitiativeLifecycleAuthorAction` contracts — no new type is required to state this model; it is already representable by them. |
| **Automated Collaborative Analysis** (Part B) | Serves as this model's reference implementation throughout (source snapshot builder, deterministic draft provider, publish flow, notification copy, reaction model). Every future stage pack should be built by analogy to it. |
| **Author Workspace / Public Preview / Public Viewer** | Part 2, 8, 9, 10 of this document are the formalization of exactly the three modes already implemented and browser-verified in Part A/B. |
| **Notification Center** (Lifecycle UX Correction Pack 01) | Part 12 of this document is consistent with, and reuses without modification, the existing `handleInitiativeLifecycleStagePublishedNotification` consumer, the Notifications-vs-Messages-vs-Reminders routing rules, and the Archive model. |
| **Reminder Architecture** (Lifecycle UX Correction Pack 01) | Part 13 of this document is consistent with, and reuses without modification, the existing `createReminderIfNotExists` idempotent seam and `CommunicationReminderCategory` vocabulary. |
| **Communication System** (Direct Messaging, Collaboration Channel, Group Chat) | Untouched by this model. Part 12 explicitly reaffirms that Lifecycle Notifications never route into, or get confused with, the Messages category. |
| **Shared Documents** | Referenced only as a potential Intelligence Source (Part 7 — "Attachments / Shared Documents") and otherwise untouched; this document defines no persistence or schema change to Shared Documents. |
| **Initiative Collaboration** (Active Allies, Ready to Collaborate) | Referenced as both an Intelligence Source (Part 7) and a Notification/Reminder recipient set (Part 12/13); untouched otherwise. |

### Binding engineering principles for every future stage pack

- **No duplicated renderers.** Every stage pack supplies content into
  `InitiativeLifecycleStageWorkspace`'s existing slots; none may introduce a second
  top-level stage component.
- **No duplicated AI logic.** Every stage pack's AI-touching code is expressed via a
  Part 15-shaped provider seam; none may hard-code a vendor call inline in a route
  handler or service function.
- **No duplicated stage implementations.** "Author view" and "Public view" are never
  separately coded per stage (Part 2); "Preview" is never separately coded from
  "Public" (Part 10).
- **No N+1 queries.** Source Snapshot construction, recipient identity resolution, and
  proposal/comment lookups MUST be batched — one query (or one batched query set) per
  publication/projection request, never one query per item in a loop. This mirrors the
  existing `resolveRecipientIdentitiesViaAuthAndProfile` and
  `initiative-active-allies.service.ts` batching pattern.
- **One projection per request.** A single `InitiativeLifecycleStageProjection` fetch
  loads the Initiative once, resolves the viewer's role once, and loads only the
  selected stage's own domain data — never all twelve stages' data for one stage's
  page load.
- **Accessibility is not optional.** Every Author action must be keyboard-operable,
  every mode indicator (Preview, Draft, Published) must carry a text/ARIA label and
  must never rely on color alone, and every interactive AI Assistant control must have
  a visible focus state.

---

## Part 17 — Deliverables

This document itself is the deliverable, and satisfies the required contents:

- **Architecture overview** — Part 1, Part 2.
- **Stage Intelligence Model** — Part 3, Part 5.
- **AI Assistant responsibilities** — Part 4, Part 6.
- **Universal Stage Contract** — Part 3, Part 5.
- **Author/Public/Preview model** — Part 2, Part 8, Part 9, Part 10.
- **Notification model** — Part 12.
- **Reminder integration** — Part 13.
- **Publication model** — Part 11.
- **Stage transition model** — Part 14.
- **Future AI provider abstraction** — Part 15.
- **Engineering principles** — Part 16.
- **Compatibility notes** — Part 16.
- **Architecture diagrams** — the Lifecycle ordering diagram (Part 1), the Universal
  Stage Model workflow diagram (Part 3), and the Stage Transition sequence diagram
  (Part 14).

File location (created by this task, no other file modified):

```text
architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md
```

---

## Part 18 — Validation & Final Architecture Review

### Validation checklist

| Requirement | Status | Basis |
|---|---|---|
| Aligns with all previously approved Lifecycle Architecture | ✅ | Part 16 compatibility table; every rule in this document is either a direct restatement or a strict, additive generalization of Part A/B and Correction Pack 01 behavior already shipped and regression-tested. |
| Does not contradict the canonical Initiative Lifecycle | ✅ | Part 1 reproduces `INITIATIVE_LIFECYCLE_STAGE_REGISTRY`'s exact 12-stage ordering verbatim; no reordering, renaming, insertion, or removal is proposed. |
| Preserves the single Stage Workspace architecture | ✅ | Part 2 states the canonical-renderer rule as binding; Part 8/9/10 describe only Presentation Mode branching within it, never a second component tree. |
| Preserves Presentation Mode separation | ✅ | Part 2's table ties each of the three modes to its exact existing derivation (`presentationMode` server value + `isPreviewMode` client flag); no fourth mode or ambiguous overlap is introduced. |
| Preserves Author responsibility | ✅ | Part 4 ("The Author is always responsible for publication"), Part 11 ("Only an explicit Publish action creates public content," mandatory confirmation). |
| Keeps AI advisory only | ✅ | Part 4's exhaustive "AI Assistant NEVER / ONLY" lists; Part 5's contract is entirely read-only until an explicit Author accept; Part 6's stage responsibilities are all analysis/suggestion verbs, never decision verbs. |
| Keeps Notification and Reminder systems independent | ✅ | Part 13, first paragraph, states independence as a MUST; Part 12/13 tables show they are triggered from the same event but persist, route, and archive independently, matching Lifecycle UX Correction Pack 01's already-shipped separation. |
| Supports future AI providers without architectural changes | ✅ | Part 15 generalizes the two already-implemented provider seams (`WorkspaceAssistantProvider`, `AnalysisDraftProvider`) into a universal rule; adding a new vendor requires a new provider implementation behind an existing seam, never a change to this document's model. |
| No production code modified | ✅ | This task created exactly one new file (this document) under `architecture/lifecycle/`. No source file, schema, route, or component was touched. |
| No files staged, no commits created | ✅ | Confirmed via `git status`/`git diff --cached` at completion — see below. |

### Final architecture review

This model does not introduce new mechanisms so much as it **names and locks in**
mechanisms that Part A, Part B, and Lifecycle UX Correction Pack 01 already built and
proved out under one real, non-trivial stage (Collaborative Analysis) and one real
cross-cutting communication overhaul. Every rule in this document is traceable to an
existing type, an existing function, or an existing passing test in the codebase — this
is a codification of demonstrated architecture, not a speculative one.

The three properties that matter most for everything that follows are now explicit
and permanent:

1. **One renderer, three Presentation Modes, forever** (Part 2) — the single
   structural guarantee that prevents the next ten stage packs from each inventing
   their own Author/Preview/Public split.
2. **AI is advisory, Author publishes, forever** (Part 4) — the single authority
   guarantee that makes it safe to let AI assistance expand into every remaining
   stage, including the most consequential ones (Decision Session, Collective
   Decision, Official Responses).
3. **Provider-independence, forever** (Part 15) — the single technical guarantee that
   the platform's growing AI surface area never becomes a single-vendor liability.

**Readiness confirmation:** the remaining Lifecycle stages — Improvement Proposals,
Revision, Petition, Decision Session, Collective Decision, Implementation
Commitments, Implementation Tracking, Official Responses, Public Impact, and Civic
Archive — may proceed to implementation. Each stage pack's job, per this model, is
narrow and well-defined: build that stage's Source Snapshot builder, its deterministic
(or later, AI-backed) draft/analysis provider, its stage-specific AI Assistant content
satisfying the Part 5 contract, and its publish wiring through the existing canonical
event/notification/reminder seam — while supplying all of it into the existing
`InitiativeLifecycleStageWorkspace` slots and never building a parallel renderer,
sidebar, or publish path.

No production code, schema, route, or component was modified in the creation of this
document. Nothing was staged. Nothing was committed.
