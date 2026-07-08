# Humanity Union Design System

This document is the single source of truth for the Humanity Union visual identity. It defines the official design language established in TASK-047 and used across the platform — public pages, workspace, country and region experiences, and all future capabilities.

Every interface must inherit from this system. Do not introduce page-specific visual languages.

---

## 1. Humanity Design Philosophy

Humanity Union is **Minimal Civic Technology**. The platform should feel:

- **Civic** — grounded in public participation, responsibility, and collective decision-making
- **Transparent** — open structure, clear hierarchy, no hidden complexity in the interface
- **Trustworthy** — calm, professional, and credible for international participants
- **Calm** — low visual noise, generous whitespace, restrained color use
- **Intelligent** — information is organized and readable before it is decorative
- **Technology serving humanity** — tools support people; interfaces never dominate content

### What to avoid

Do not design interfaces that resemble:

- Social media feeds
- Gaming interfaces
- Cryptocurrency or trading platforms
- Commercial dashboards overloaded with widgets
- Military or surveillance aesthetics

### Core principles

- Readability before decoration
- Color only where meaningful
- Minimal elevation and no glassmorphism
- One unified visual language across all pages
- Accessibility as a baseline, not an afterthought

---

## 2. Color System

Official colors are defined as CSS custom properties in `apps/web/src/design-system/tokens.css`.

### Primary

| Token                      | Value     | Usage                                                         |
| -------------------------- | --------- | ------------------------------------------------------------- |
| `--hu-color-primary`       | `#0174B0` | Brand identity, primary actions, active navigation, key links |
| `--hu-color-primary-hover` | `#015F92` | Hover and focus states on primary elements                    |
| `--hu-color-primary-soft`  | `#E8F4FA` | Soft highlight backgrounds, status banners                    |

### Secondary

| Token                        | Value     | Usage                                             |
| ---------------------------- | --------- | ------------------------------------------------- |
| `--hu-color-secondary-cyan`  | `#7EC8E3` | Soft cyan accents                                 |
| `--hu-color-secondary-blue`  | `#4A9FD4` | Soft blue accents                                 |
| `--hu-color-secondary-slate` | `#64748B` | Light slate for muted text and secondary elements |

### Background

| Token                  | Value     | Usage                                       |
| ---------------------- | --------- | ------------------------------------------- |
| `--hu-color-bg`        | `#FFFFFF` | White page surfaces                         |
| `--hu-color-bg-muted`  | `#F4F7FA` | Very light blue-gray application background |
| `--hu-color-bg-subtle` | `#EEF3F7` | Subtle panel and notification backgrounds   |

### Cards and surfaces

| Token                   | Value     | Usage                           |
| ----------------------- | --------- | ------------------------------- |
| `--hu-color-surface`    | `#FFFFFF` | Card and panel backgrounds      |
| `--hu-color-border`     | `#D6DEE8` | Soft neutral gray-blue borders  |
| `--hu-color-text`       | `#1A2B3C` | Primary text                    |
| `--hu-color-text-muted` | `#5F6B7A` | Helper text, metadata, captions |

Cards use white backgrounds with subtle elevation (`--hu-shadow-sm`). Do not introduce colorful gradients.

### Status colors (badges)

Workspace status badges use semantic background tints. Border color remains `--hu-color-border` for all variants.

| Variant                                   | Background | States                                |
| ----------------------------------------- | ---------- | ------------------------------------- |
| Draft / Pending                           | `#FFF7ED`  | Warm neutral — work in progress       |
| Published / Active                        | `#EFF6FF`  | Soft blue — live or in progress       |
| Verified / Completed                      | `#ECFDF3`  | Soft green — confirmed or finished    |
| Archived / Closed / Cancelled / Withdrawn | `#F5F5F5`  | Neutral gray — inactive or historical |
| Neutral                                   | `#FAFAFA`  | Default fallback                      |

Status colors are unchanged from the workspace UX module. Do not repurpose badge colors for non-status UI.

---

## 3. Typography

**Principle: Readability before decoration.**

The platform uses a system font stack for performance and international readability:

```
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

### Heading hierarchy

| Class / Level        | Token size                     | Usage                          |
| -------------------- | ------------------------------ | ------------------------------ |
| `.hu-heading-1` / H1 | `--hu-font-size-2xl` (1.75rem) | Page titles, workspace headers |
| `.hu-heading-2` / H2 | `--hu-font-size-xl` (1.375rem) | Major section titles           |
| `.hu-heading-3` / H3 | `--hu-font-size-lg` (1.125rem) | Subsection and card titles     |

Headings use `--hu-line-height-tight` (1.35). Do not skip heading levels for semantic structure.

### Body text

| Class         | Token                                         | Usage                                            |
| ------------- | --------------------------------------------- | ------------------------------------------------ |
| `.hu-body`    | `--hu-font-size-base` (1rem), line-height 1.6 | Paragraphs, labels, general content              |
| `.hu-body-sm` | `--hu-font-size-sm` (0.875rem)                | Compact body text                                |
| `.hu-prose`   | max-width 70ch                                | Long civic documents and readable content blocks |

Body text uses `--hu-color-text`. Supporting paragraphs use `--hu-color-text-muted`.

### Helper text

Helper text, purpose notes, and assistant safety notices use:

- Class: `.hu-helper-text` (or `.workspace-helper-note`, `.workspace-purpose`)
- Size: `--hu-font-size-sm`
- Color: `--hu-color-text-muted`

### Badges

- Size: ~0.78rem, weight 600, capitalize
- Shape: pill (`--hu-radius-pill`)
- Border: `--hu-color-border`
- Background: semantic status tint (see Status colors)

### Timeline text

Timeline items use consistent hierarchy within `.workspace-timeline__item`:

- **Date** — muted, small
- **Title** — primary weight
- **Meta / body** — muted helper style
- **Links** — primary color via `PublicLink`

---

## 4. Layout

### Global page shell

Every page follows the official Humanity layout:

```
Sticky Header
    ↓
Page Layout (main content)
    ↓
Footer
```

Implemented by `HumanityLayout` in the root application layout. The header remains visible on all pages — workspace, public pages, country pages, region pages, community pages, and archive pages. There must be no duplicate headers.

Header height token: `--hu-header-height` (4.5rem).

### Workspace layout

The initiative workspace follows a three-column structure below the global header:

```
Global Header (sticky)
    ↓
Left sticky Workspace Navigation
    ↓
Center working area
    ↓
Right sticky Civic Assistant
```

- Navigation and assistant begin **below** the header — no overlapping
- Left nav tracks the current workspace section
- Center area holds pipeline sections via `WorkspaceSectionShell`
- Right assistant follows the workspace context

Max workspace width: `--hu-workspace-max-width` (75rem).

---

## 5. Spacing

Official spacing uses a consistent scale defined in `tokens.css`:

| Token           | Value          | Typical use                                       |
| --------------- | -------------- | ------------------------------------------------- |
| `--hu-space-1`  | 0.25rem (4px)  | Tight inline gaps                                 |
| `--hu-space-2`  | 0.5rem (8px)   | Compact padding, nav link gaps                    |
| `--hu-space-3`  | 0.75rem (12px) | Button padding, small component gaps              |
| `--hu-space-4`  | 1rem (16px)    | Standard component padding, section header margin |
| `--hu-space-5`  | 1.25rem (20px) | Card padding                                      |
| `--hu-space-6`  | 1.5rem (24px)  | Grid gaps, section spacing                        |
| `--hu-space-8`  | 2rem (32px)    | Workspace shell gap, page padding                 |
| `--hu-space-10` | 2.5rem (40px)  | Large section separation                          |
| `--hu-space-12` | 3rem (48px)    | Major layout breaks                               |

### Consistent spacing rules

| Context        | Spacing                                                 |
| -------------- | ------------------------------------------------------- |
| **Sections**   | `--hu-space-6` to `--hu-space-8` between major blocks   |
| **Cards**      | `--hu-space-4` to `--hu-space-5` internal padding       |
| **Buttons**    | `--hu-space-2` vertical, `--hu-space-4` horizontal      |
| **Timelines**  | `--hu-space-3` between items                            |
| **Paragraphs** | `--hu-space-3` to `--hu-space-4` between related blocks |

Avoid random margins. Use tokens, not arbitrary pixel values.

### Border radius

| Token              | Value | Elements                         |
| ------------------ | ----- | -------------------------------- |
| `--hu-radius-sm`   | 6px   | Buttons, pipeline stages         |
| `--hu-radius-md`   | 8px   | Cards, inputs, panels, assistant |
| `--hu-radius-lg`   | 12px  | Large containers                 |
| `--hu-radius-pill` | 999px | Badges                           |

### Shadows

| Token            | Usage                      |
| ---------------- | -------------------------- |
| `--hu-shadow-sm` | Cards, subtle elevation    |
| `--hu-shadow-md` | Dropdowns, elevated panels |

Shadows are minimal and neutral. No floating-glass effects.

---

## 6. Shared Components

Official components are exported from `apps/web/src/design-system/`. Every future page must use these components.

| Component                 | Purpose                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Button**                | Primary and secondary actions. Variants: `primary`, `secondary`.                                                              |
| **Card**                  | General-purpose content container with standard padding and elevation.                                                        |
| **MetricCard**            | Compact metric display (label + value) for workspace summaries.                                                               |
| **ProfileCard**           | Profile-oriented card with titled header.                                                                                     |
| **Badge**                 | Status indicator with semantic color variant.                                                                                 |
| **SectionHeader**         | Section title with optional description.                                                                                      |
| **WorkspaceSectionShell** | Standard workspace section wrapper: purpose, metrics, loading, error, content, actions, links, empty state, deferred actions. |
| **PublicLink**            | Standardized public page link with arrow suffix (`→`).                                                                        |
| **TimelineItem**          | Single entry in a workspace timeline.                                                                                         |
| **EmptyState**            | Standardized empty state: title, explanation, next step.                                                                      |
| **LoadingState**          | Accessible loading indicator with `role="status"`.                                                                            |
| **ErrorState**            | Standardized error message display.                                                                                           |
| **StatusBanner**          | Informational banner with left accent border.                                                                                 |
| **HelperText**            | Muted supporting text below content or fields.                                                                                |
| **PipelineStage**         | Compact pipeline stage label.                                                                                                 |
| **ContextPanel**          | Side context panel with titled header.                                                                                        |
| **NotificationCard**      | Notification-style card on subtle background.                                                                                 |
| **ApiUnavailableState**   | Participant-friendly unavailable state with retry and back actions.                                                           |

Workspace-specific components (`WorkspaceSectionShell`, `Badge`, `PublicLink`, etc.) live in `initiative-workspace-ux` and are re-exported through the design system index for a single import surface.

---

## 7. Workspace

The workspace is the primary participation environment. All workspace sections must feel like part of one system.

### Principles

- **One visual language** — same cards, typography, badges, spacing, and empty states across every pipeline section
- **Sticky navigation** — left sidebar tracks current section, stays visible below the global header
- **Sticky assistant** — right Civic Assistant follows workspace context below the global header
- **Assistant is advisory only** — see Section 11
- **Consistent empty states** — every section uses `EmptyState` with title, explanation, and next step
- **Consistent deferred actions** — disabled buttons use standard opacity (0.55) and standard tooltip text

### Section structure

Every workspace section uses `WorkspaceSectionShell` with:

1. Purpose text
2. Metrics row (optional)
3. Loading / error states
4. Content or empty state
5. Actions and public links
6. Deferred actions (when applicable)

Equal padding, headers, footers, actions, metrics, and empty states across all sections.

---

## 8. Accessibility

Accessibility is a baseline requirement, not optional polish.

| Requirement             | Implementation                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Focus order**         | Logical tab order matching visual layout; sticky elements do not trap focus                                                |
| **Keyboard navigation** | All interactive elements reachable and operable via keyboard                                                               |
| **Contrast**            | Text and interactive elements meet readable contrast against backgrounds                                                   |
| **ARIA**                | Navigation landmarks, `aria-current="page"`, `role="status"` on loading states, `role="alert"` on error/unavailable states |
| **Heading hierarchy**   | No skipped levels; section titles use appropriate heading level                                                            |
| **Focus visible**       | `--hu-focus-ring` (2px solid primary) with `--hu-focus-offset` (2px) on all interactive elements                           |

Public pages preserve skip links (`Skip to main content`) and `id="main-content"` landmarks.

Honor `prefers-reduced-motion` for any future motion additions.

---

## 9. Responsive Layout

| Breakpoint            | Layout                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Desktop** (>1024px) | Global header + left sticky nav + center content + right sticky assistant              |
| **Tablet** (≤1024px)  | Initiative layout stacks to single column; assistant moves below content               |
| **Mobile** (≤768px)   | Header + content; workspace nav hidden; drawer navigation and drawer assistant planned |

### Assistant behavior

- **Desktop** — sticky right sidebar below header
- **Tablet** — below main content (collapsible toggle)
- **Mobile** — drawer pattern (planned; toggle button present)

Assistant sticky offset accounts for `--hu-header-height` so it never overlaps the global header.

---

## 10. Visual Principles

### Use

- Minimal layout with clear hierarchy
- Calm, professional tone
- International neutrality in color and typography
- Subtle elevation and soft borders
- Color only where it communicates meaning

### Do not use

- Heavy gradients
- Glassmorphism or frosted-glass effects
- Gaming UI patterns (XP bars, achievement badges, neon accents)
- Cryptocurrency aesthetics (dark trading themes, coin icons, price tickers)
- Excessive animations or motion for decoration
- Widget-heavy dashboard layouts

---

## 11. Assistant

The Civic Assistant is a **workspace guide**, not an autonomous agent.

### What the assistant does

- Explains the current workspace section
- Suggests next steps based on context
- Shows confidence level and safety notices
- Uses the same design system components as the rest of the workspace

### What the assistant never does

The assistant **never**:

- Publishes content
- Casts votes
- Verifies records
- Sends messages or notifications
- Archives records

The assistant **only suggests**. All consequential actions remain with the participant through explicit workspace controls.

---

## 12. Future Evolution

The following areas are reserved for future design system expansion. Do not implement without updating this document.

| Area                      | Status                                                       |
| ------------------------- | ------------------------------------------------------------ |
| **Component library**     | Foundation established; expand with Storybook or equivalent  |
| **Motion guidelines**     | Reserved — define duration, easing, and reduced-motion rules |
| **Icon library**          | Reserved — single approved set with consistent sizing        |
| **Dark theme**            | Reserved — token structure supports future theme switching   |
| **Illustration language** | Reserved — civic-tech atmosphere without literal copying     |

When adding new capabilities, extend this document and the design system tokens before introducing new visual patterns.

---

## Implementation reference

| Resource            | Location                                                   |
| ------------------- | ---------------------------------------------------------- |
| Design tokens       | `apps/web/src/design-system/tokens.css`                    |
| Layout styles       | `apps/web/src/design-system/layout.css`                    |
| Component styles    | `apps/web/src/design-system/components.css`                |
| Typography          | `apps/web/src/design-system/typography.css`                |
| Component exports   | `apps/web/src/design-system/index.ts`                      |
| Global layout       | `apps/web/src/design-system/components/HumanityLayout.tsx` |
| Workspace UX module | `apps/web/src/features/initiative-workspace-ux/`           |
| Verification        | `npm run verify:design-system`                             |

This Design System is mandatory for every Humanity Union interface.
