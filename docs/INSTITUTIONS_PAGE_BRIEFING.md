# Institutions Page Briefing

**Task:** TASK-069  
**Status:** Briefing only — no code, UI, API, or domain models  
**Route (future):** `/institutions`  
**Last updated:** 2026-07-08

---

## 1. Executive Summary

The Institutions page is Humanity Union’s public-facing explanation of its **proposed constitutional institutional architecture** — the bodies designed to organize civic participation, expert analysis, deliberation, coordination, protection, and implementation into a coherent whole. It answers a different question from Knowledge Center articles: not “What are institutions in general?” but “How is Humanity Union itself designed to govern and coordinate action over time?”

Humanity Union today implements a mature **initiative-centric civic pipeline** in software — from initiative creation through collaborative analysis, collective decision, civic action, delivery, official response, accountability, implementation, public impact, and civic archive. The Institutions page does not claim that the full constitutional bodies described here already exist as operational government. It presents them as a **future institutional model** that the platform is designed to grow toward, with clear separation between vision and current implementation status.

The page serves citizens, researchers, journalists, public officials, NGOs, partner organizations, and future delegates who need a calm, readable map of how proposed Humanity Union bodies relate to one another and to civic participation on the platform. It uses institutional language — precise, restrained, and explanatory — and avoids militaristic presentation, propaganda tone, or language that implies legal command over sovereign states.

This briefing is the official product and architecture reference for future implementation work. Engineering tasks TASK-070 (page foundation), TASK-071 (visual diagrams), and TASK-072 (governance detail pages, if needed) will build from this document. No engineering work begins until those tasks are explicitly approved.

---

## 2. Page Purpose

The Institutions page should achieve the following:

| Goal                                | Description                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Explain future architecture**     | Present Humanity Union’s proposed constitutional bodies — council, chambers, secretariat, protection functions, regional presence — as a coherent system, not as a list of slogans. |
| **Connect participation to action** | Show how civic activity on the platform (initiatives, analysis, decisions, commitments) is designed to flow toward organized institutional response and public record.              |
| **Clarify roles and boundaries**    | Distinguish deliberation from analysis, coordination from command, protection from enforcement over countries, and internal structure from external recipient outreach.             |
| **Separate vision from status**     | Make explicit what exists in software today, what is constitutional vision only, and what requires future charter, governance, and operational design.                              |
| **Support informed trust**          | Give journalists, officials, and researchers enough structure to evaluate claims responsibly without overstating current authority.                                                 |

The page should **not** function as a registry of third-party institutions, a recruitment portal, a policy manifesto, or a substitute for Knowledge Center educational articles about institutions in society.

---

## 3. Audience

| Audience                                            | Primary need                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Citizens**                                        | Understand where their participation fits in a long-term civic architecture and what Humanity Union is — and is not — proposing. |
| **NGOs and partner organizations**                  | See coordination pathways without assuming binding authority over their operations.                                              |
| **Researchers**                                     | Reference a stable institutional map and terminology aligned with the Project Dictionary.                                        |
| **Journalists**                                     | Verify what is proposed versus implemented; avoid misquoting scope or authority.                                                 |
| **Public officials**                                | Understand collaboration and representation concepts without implied subordination of states.                                    |
| **Future delegates and institutional participants** | Learn chamber roles, secretariat functions, and expected pathways before formal selection processes exist.                       |

All audiences share a need for **plain structure first, detail second** — a navigable map before long-form governance prose.

---

## 4. Legal and Constitutional Caution

The Institutions page operates in a sensitive domain. Copy must follow these rules consistently across hero text, cards, diagrams, metadata, and assistant cross-links.

### Required framing

Use language that preserves honesty about status and limits:

- **“proposed”** — institutions are constitutional architecture under design, not established global government.
- **“designed to”** — describes intent and function without asserting present capability.
- **“intended to”** — clarifies purpose without guaranteeing outcome.
- **“future institutional model”** — anchors the page in long-range governance vision.
- **“subject to charter and governance rules”** — reminds readers that authority derives from defined processes, not implied power.
- **“coordination and collaboration”** — preferred over command vocabulary when describing state-facing bodies.

Every institution card must include an explicit **current status** field (e.g., _Vision only_, _Partially reflected in platform pipeline_, _Not yet operational_).

### Prohibited or discouraged language

Do **not** use phrasing that implies supranational command, military dominance, or existing governmental authority:

| Avoid                                              | Prefer instead                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| “commands states”                                  | “designed to coordinate with state representatives”                         |
| “controls governments”                             | “intended to support collaborative governance processes”                    |
| “global authority”                                 | “proposed deliberative architecture”                                        |
| “military force”                                   | “protection and safety coordination” (when protection bodies are discussed) |
| “enforcement over countries”                       | “implementation support within agreed frameworks”                           |
| “supreme power over nations”                       | “supreme deliberative assembly within Humanity Union’s charter”             |
| “world government” (as a claim of existing status) | “proposed institutional model for global civic coordination”                |

Protection-related institutions must be described in terms of **safeguarding participants, integrity, and agreed protective measures** — not occupation, coercion, or unilateral intervention. Community Self-Defense Units, where mentioned, refer to **community-level protective coordination within platform rules**, not paramilitary formations.

### Editorial standard

- No propaganda style, heroic militarism, or urgency manipulation.
- No exaggerated claims about reach, enforcement, or inevitability.
- No presentation of vision as accomplished fact.
- Legal and constitutional questions beyond product scope should defer to Knowledge → Constitution and future charter documents.

---

## 5. Institution Map

High-level flow from civic participation to public record. This is the canonical diagram narrative for TASK-071.

```
People / Participants
        ↓
Initiatives / Analysis / Proposals
        ↓
Chamber of Intellectual Analysis  (+ General Staff advisory coordination)
        ↓
Humanity Council
   ├── Chamber of State Representatives
   └── Chamber of Intellectual Analysis (deliberative seat)
        ↓
Secretariat
        ↓
Humanity Protection / Implementation bodies
   ├── Humanity Protection (policy & oversight domain)
   ├── World Protection Corps (operational coordination, bounded mandate)
   └── Community Self-Defense Units (community-scoped protective coordination)
        ↓
Public Impact / Civic Archive
```

### Reading the map

| Layer                                  | Role                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **People / Participants**              | Verified members, communities, stewards, and future delegates who initiate and sustain civic work.        |
| **Initiatives / Analysis / Proposals** | Platform pipeline activity — the operational entry point today.                                           |
| **Chamber of Intellectual Analysis**   | Expert review, strategic assessment, and analytical input to deliberation.                                |
| **Humanity Council**                   | Proposed supreme deliberative assembly; major direction and binding decisions within charter limits.      |
| **Secretariat**                        | Administrative continuity, record-keeping, scheduling, and implementation support — not policy supremacy. |
| **Protection & implementation**        | Safety, protective coordination, and structured follow-through — bounded and overseen.                    |
| **Public Impact / Archive**            | Transparent public record of outcomes and civic learning.                                                 |

Regional Humanity Union offices sit **alongside** this vertical flow as the **geographic presence layer** — connecting global architecture to country, region, and community context (CRZ alignment).

---

## 6. Institution Cards

Each card on the future page includes: **name**, **short purpose**, **role in system**, **current status**, **future development**, and **related civic pipeline stages**.

### Humanity Council

| Field                       | Content                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed supreme deliberative and decision-making assembly of Humanity Union.                                          |
| **Role in system**          | Integrates chamber input, adopts major governance direction, and authorizes institutional action within charter rules. |
| **Current status**          | Vision only — referenced in platform dictionary and About-adjacent content; not an operational assembly in v1.         |
| **Future development**      | Charter definition, chamber composition rules, session mechanics, public decision record, delegate eligibility.        |
| **Related pipeline stages** | Collective Decision → Civic Action Package → Official Response → Public Impact                                         |

### Chamber of State Representatives

| Field                       | Content                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed chamber for representatives linked to states and officially recognized regional authorities.            |
| **Role in system**          | Brings state-level and geopolitical context into council deliberation; focuses on collaboration, not command.    |
| **Current status**          | Vision only.                                                                                                     |
| **Future development**      | Representation criteria, accreditation workflow, collaboration protocols with Department of State Collaboration. |
| **Related pipeline stages** | Collective Decision, Civic Action Package (external recipient context), Official Response                        |

### Chamber of Intellectual Analysis

| Field                       | Content                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed chamber for expert analysis, evaluation, and strategic assessment.                                                            |
| **Role in system**          | Supplies analytical input to council decisions; does not replace democratic voting or steward-led initiative work.                     |
| **Current status**          | Partially reflected — Collaborative Analysis and initiative analyses exist in software; constitutional chamber does not.               |
| **Future development**      | Formal expert intake, report standards, linkage to Department of Intellectual Analysis, public analytical summaries where appropriate. |
| **Related pipeline stages** | Collaborative Analysis → Improvement Proposal → Collective Decision                                                                    |

### General Staff

| Field                       | Content                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed coordinated advisory and operational planning support to the Chamber of Intellectual Analysis and council processes. |
| **Role in system**          | Organizes analytical workflows, prepares briefings, and supports implementation planning — advisory, not autonomous command.  |
| **Current status**          | Vision only (dictionary combines with chamber name; page may present as linked but distinct function).                        |
| **Future development**      | Staffing model, separation from elected deliberation, transparency of advisory memos.                                         |
| **Related pipeline stages** | Collaborative Analysis, Implementation Commitment, Implementation                                                             |

### Secretariat

| Field                       | Content                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed permanent administrative body for continuity, records, and coordinated execution support.                |
| **Role in system**          | Translates council outcomes into scheduled action, maintains institutional memory, supports cross-body logistics. |
| **Current status**          | Vision only.                                                                                                      |
| **Future development**      | Publication of agendas and minutes, handoff protocols to implementation bodies, archive integration.              |
| **Related pipeline stages** | Civic Action Package → Civic Delivery → Implementation → Public Civic Archive                                     |

### Humanity Protection

| Field                       | Content                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed policy and oversight domain for safeguarding users, institutions, data, and public integrity.              |
| **Role in system**          | Defines protective standards, oversees safety governance, connects to trust and moderation architecture.            |
| **Current status**          | Partially reflected — platform moderation, verification, ACTUC-adjacent trust mechanics; not a constitutional body. |
| **Future development**      | Charter-mandated protection policy, appeal pathways, transparency records, alignment with Trust Domain.             |
| **Related pipeline stages** | Trust & verification (cross-cutting); Civic Accountability                                                          |

### World Protection Corps

| Field                       | Content                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed operational coordination body for serious protective responses within defined authority limits.       |
| **Role in system**          | Supports platform-wide safety actions under oversight — not unilateral enforcement over countries.             |
| **Current status**          | Vision only.                                                                                                   |
| **Future development**      | Mandate boundaries, oversight mechanisms, public reporting, explicit non-militaristic presentation guidelines. |
| **Related pipeline stages** | Civic Accountability, Public Impact (protective outcome reporting where applicable)                            |

### Community Self-Defense Units

| Field                       | Content                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Short purpose**           | Proposed community-scoped protective coordination within platform and charter rules.                                           |
| **Role in system**          | Links local community context to protective standards — emphasis on safety, de-escalation, and verified community stewardship. |
| **Current status**          | Vision only — not present in Project Dictionary; introduced here as proposed community-layer institution.                      |
| **Future development**      | Community charter alignment, training and eligibility standards, strict separation from militaristic framing.                  |
| **Related pipeline stages** | Community Experience participation; Implementation at community scope                                                          |

### Regional Humanity Union Offices

| Field                       | Content                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Short purpose**           | Proposed geographic presence connecting global institutional architecture to country, region, and community activity.                    |
| **Role in system**          | Localizes coordination, supports CRZ-aligned participation, and connects regional statistics and initiatives to institutional workflows. |
| **Current status**          | Partially reflected — Country, Region, and Community Experience pages exist; dedicated regional offices do not.                          |
| **Future development**      | Office directory model, regional delegate liaison, alignment with Regional Domain entities.                                              |
| **Related pipeline stages** | All public pipeline widgets at geographic scope; Registration Gateway → Workspace                                                        |

---

## 7. Suggested Page Structure

Proposed section order for `/institutions`:

| #   | Section                           | Content                                                                                                                                 |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hero**                          | Page title, one-paragraph purpose, status disclaimer (“proposed future institutional model”), primary CTA to institutional map.         |
| 2   | **Institutional Map**             | Interactive or static diagram (TASK-071) showing flow from participants to archive.                                                     |
| 3   | **Humanity Council**              | Council role, relationship to chambers, decision scope within charter.                                                                  |
| 4   | **Two Chambers**                  | Side-by-side or tabbed cards: State Representatives and Intellectual Analysis.                                                          |
| 5   | **Secretariat**                   | Administrative function, non-supremacy clarification, record-keeping role.                                                              |
| 6   | **Protection and Implementation** | Humanity Protection, World Protection Corps, Community Self-Defense Units — calm, bounded language.                                     |
| 7   | **Regional Presence**             | Regional Humanity Union offices and link to geographic experience pages.                                                                |
| 8   | **How Citizens Connect**          | Path from registration → initiative → analysis → decision → public record; link to Workspace and pipeline explainer.                    |
| 9   | **Current Status**                | Honest matrix: what exists in software vs. constitutional vision only.                                                                  |
| 10  | **Future Roadmap**                | High-level phases tied to TASK-070–072; no dates unless charter-approved.                                                               |
| 11  | **Learn More**                    | Cross-links to Knowledge (Constitution, Explanations, Glossary), Civic Media (context only), About, and relevant pipeline public pages. |

### Navigation placement

Institutions belongs in the **public Information Space**, alongside Home, Knowledge, Search, and geographic experiences. It is **not** a Knowledge subsection — it is a first-class civic architecture page with its own route and information design.

---

## 8. Visual Direction

| Principle                     | Guidance                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Calm institutional design** | Neutral typography, generous whitespace, Humanity Design System tokens — consistent with Knowledge and public experience pages.         |
| **Diagrams**                  | Flow and hierarchy diagrams (SVG or accessible HTML); muted palette; clear labels; no aggressive iconography.                           |
| **Cards**                     | One institution per card: name, purpose, status badge (_Vision_, _Partial_, _Platform today_), expandable detail.                       |
| **No aggressive symbols**     | Avoid shields, swords, eagles, camouflage, rank insignia, or militaristic metaphors.                                                    |
| **No flags as decoration**    | Geographic context may use neutral labels; do not use flag imagery for institutional authority signaling.                               |
| **No military aesthetic**     | Protection bodies use civic-safety language and institutional blues/grays — not tactical UI patterns.                                   |
| **Status honesty**            | Visual distinction between implemented platform capabilities and proposed constitutional bodies (e.g., dashed borders for vision-only). |
| **Accessibility**             | Skip link, semantic landmarks, keyboard-navigable diagram, sufficient contrast, screen-reader-friendly card structure.                  |

---

## 9. Relationship to Knowledge Center

| Dimension                   | Knowledge Center                                                                                                                                  | Institutions Page                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Question answered**       | “What is this concept?” / “How does civic process work?”                                                                                          | “What institutional architecture is Humanity Union proposing for itself?” |
| **Content type**            | Educational articles, guides, glossary, constitution principles                                                                                   | Institutional map, body cards, status matrix, roadmap                     |
| **Tone**                    | Neutral explanation; politically neutral articles                                                                                                 | Institutional briefing; proposed architecture                             |
| **Institutions in society** | Knowledge → Explanations, Civic Media — includes educational material about existing external institutions                                        | Out of scope — do not duplicate                                           |
| **Cross-link rule**         | Knowledge links **to** Institutions for “Humanity Union’s proposed bodies”; Institutions links **to** Knowledge for definitions and process depth |

Knowledge **explains**. The Institutions page **presents Humanity Union’s future institutional structure** as a coherent public reference.

---

## 10. Relationship to Civic Action Package

The **Civic Action Package (CAP)** is the operational bridge from a closed collective decision to **external institutional recipients** — delivery, official response, and accountability in the Capability 02 pipeline.

| Concept                  | Scope                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Civic Action Package** | Action artifact directed outward: recommended recipients, delivery record, official response, accountability follow-up.                     |
| **Institutions Page**    | Inward constitutional map: how Humanity Union’s **own** proposed bodies are designed to organize deliberation and implementation over time. |

The Institutions page must **not** become a recipient CRM, contact directory, or CAP management surface. Where helpful, a single clarifying sentence may note that CAP addresses **external** action while the Institutions page addresses **internal** proposed structure — with a link to public CAP pages and Knowledge pipeline articles.

---

## 11. Implementation Plan

Future engineering is split into explicit tasks. **No work begins until each task is approved.**

### TASK-070 — Institutions Page Foundation

- Public route `/institutions` with Humanity Layout shell
- Static content module (pattern aligned with Knowledge Center v1 — no CMS)
- Hero, status disclaimer, institution cards, current-status matrix, Learn More links
- Search indexing as distinct entity type (e.g., `institutions_page` or section anchors)
- Verification script `verify:institutions`
- Update SITE_MAP: replace legacy “registered institutions directory” definition with this briefing’s purpose

### TASK-071 — Institutions Visual Diagrams

- Accessible institutional map diagram (SVG)
- Optional chamber hierarchy inset
- Responsive layout; reduced-motion fallback
- Design system compliance (`verify:design-system`)

### TASK-072 — Institutions Governance Detail Pages (if needed)

- Optional sub-routes e.g. `/institutions/humanity-council`, `/institutions/chambers/...`
- Only if card expand is insufficient for editorial depth
- Each detail page repeats status disclaimer and legal caution footer
- Defer until TASK-070 content volume proves necessity

### Explicit exclusions (all tasks)

- No domain aggregates for constitutional bodies in v1
- No API for institutional governance operations
- No delegate registration or election mechanics
- No merger with admin Institution Management (`/admin/institutions` — platform account registry remains separate)

---

## 12. Acceptance Criteria for Briefing

| Criterion                                                              | Status |
| ---------------------------------------------------------------------- | ------ |
| Briefing document created at `docs/INSTITUTIONS_PAGE_BRIEFING.md`      | ✓      |
| No code changes in this task                                           | ✓      |
| No legal overclaiming — caution section and card status fields defined | ✓      |
| Clear institution structure and map                                    | ✓      |
| Distinction from Knowledge Center institutional explanations           | ✓      |
| Distinction from Civic Action Package external action bridge           | ✓      |
| Future implementation plan (TASK-070–072) included                     | ✓      |
| All nine institution concepts covered                                  | ✓      |

---

## Key Decisions (Engineering Summary)

1. **Purpose redefinition:** `/institutions` presents Humanity Union’s **proposed constitutional architecture**, not a directory of registered third-party institutions (SITE_MAP legacy definition superseded by this briefing).
2. **Vision vs. implementation:** Every institution card carries explicit **current status**; software pipeline features are cited only where they partially reflect vision (e.g., Collaborative Analysis, geographic experiences).
3. **Legal language:** Mandatory “proposed / designed to / intended to” framing; prohibited command-and-control vocabulary documented in Section 4.
4. **Institution structure:** Vertical map from participants through analysis, council, secretariat, protection/implementation, to public impact and archive; regional offices as geographic layer.
5. **Knowledge boundary:** Knowledge explains concepts and external institutions; Institutions page presents HU’s own future bodies.
6. **CAP boundary:** CAP = external action bridge; Institutions page = internal proposed structure — no CRM overlap.
7. **Visual restraint:** Calm civic-institutional design; no militaristic or propagandistic presentation.
8. **Implementation sequence:** TASK-070 (foundation) → TASK-071 (diagrams) → TASK-072 (optional detail pages).

**Final status:** Briefing complete — ready for TASK-070 approval.
