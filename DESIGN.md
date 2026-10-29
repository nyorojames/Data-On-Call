# DESIGN.md: Data On-Call

Design notes for the 3 Stitch screens (Intake, Scene, Ending). Screens are in `design/`.
Colors and fonts below were read from the Stitch output. **[TODO: confirm hex values and font names against Stitch's theme or code panel]**

## Principles

1. **One idea per screen.** About 5 elements per screen. If it needs explaining, it is too busy.
2. **No jargon on screen.** Terms like Kafka, CDC or backpressure come from the tutor, not from labels.
3. **Options show only the choice.** Consequences appear *after* the choice in the "What happened and why" panel. Never hint at the right answer in the option text.
4. **Personalization must be visible.** Beginner shows a Hint button. Experienced shows a 60-second timer instead.
5. **Phone first.** 390px wide, large tap targets, one-handed use.

## Colors

| Role | Value | Use |
|---|---|---|
| Background | `#0B1220` (deep navy) | Page background |
| Surface | `#111B2E` | Cards, option buttons, tutor box |
| Border | `#1F2A44` | Card outlines, dividers |
| Text | `#E6EBF5` | Primary text |
| Muted text | `#8A97B2` | Labels, helper text |
| Accent (amber) | `#F5A524` | Primary button, selected option, clock |
| Good (green) | `#34D399` | "Good" rows, healthy status |
| Risk (red) | `#F87171` | "Risky" rows, offline alert |

Rule: color carries meaning only. Amber means "act or selected", green means good, red means risky. Never use red or green for decoration.

## Typography

- **Headings and body:** a clean sans-serif (Inter or similar), at three sizes only:
  - Title 28px bold
  - Body 16px regular
  - Label 13px, uppercase, muted
- **Numbers and clock:** monospace (JetBrains Mono or similar), used only for the clock, the timer and status figures.

## Spacing and shape

- 16px screen padding, 12px gap between cards, 24px between sections
- 12px corner radius on cards and buttons
- Minimum tap target 48px high

## Components

| Component | Description | Test hook |
|---|---|---|
| Option card | Full-width card with a label only. Selected state: amber border and amber check. | `data-testid="option-<id>"` |
| Primary button | Amber fill, dark text, full width. Disabled (50% opacity) until required choices are made. | `data-testid="start-shift"`, `next-decision` |
| Status bar | Slim top bar with clock (mono) and "40% stations offline" in red. | `data-testid="clock"` |
| Scenario card | Surface card with 2 to 3 sentences of plain text. | `data-testid="scenario"` |
| Hint button | Outlined button, visible **only for Beginner**. | `data-testid="hint"` |
| Timer | Mono countdown "0:60", visible **only for Experienced**. | `data-testid="timer"` |
| Tutor box | Chat panel with the tutor's message (always ends in a question) and a text input. | `data-testid="tutor-input"`, `tutor-reply` |
| Consequence sheet | Bottom sheet titled "What happened and why", shown after each choice, with a "Next decision" button. | `data-testid="consequence"` |
| Result row | Decision name, status icon and the word "Good" (green) or "Risky" (red). Always text plus icon, never color alone. | `data-testid="result-<decision>"` |

## Screens

**1. Intake ("Start your shift")**
Title, one-line subtitle, question "Your level" (Beginner / Experienced), question "Your goal" (Internship prep / Keep up with trends / Use AI effectively), Start shift button.

**2. Scene (decision)**
Status bar, scenario card, "Decision 1 of 3" label, two option cards (A and B, label only), Hint button **or** timer, tutor box. The consequence sheet slides up after a choice.

**3. Ending**
Result title (e.g. "Ending A: Data correct, report on time"), one sentence of cause, three result rows (Architecture, Data quality, Privacy), Play again and Change my answers buttons. Ending B uses the same layout with red "Risky" rows and names the decision that caused it.

## Do and don't

- Do keep every screen readable in 3 seconds at arm's length.
- Do make Ending A and Ending B use the identical layout.
- Don't add login, profile, settings or a bottom tab bar (out of scope in `spec.md`).
- Don't put stats panels, tags or technical readouts on any screen.
- Don't describe consequences inside the option buttons.
