# Aivle Proctoring Platform Design System

## 0. Research Log

- Existing UI extraction: reviewed `frontend/src/styles/main.css`, `Header.jsx`, `HomePage.jsx`, admin tabs, supervisor tabs, and applicant pages; preserved the current light operational-console language.
- Embedded references: operational dashboard brief maps to the restrained `taste-skill` rules; no brand or screenshot reference was supplied, so no external brand system is copied.
- Skipped lanes: lazyweb and Imagen were skipped because this is an existing product workflow extension, not a visual reference or marketing surface.

## 1. Atmosphere & Identity

A calm, trustworthy operations desk for high-stakes assessment. The signature is a bright workspace with clear role boundaries, compact status rails, and blue focus states that make the next safe action obvious. Information density is moderate: summaries stay scannable, while approval and invitation actions retain enough context to prevent mistakes.

## 2. Color

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Surface/primary | `--surface-primary` | `#f8fafc` | App background |
| Surface/secondary | `--surface-secondary` | `#ffffff` | Cards and panels |
| Surface/soft | `--surface-soft` | `#f1f5f9` | Input groups and muted rows |
| Surface/accent-soft | `--surface-accent-soft` | `#eff6ff` | Selected organization and bulk-action controls |
| Surface/danger-soft | `--surface-danger-soft` | `#fef2f2` | Destructive action confirmation and errors |
| Surface/danger-hover | `--surface-danger-hover` | `#fee2e2` | Destructive action hover feedback |
| Surface/success-soft | `--surface-success-soft` | `#f0fdf4` | Assigned and completed states |
| Text/primary | `--text-primary` | `#0f172a` | Headings and body |
| Text/secondary | `--text-secondary` | `#475569` | Supporting copy |
| Text/muted | `--text-muted` | `#64748b` | Metadata and hints |
| Border/default | `--border-default` | `#e2e8f0` | Panel boundaries |
| Border/input | `--border-input` | `#cbd5e1` | Form controls |
| Border/danger | `--border-danger` | `#fecaca` | Destructive action boundary |
| Border/success | `--border-success` | `#bbf7d0` | Assigned state boundary |
| Accent/primary | `--accent-primary` | `#2563eb` | Primary actions and focus |
| Accent/hover | `--accent-hover` | `#1d4ed8` | Hover and active emphasis |
| Status/success | `--status-success` | `#16a34a` | Approved and normal |
| Status/warning | `--status-warning` | `#d97706` | Pending and caution |
| Status/error | `--status-error` | `#dc2626` | Rejected and danger |
| Status/info | `--status-info` | `#7c3aed` | Admin or AI configuration |
| Coding/surface | `--coding-surface` | `#263b4c` | Candidate coding workspace and statement pane |
| Coding/surface-raised | `--coding-surface-raised` | `#2e4659` | Editor toolbar, active result tab, controls |
| Coding/surface-deep | `--coding-surface-deep` | `#1c2e3e` | Header, examples, and result footer |
| Coding/border | `--coding-border` | `#172938` | Coding workspace dividers |
| Coding/text | `--coding-text` | `#e8f0f7` | Coding workspace primary text |
| Coding/text-muted | `--coding-text-muted` | `#a9c0d2` | Coding workspace supporting copy |
| Coding/accent | `--coding-accent` | `#b9d7f0` | Editor focus and candidate-time emphasis |

Accent is reserved for interactive actions and current-state emphasis. Status colors are semantic and do not replace the primary accent.

## 3. Typography

| Level | Size | Weight | Line height | Usage |
|------|------|--------|-------------|-------|
| Page title | `28px` | 700 | 1.3 | Workspace heading |
| Section title | `22px` | 700 | 1.4 | Panel heading |
| Card title | `18px` | 700 | 1.4 | Organization/exam title |
| Body | `16px` | 400 | 1.6 | Primary copy |
| Body/sm | `14px` | 400 | 1.5 | Table and form copy |
| Caption | `12px` | 600 | 1.4 | Status and metadata |

Primary: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Mono: `ui-monospace, SFMono-Regular, Consolas, monospace` for candidate numbers and tokens. Body copy never falls below 14px.

## 4. Spacing & Layout

Spacing uses a 4px base unit. `--space-1` through `--space-8` map to 4, 8, 12, 16, 20, 24, 32, and 40px. Workspace content uses a 1200px max width, 24px desktop gutters, and 16px mobile gutters. Breakpoints are 640px, 768px, 1024px, and 1280px.

## 5. Components

### Workspace shell

- Structure: page header, role eyebrow, title, summary strip, tab navigation, content panels.
- Variants: `admin`, `manager`, `applicant-invite`.
- States: default, loading, empty, error.
- Accessibility: semantic `main`, labelled navigation, visible focus, keyboard-reachable tabs.

### Status badge

- Structure: inline `span` with semantic label.
- Variants: `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`, `NORMAL`, `WARNING`, `DANGER`.
- States: default and compact.
- Accessibility: status text remains visible; color is never the only signal.

### Data panel

- Structure: heading row, supporting text, list/table body, action row.
- Variants: organization list, candidate list, invitation preview, exam assignment.
- States: loading skeleton, populated, empty, error.
- Accessibility: labelled controls, table headers where tabular, action buttons with explicit labels.

### Candidate intake and editing

- Structure: manual applicant form with name, email, and birth date; a CSV upload action; newly registered applicants are automatically assigned to the current exam, while an applicant registered for another exam is reused and assigned instead of treated as a duplicate; invitation-panel search; and an inline edit panel selected from an applicant row.
- States: empty, search filtered, birth date missing, detailed file validation error (type, header, row number, field), normalized birth-date input, CSV registration preview with available/error counts and five visible rows before scrolling, upload complete, and edit saving. The invitation-tab compact count is registered candidates / active invitations, so registration alone never increases the sent-invitation count.
- Accessibility: file format requirements are text-visible; date and search inputs are labelled; edit controls are native buttons and never rely on row click alone.

### Exam management row

- Structure: selectable exam row with title, organization/date metadata, question count, and status.
- States: default, selected, disabled while loading.
- Accessibility: full row is a semantic button with visible selected state.

### Exam detail tabs

- Structure: a compact labelled `nav` directly below the exam summary, with buttons for problem authoring, applicant management, and invitations; each includes a muted count pill.
- States: default, selected, hover, keyboard focus, and wrapped mobile layout.
- Interaction: selecting a tab shows only its operating panel, keeping unrelated forms and tables out of the vertical flow.
- Accessibility: tabs are native buttons with `aria-pressed`, a visible selected state, and an `aria-label`led navigation landmark.

### Primary action

- Structure: semantic `button` or `a` with Lucide icon and text.
- States: default, hover, active, focus, disabled, loading.
- Motion: 120ms color/transform feedback; no layout animation.

### Management composer modal

- Structure: an existing backdrop and centred white modal are reused for organization-community posts and organization notices; the form is opened only from the corresponding list-header primary action.
- States: closed, create, edit, saving, validation error, and submit success.
- Accessibility: the open action has text plus a Lucide plus icon; the modal has a labelled native close button; backdrop click and close reset only unsaved local form state.
- Interaction: organization filtering remains in the underlying list header, so managers can narrow the list to one assigned organization before opening the composer.

### Notice schedule control

- Structure: each notice schedule uses a native date field followed by clearly labelled hour and 10-minute select fields, with a text-only quick action for immediate publishing or no end date.
- States: unscheduled, date selected, time adjusted, immediately published, and no end date.
- Accessibility: visible labels identify date, hour, and minute; the quick actions are native buttons with clear result text and visible keyboard focus.

### Candidate coding workspace

- Structure: the global service header is suppressed during an exam; the exam uses its own fixed dark header, a narrow scrollable navigation pane with remaining time and numbered problem titles, a separate scrollable problem statement pane, code editor pane, and execution-result pane with persistent footer controls.
- Variants: one coding question, multiple coding questions with a numbered title list in the navigation pane, public example list, run notice, and submission result.
- States: code empty, editing, selected problem, selected result tab, run-server unavailable notice, submission error.
- Accessibility: problem selector and result tabs are keyboard reachable; editor has an explicit label; the bottom controls repeat execution and submission actions without relying on the header.
- Responsive behavior: at 900px the statement pane stacks above the editor; on small screens control labels stay readable and examples become one column.

### AI detection overlay

- Structure: a non-interactive layer over webcam or auxiliary-camera video, with one semantic bounding box and confidence label per detected object.
- Variants: supervisor snapshot/live video and mirrored mobile front-camera preview; the mobile variant mirrors box coordinates while keeping labels readable.
- States: waiting for first analysis, detections visible, and no detections; the latest analysis time remains visible without blocking camera controls, and the supervisor summary separates front-camera and mobile-camera results.
- Accessibility: the overlay exposes the detection count as text and never relies on box color alone because each box includes an object label and confidence.

### AI analysis problem navigator

- Structure: a persistent overall AI summary followed immediately by a compact horizontal problem tab rail and one selected problem analysis panel; scoring, complexity, deductions, and feedback sections stack vertically in reading order, while paired metrics may use two columns inside a section.
- States: first problem, middle problem, last problem, direct tab selection, previous/next navigation, full score, and deducted score.
- Interaction: selecting a numbered tab or the previous/next controls replaces only the problem analysis content; the overall summary remains fixed.
- Accessibility: the tab rail uses `role="tablist"`, selected state is exposed with `aria-selected`, and navigation controls have explicit problem labels.
- Responsive behavior: the problem rail scrolls horizontally on narrow screens, analysis metric columns stack below 640px, and no empty spacer is introduced between sections.

## 6. Motion & Interaction

Use 120ms ease-out for button feedback and 240ms ease-in-out for tab/panel state changes. Animate only `transform` and `opacity`; respect `prefers-reduced-motion`. Toasts and confirmation copy should explain the completed action without blocking the next task.

## 7. Depth & Surface

Strategy: mixed. White panels use a 1px `--border-default` and a restrained tinted shadow from the existing UI. Elevated confirmation surfaces may use the default 0 4px 12px rgba(15, 23, 42, 0.06) shadow. Avoid stacking cards inside cards unless hierarchy requires it.

## 8. Accessibility Constraints & Accepted Debt

- WCAG 2.2 AA target; body contrast 4.5:1 minimum and large text 3:1 minimum.
- All new controls use semantic elements, labels, keyboard focus, and non-color status text.
- Candidate numbers and invite tokens use readable monospace text with copy affordances.
- Respect `prefers-reduced-motion` for non-essential transitions.
- Role navigation is account-derived; login never asks the user to self-select ADMIN or manager.

| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| Provider-neutral invitation preview | manager workspace | SMTP credentials and provider policy are not available in this repository | Backend integration owner / replace preview adapter before production mail launch |
| Existing inline styles and legacy `SUPERVISOR` labels | existing tabs | unrelated legacy surface; compatibility is required for this feature | Frontend owner / consolidate during dedicated UI refactor |
