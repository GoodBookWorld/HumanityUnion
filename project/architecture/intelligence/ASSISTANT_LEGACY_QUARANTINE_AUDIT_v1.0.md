# Assistant Legacy Quarantine Audit

Pack: Assistant Production Hardening Pack 02  
Date: 2026-08-10

## Classification legend

- **ACTIVE** — production runtime path
- **QUARANTINED** — source retained; runtime mount/import removed
- **LEGACY** — still rendered or mounted but not the canonical Assistant product
- **UNUSED** — not imported by production pages

## Findings

| Path | Class | Notes |
|------|-------|-------|
| `apps/web/.../humanity-union-assistant/` | ACTIVE | Canonical UI |
| `apps/api/.../lifecycle-ai/assistant.routes.ts` + `platform-assistant.service.ts` | ACTIVE | Canonical API |
| `LifecycleAiProvider` / Gemini / Deterministic | ACTIVE | Provider seam |
| `apps/api/.../workspace-assistant/` | QUARANTINED | Unmounted Pack 02 |
| `apps/api/.../workspace-intelligence/` | QUARANTINED | Unmounted Pack 02 |
| `apps/api/.../lifecycle-ai/lifecycle-ai.routes.ts` | QUARANTINED | Unmounted Pack 02; unit tests may still import service |
| `apps/web/.../workspace-civic-assistant/WorkspaceCivicAssistant.tsx` | UNUSED / QUARANTINED | Not mounted |
| `apps/web/.../lifecycle-ai-assistant/LifecycleAiAssistantModal.tsx` | UNUSED | Not exported from barrel |
| Draft bridges under `lifecycle-ai-assistant/` | ACTIVE | Shared with Analysis editor |
| `HumanityAssistantPanel` (implementation*) | LEGACY | Static guidance panels |
| `derive-*-ai-assistant-insights.ts` | ACTIVE | Non-LLM sidebar insights |
| npm `verify:workspace-civic-assistant` / `verify:workspace-assistant-engine` | QUARANTINED | Scripts print quarantine notice |

## Production HTTP inventory

Mounted:

- `/api/v1/assistant/*`

Not mounted:

- `/api/v1/workspace-assistant`
- `/api/v1/lifecycle-ai`
