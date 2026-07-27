# Initiative Lifecycle — Single Page Navigation

Public initiative lifecycle stages share canonical identifiers with grouped Global Search (`INITIATIVE_TIMELINE_STAGES` entity mapping) while the single-initiative experience uses `PUBLIC_INITIATIVE_EXPERIENCE_STAGES` for visitor-facing order and hash labels.

## Single-initiative behavior

On `/initiatives/public/[initiativeId]`:

1. Left lifecycle navigation selects a stage.
2. Center panel scrolls to stage content (records, empty states, or Overview for the Initiative stage).
3. URL hash updates (`#collaborative-analysis`, `#revision`, etc.).
4. Direct hash links open the matching stage; invalid hashes fall back to Overview.

Revision History sidebar selections activate the Revision stage in the center without leaving the Initiative Experience page.

## Stage states

| State          | Meaning                                                      |
| -------------- | ------------------------------------------------------------ |
| completed      | Stage has published records and is before the current stage  |
| current        | Active lifecycle position                                    |
| upcoming       | Applicable but not yet reached                               |
| not applicable | Stage does not apply (e.g. Petition without linked petition) |

States are communicated with text labels, not color alone.

## Search vs single page

Global Search uses wide timeline columns for discovery. The single-initiative page uses **compact navigation** only; it does not copy the Search result container.

See also: [PUBLIC_INITIATIVE_EXPERIENCE.md](./PUBLIC_INITIATIVE_EXPERIENCE.md)
