# Humanity Union Design System

This document defines the visual language of the Humanity Union platform. It establishes shared standards for color, typography, layout, components, and responsive behavior so that every interface presents a consistent, accessible, and professional experience across WSAZ, CRZ, and institutional contexts.

## Design Philosophy

Humanity Union interfaces are built on the following principles:

- **Minimalism** — Remove decorative elements that do not serve clarity or function. Every visual choice must earn its place.
- **Future-oriented** — Favor clean geometry, restrained motion, and scalable patterns that remain credible as the platform evolves.
- **Global organization style** — Present the platform as a serious international institution: neutral, authoritative, and culturally adaptable without regional bias in visual tone.
- **Accessibility** — Meet WCAG 2.1 AA contrast targets as a baseline. Support keyboard navigation, screen readers, reduced motion preferences, and readable type at all breakpoints.
- **High readability** — Prioritize legible type, generous line height, clear hierarchy, and sufficient spacing between content blocks.
- **Low visual noise** — Limit simultaneous colors, borders, and effects. Use whitespace and hierarchy before ornament.
- **Professional appearance** — Avoid casual or playful styling. Interfaces should convey trust, stability, and institutional credibility.

## Color Palette

All colors below use suggested HEX placeholders. Final values must be validated for contrast accessibility before production use.

### Primary Color

| Attribute     | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Purpose       | Brand identity, primary actions, active navigation, key links, and focal interactive elements. |
| Suggested HEX | `#1B4F8A`                                                                                      |

### Secondary Color

| Attribute     | Value                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Purpose       | Supporting actions, secondary navigation, complementary highlights, and non-primary institutional accents. |
| Suggested HEX | `#2A6F97`                                                                                                  |

### Accent Color

| Attribute     | Value                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Purpose       | Highlights, badges, selected states, and emphasis elements that require distinction without alarm. |
| Suggested HEX | `#3A9BBF`                                                                                          |

### Success

| Attribute     | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Purpose       | Confirmations, approved states, completed processes, and positive feedback messages. |
| Suggested HEX | `#2E7D4F`                                                                            |

### Warning

| Attribute     | Value                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Purpose       | Cautionary messages, pending review, thresholds approaching limits, and non-blocking alerts. |
| Suggested HEX | `#B8860B`                                                                                    |

### Danger

| Attribute     | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Purpose       | Errors, destructive actions, critical alerts, and failed validation states. |
| Suggested HEX | `#B3261E`                                                                   |

### Background

| Attribute     | Value                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Purpose       | Default page canvas and outer application shell behind primary content areas. |
| Suggested HEX | `#F5F7FA`                                                                     |

### Surface

| Attribute     | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Purpose       | Cards, panels, modals, sidebars, and elevated content containers above the background. |
| Suggested HEX | `#FFFFFF`                                                                              |

### Border

| Attribute     | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Purpose       | Dividers, input outlines, card edges, table separators, and structural boundaries. |
| Suggested HEX | `#D8DEE6`                                                                          |

### Text Primary

| Attribute     | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Purpose       | Headings, body copy, labels, and primary readable content. |
| Suggested HEX | `#1A1F2E`                                                  |

### Text Secondary

| Attribute     | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Purpose       | Metadata, timestamps, helper text, placeholders, and de-emphasized supporting content. |
| Suggested HEX | `#5C6578`                                                                              |

## Typography

Typography must remain consistent across publications, governance views, statistics dashboards, and institutional profiles.

### Heading Font

**Inter** (or equivalent humanist sans-serif with strong Latin, Cyrillic, and extended character support).

Used for page titles, section headers, card titles, and navigation labels. Weights: 600 (semibold) for major headings; 500 (medium) for subheadings.

### Body Font

**Inter** (same family as headings for visual unity).

Used for paragraphs, form labels, list items, table content, and general UI text. Weight: 400 (regular) for body; 500 for emphasis within body text.

### Monospace Font

**JetBrains Mono** (or equivalent technical monospace).

Used for codes, identifiers, ACTUC logs, verification references, and inline technical values.

### Heading Hierarchy (H1–H6)

| Level | Usage                          | Size (placeholder) | Weight | Line height |
| ----- | ------------------------------ | ------------------ | ------ | ----------- |
| H1    | Page and zone titles           | 32 px              | 600    | 1.25        |
| H2    | Major section titles           | 26 px              | 600    | 1.3         |
| H3    | Subsection and panel titles    | 22 px              | 600    | 1.35        |
| H4    | Card titles and widget headers | 18 px              | 600    | 1.4         |
| H5    | Compact group labels           | 16 px              | 500    | 1.45        |
| H6    | Overlines and minor labels     | 14 px              | 500    | 1.5         |

Headings use Text Primary. Avoid skipping levels for semantic structure.

### Paragraph

- Size: 16 px base (15 px minimum on dense admin views only if accessibility is preserved).
- Line height: 1.6.
- Maximum readable line length: 72 characters where layout permits.
- Color: Text Primary for main content; Text Secondary for supporting paragraphs.

### Buttons

- Size: 14 px for standard buttons; 16 px for primary call-to-action buttons.
- Weight: 500.
- Letter spacing: normal; avoid uppercase except for compact badge-style controls.
- Line height: 1.2.

### Captions

- Size: 12 px.
- Weight: 400.
- Line height: 1.4.
- Color: Text Secondary.
- Usage: timestamps, footnotes, chart labels, legal microcopy, and field hints.

## Spacing System

### 4 px Base Grid

All spacing, padding, margins, and component dimensions align to a **4 px base grid**. Values not divisible by 4 require explicit design approval.

### Spacing Scale

| Token      | Value | Typical use                                       |
| ---------- | ----- | ------------------------------------------------- |
| `space-1`  | 4 px  | Tight inline gaps, icon-to-label spacing          |
| `space-2`  | 8 px  | Compact padding, dense list items                 |
| `space-3`  | 12 px | Form field internal padding, small component gaps |
| `space-4`  | 16 px | Standard component padding, paragraph spacing     |
| `space-5`  | 20 px | Card header/footer padding                        |
| `space-6`  | 24 px | Section spacing within panels                     |
| `space-8`  | 32 px | Card padding, modal padding                       |
| `space-10` | 40 px | Large section separation                          |
| `space-12` | 48 px | Page section margins                              |
| `space-16` | 64 px | Major layout breaks, hero spacing                 |

## Border Radius

Corner radii remain subtle to preserve a professional institutional tone.

| Element | Radius | Notes                                                  |
| ------- | ------ | ------------------------------------------------------ |
| Cards   | 12 px  | Default for publication cards, panels, and modals      |
| Buttons | 8 px   | All button variants except icon-only circular controls |
| Inputs  | 8 px   | Text fields, textareas, dropdowns, and search bars     |
| Widgets | 10 px  | Statistics, institution, and profile widgets           |

Icon-only buttons may use a fully circular radius (`50%`) when diameter is fixed.

## Shadows

Shadows indicate elevation sparingly. Prefer border and surface contrast before adding shadow depth.

| Level  | Usage                                  | Description (placeholder)                                          |
| ------ | -------------------------------------- | ------------------------------------------------------------------ |
| Small  | Inputs on focus, subtle hover on cards | Soft, low-offset shadow for minimal lift                           |
| Medium | Dropdowns, popovers, floating menus    | Moderate elevation with clear separation from background           |
| Large  | Modals, drawers, major overlays        | Pronounced elevation reserved for blocking or high-priority layers |

Shadow color should derive from neutral dark tones at low opacity. Avoid colored shadows.

## Icons

Icons follow a **consistent outlined style** at a default **24 px** canvas, with **20 px** for compact UI and **16 px** for inline metadata.

- Stroke weight: 1.5 px equivalent for visual balance at standard sizes.
- Style: geometric, minimal, monoline; no illustrative or cartoon treatment.
- Corner treatment: slightly rounded joins to match UI radius language.
- Color: inherit Text Primary by default; use Primary, Success, Warning, or Danger only for semantic states.
- Accessibility: decorative icons require no alt text; functional icons require accessible labels.
- Source: use a single approved icon set across the platform to avoid mixed visual languages.

## Buttons

All buttons meet minimum touch target **44 × 44 px** on mobile. Horizontal padding follows the spacing scale.

### Primary

Solid Primary Color background, white text. Used for the single most important action on a screen or dialog.

### Secondary

Solid Secondary Color background, white text. Used for important but non-dominant actions alongside a primary button.

### Outline

Transparent or Surface background with Border outline and Primary Color text. Used for alternative actions that must remain visible without competing with primary actions.

### Danger

Solid Danger background, white text. Used only for irreversible or high-risk actions such as deletion or revocation.

### Ghost

Transparent background, Primary or Text Primary label, no border by default. Used for tertiary actions, toolbar controls, and low-emphasis navigation within dense interfaces. Hover state uses a subtle Surface or neutral tint.

## Cards

Cards use Surface background, Border or shadow-small elevation, and radius per the Border Radius section.

### Default Card

General-purpose container for settings blocks, summaries, and grouped content. Padding: `space-8`. Header optional with H4 title and Text Secondary subtitle.

### Publication Card

Displays a publication in WSAZ or CRZ feeds. Includes title, author or institution, zone label, timestamp, excerpt, and optional reaction summary. Supports clear hierarchy between title and metadata. Entire card may be clickable; actions must remain keyboard accessible.

### Statistics Widget

Compact card for metrics and trends. Prominent numeric value, short label, optional delta indicator using Success, Warning, or Danger semantics. Minimize chart decoration; prioritize legible numbers and captions.

### Institution Widget

Summarizes an institution profile: name, verification badge, type, region, and key statistics. Emphasizes trust signals and verification level without visual clutter.

### Profile Widget

Displays user identity: avatar placeholder, display name, verification level, Social Activity Score indicator, and role badges where applicable. Metadata uses Text Secondary; identity uses Text Primary.

## Forms

Forms must be predictable, accessible, and consistent across registration, verification, proposals, petitions, and administration.

### Input

Single-line text fields with 8 px radius, Border outline, Surface background. Height minimum 44 px. Focus state uses Primary Color border and small shadow. Label above field; helper text below in caption style.

### Textarea

Multi-line input with same border and focus behavior as Input. Minimum height 120 px; vertical resize allowed unless layout constraints require fixed height.

### Dropdown

Select control matching Input height and radius. Chevron indicator on the trailing edge. Options presented in a medium-shadow menu with clear hover and selected states.

### Checkbox

Square control with 4 px internal padding to touch target requirements. Checked state uses Primary Color fill. Label clickable and associated via accessible naming.

### Radio

Circular control for mutually exclusive choices within a set. Selected state uses Primary Color. Group labels required for screen reader context.

### Validation

- Inline errors appear below the field in Danger color with caption size.
- Success confirmation uses Success color sparingly, typically after submission rather than per keystroke.
- Invalid fields use Danger border; do not rely on color alone—include text explanation and icon where appropriate.
- Required fields marked with text or aria-required, not color alone.

## Animations

Animation supports comprehension and feedback; it must never obstruct access or create distraction.

- **Purpose** — Indicate state change, confirm action, or guide attention. Avoid decorative motion.
- **Duration** — Micro-interactions: 120–180 ms. Panel and modal transitions: 200–280 ms. No animation exceeds 400 ms except loading indicators.
- **Easing** — Use ease-out for entrances and ease-in for exits; prefer standard curves across the platform.
- **Restraint** — Limit concurrent motion. One primary animated element per viewport region.
- **Accessibility** — Honor `prefers-reduced-motion`: replace transitions with instant state changes or opacity-only fades.
- **Loading** — Use neutral progress indicators; avoid playful loaders in institutional and governance contexts.

## Responsive Breakpoints

Layouts are responsive-first: design for mobile constraints first, then expand capability at larger breakpoints.

| Name       | Range             | Intent                                                                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Mobile     | 0 – 639 px        | Single-column layouts, stacked navigation, full-width cards, bottom-aligned primary actions where appropriate |
| Tablet     | 640 – 1023 px     | Two-column grids where useful, collapsible side navigation, increased horizontal padding                      |
| Laptop     | 1024 – 1279 px    | Standard multi-column dashboards, persistent side navigation, publication feeds with sidebar                  |
| Desktop    | 1280 – 1535 px    | Full institutional layouts, multi-panel governance views, wider statistics grids                              |
| Ultra-wide | 1536 px and above | Constrain max content width to preserve readability; use outer margins rather than stretching text lines      |

Touch targets, typography, and spacing tokens remain consistent across breakpoints; layout columns and navigation patterns adapt.

This Design System is mandatory for every Humanity Union interface.
