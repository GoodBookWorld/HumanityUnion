# ADR-025 — Transparent Participation Instead of Weighted Voting

## Architecture Decision Record

| Attribute  | Value                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| ID         | ADR-025                                                                                 |
| Title      | Transparent Participation Instead of Weighted Voting                                    |
| Status     | Accepted                                                                                |
| Date       | 2026-06-27                                                                              |
| Capability | 02 — Participation                                                                      |
| Task       | TASK-025                                                                                |
| Deciders   | Humanity Union Architecture                                                             |
| Related    | COLLECTIVE_DECISION_ARCHITECTURE.md, Humanity Union Constitution Article I, Article VII |

---

# Context

Humanity Union enters the **Collective Decision** stage after Decision Session preparation. At this stage, registered participants express Support, Do Not Support, or Abstain on a publicly framed decision question.

Platform designers must choose how to:

1. determine who may vote;
2. count votes;
3. display results to society;
4. handle differences in participant verification status.

Common approaches in civic and corporate systems include:

- **Weighted voting** — votes count differently based on stake, reputation, verification, tenure, or delegation;
- **Opaque aggregation** — society sees a single number without cohort breakdown;
- **Network-derived eligibility** — IP or VPN inference determines who may participate.

Humanity Union's Constitution establishes human dignity, transparency, and freedom with understanding. Capability 02 has already frozen **one steward-reviewed improvement path**, **advisory civic compatibility review**, and **Decision Session preparation without vote collection**.

Collective Decision is the first stage where participant choices become part of the public record.

---

# Decision

Humanity Union adopts **transparent, unweighted participation** for Collective Decision.

## 1. One participant, one vote

Each eligible registered participant casts exactly one vote with fixed value. Choices are Support, Do Not Support, or Abstain.

## 2. Unweighted outcome calculation

The public outcome is determined by simple aggregation of unweighted vote counts. No vote is multiplied by verification level, reputation, tenure, or delegation.

## 3. Transparent verified / unverified display

Results display:

- total votes;
- verified participant votes (counts and choice breakdown);
- unverified participant votes (counts and choice breakdown);
- participation rate;
- participation confidence (informational only).

Verified and unverified cohorts are visible separately. They are **not** used to recalculate or override the primary outcome.

## 4. Participation Area eligibility

Eligibility depends on the participant's declared Participation Area (Country → Region → Community), aligned to the decision's Participation Scope.

IP address, VPN, and inferred geolocation do not affect eligibility.

## 5. Decision Session gateway

No initiative enters Collective Decision without a closed Decision Session. Preparation and decision are separate constitutional stages.

---

# Rationale

## Why not weighted voting?

Weighted voting introduces hidden power asymmetry. Even when weights reflect seemingly neutral factors (verification, reputation, contribution history), the public cannot easily audit **why** one person's choice counts more than another's.

Humanity Union's constitutional commitment to equal dignity (Article I) and transparency (Article VII) requires that civic outcomes be auditable by any participant.

Weighted systems also create attack surfaces:

- reputation gaming to amplify vote weight;
- institutional capture through weighted delegations;
- perceived illegitimacy when unverified majority and verified minority diverge.

Separating **transparency** (show verified vs unverified) from **weighting** (count some votes more) preserves informational richness without compromising equal vote value.

## Why display verified and unverified separately?

Verification status signals participant identity assurance. Society benefits from knowing whether outcomes reflect verified members, broader membership, or both.

Displaying cohorts separately supports informed public judgment **without** changing the outcome formula. Participants can assess participation confidence themselves.

## Why Participation Area instead of IP?

IP-based eligibility punishes privacy tools, mobile networks, and cross-border participants. It ties civic rights to infrastructure rather than declared civic affiliation.

Participation Area respects participant agency: members choose their civic context during registration or profile management. Delayed activation on area changes prevents abuse while preserving mobility.

## Why mandatory Decision Session?

Collective Decision without preparation risks uninformed majoritarianism. Decision Session packages revisions, analyses, and steward-reviewed proposals before the question is put to participants.

Separating preparation from decision preserves the constitutional sequence: evidence and improvement before decision.

---

# Consequences

## Positive

- Outcomes are auditable and reproducible from public counts;
- Equal vote dignity is structurally enforced;
- Verified/unverified transparency builds trust without manipulation;
- Participation Area model aligns with global/community/regional initiative scopes;
- Decision Session gateway protects informed decision-making;
- Reopening architecture preserves historical integrity.

## Negative / Trade-offs

- A large unverified cohort may create participation confidence concerns without changing outcomes — society must interpret confidence, not the platform;
- Participation Area self-declaration requires future anti-abuse policy (delayed transitions, not IP blocking);
- Simple plurality may not capture ranked preferences — deferred to future mechanisms that still must not introduce weighting;
- Legacy Community Poll (Approve/Reject, ballot model) diverges from this architecture and requires eventual migration.

## Neutral

- Abstain handling policy (whether abstain affects quorum) remains governance-defined at implementation;
- Participation confidence formula is policy-defined but constrained to informational use only.

---

# Compliance

This ADR satisfies TASK-025 constitutional principles:

| Principle                                          | ADR alignment                    |
| -------------------------------------------------- | -------------------------------- |
| Every registered participant may participate       | Eligibility rules + registration |
| One participant = one vote                         | Fixed value, no weights          |
| Transparent results with verified/unverified split | Transparency model               |
| Outcome never recalculated with weights            | Invariant CD-006                 |
| Participation Area eligibility                     | No IP/VPN                        |
| Area change with delayed activation                | Architecture reserved            |
| Global initiatives unrestricted                    | `world` scope                    |
| Decision Session mandatory                         | Invariant CD-001                 |
| Revisitable decisions                              | Reopening model                  |
| No AI outcomes                                     | Deterministic aggregation        |
| No reputation outcomes                             | Explicit prohibition             |

---

# Alternatives Considered

## Alternative A — Weighted verification voting

Verified votes count double. **Rejected.** Violates equal dignity and creates unauditable asymmetry.

## Alternative B — Verified-only outcomes with unverified display

Primary outcome from verified votes only; unverified shown separately. **Rejected.** Effectively weighted by verification; disenfranchises unverified registered members.

## Alternative C — IP-based geographic eligibility

**Rejected.** Conflicts with VPN neutrality and participant agency.

## Alternative D — AI-assisted outcome recommendation

Platform suggests outcome based on vote patterns and initiative analysis. **Rejected.** Violates human responsibility and constitutional non-manipulation.

## Alternative E — Skip Decision Session for urgent decisions

**Rejected.** Breaks preparation-before-decision sequence.

---

# Status

**Accepted** — Architecture baseline for Collective Decision implementation.

Implementation requires separate epic authorization. No code changes authorized by this ADR.
