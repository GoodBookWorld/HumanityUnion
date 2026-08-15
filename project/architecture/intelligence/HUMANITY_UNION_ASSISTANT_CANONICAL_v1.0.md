# Humanity Union Assistant — Canonical Architecture

Version: 1.0  
Status: Active (Production Hardening Pack 01–02)  
Product name: **Humanity Union Assistant**

---

## Canonical pipeline

```
Humanity Union Assistant (one modal)
  → Platform Assistant Service (/api/v1/assistant)
  → Safety Layer (assertAiPromptSafe)
  → Context Builder + bounded Platform Knowledge retrieval
  → LifecycleAiProvider
  → GeminiLifecycleAiProvider | DeterministicLifecycleAiProvider
```

There is **one** Assistant product. Context specializes by surface / Lifecycle stage.
There is **one** provider abstraction (`LifecycleAiProvider`).
There is **no** silent Gemini → deterministic fallback.

---

## Runtime entry points (all open the same modal)

| Surface | Launcher |
|--------|----------|
| All pages | FAB (`HumanityUnionAssistantFloatingButton`) via `HumanityLayout` shell |
| Workspace Home | `HumanityUnionAssistantWidget` |
| Workspace Initiatives | `HumanityUnionAssistantWidget` |
| Lifecycle stages | `HumanityUnionAssistantOpenButton` in working sidebar |
| Preferences | `SurfaceAssistantEntry` |
| Notifications | `SurfaceAssistantEntry` |
| Participant Profile | `ProfileAssistantEntry` |
| Messages | FAB (`surfaceId: messages`) — never reads private message bodies |

Guest mode: modal shows Sign in / Register (no authenticated context).

---

## Session memory

Policy: `transient_browser_session`

- Stored in browser `sessionStorage` only
- Never MongoDB
- Never Direct Messaging
- Bounded history turns (client + server truncation)
- Actions: New Conversation · Clear Current Context · Continue (default)

---

## Prompt versioning & diagnostics

Prompt version ids (e.g. `assistant-core-policy-v1.0`, stage versions) are recorded
internally and may appear in **development diagnostics only**.

Diagnostics may show: provider, surface, stage, presentation mode, knowledge modules,
prompt versions, estimated prompt size, retry count, response time.

Never expose: system prompts, API keys, private messages.

---

## Cost & reliability (Pack 01)

- Timeout + max two retries (Gemini)
- Per-user minute / day rate limits + duplicate rapid-request rejection
- Prompt / history / draft excerpt budgets
- Anonymous operational metrics (no conversation content)

---

## Legacy quarantine (Pack 02)

| Item | Status |
|------|--------|
| `/api/v1/workspace-assistant` | **QUARANTINED** — unmounted |
| `/api/v1/lifecycle-ai` | **QUARANTINED** — unmounted |
| `WorkspaceCivicAssistant` UI | **UNUSED / QUARANTINED** — not rendered |
| `LifecycleAiAssistantModal` | **UNUSED** — not exported / not mounted |
| `HumanityAssistantPanel` (Implementation) | **LEGACY** static explainer — not chat Assistant |
| Stage `derive-*-ai-assistant-insights` | **ACTIVE** local heuristics — not a second LLM Assistant |

Source retained with `QUARANTINE.md` markers. Removal candidates after a stable production period.

Canonical HTTP only:

- `GET /api/v1/assistant/session-context`
- `POST /api/v1/assistant/assist`

---

## Related modules

- Core policy: `assistant-core-policy.ts`
- Platform Knowledge: `lifecycle-ai/platform-knowledge/`
- Safety: `lifecycle-safety`
- Language: Participant language context → preferred response language
- UI: `apps/web/src/features/humanity-union-assistant/`

---

## Future cleanup candidates

1. Delete quarantined workspace-assistant / workspace-intelligence modules after grace period.
2. Delete unused Lifecycle AI modal + web `api.ts` / CSS.
3. Relocate `use-workspace-section-tracker` / section constants out of `workspace-civic-assistant`.
4. Rename Implementation `HumanityAssistantPanel` to avoid product-name confusion.
