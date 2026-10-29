# Data On-Call (Kenya E-Mobility Edition)

Data On-Call is a mobile-first scenario game where the player acts as the on-call data engineer resolving a critical telemetry incident at a synthetic Kenyan electric-motorcycle battery-swap network. Built for junior data engineers, each decision carries visible production consequences that teach pipeline architecture, data quality verification, and privacy protection under real-world time pressure. An integrated AI tutor powered by Gemini provides Socratic guidance through hints and questions without ever revealing the answers.

**AI Studio Applet Link:** (https://ai.studio/apps/5e740619-2393-4262-bc39-799452da29b0)

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended, tested on Node v24)
- npm (v9 or higher)
- Optional: [ffmpeg](https://ffmpeg.org/) (for demo video post-processing)

### 2. Environment Setup
Copy `.env.example` to `.env` or set the environment variable directly:

In PowerShell (Windows):
```powershell
$env:GEMINI_API_KEY="your-gemini-api-key"
```

In bash/zsh (macOS/Linux):
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Installation
Install project dependencies:
```bash
npm install
```

---

## Running the Application & Commands

| Command | Description | Local URL / Target |
|---|---|---|
| `npm run app` (or `npm start`) | Starts the Express server and Vite frontend | `http://localhost:3000` |
| `npm run test:unit` | Executes Node.js unit tests for rules and AC7 logic | Terminal output |
| `npm test` | Runs the full Cypress acceptance test suite (AC1–AC7) headless | Headless runner |
| `npm run test:open` | Launches the interactive Cypress graphical test runner | Cypress UI |
| `npm run demo` | Headless walkthrough recording and generates `cypress/videos/demo.mp4` (~60s) | Video output |
| `npm run eval` | Evaluates 20 benchmark student messages and writes `eval/results.csv` | Output file |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) | Terminal output |

---

## Repository Structure

```text
DataOnCall/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules (node_modules, .env*, cypress media)
├── DESIGN.md                 # UI and component design specification
├── README.md                 # Project overview, instructions, and limitations
├── questions.md              # 18-question pre-written tutor bank and hints
├── spec.md                   # System specifications and acceptance criteria
├── package.json              # Scripts and project dependencies
├── server.ts                 # Express backend serving Vite and /api/tutor endpoint
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration with Tailwind CSS
├── cypress.config.js         # Cypress configuration (viewport 390x844, video: true)
├── cypress/
│   ├── e2e/
│   │   ├── data-on-call.cy.js # Acceptance test suite for AC1 through AC7
│   │   └── demo.cy.js         # Paced demo walkthrough spec
│   ├── fixtures/
│   │   └── questions.json     # All 18 pre-written opening questions
│   ├── support/
│   │   └── e2e.js             # Cypress support configuration
│   └── videos/                # Saved test and demo videos (e.g., demo.mp4)
├── eval/
│   ├── messages.md           # 20 student evaluation prompts and grading rubric
│   └── results.csv           # Evaluation harness output table
├── scripts/
│   ├── run-demo.js           # Headless demo runner and ffmpeg speed-adjuster
│   └── run-eval.js           # Automated eval test harness calling local tutor API
└── src/
    ├── App.tsx               # Main application container and state machine
    ├── main.tsx              # React DOM entry point
    ├── index.css             # Tailwind styling and custom utilities
    ├── components/
    │   ├── BottomSheet.tsx   # "What happened and why" consequence bottom sheet
    │   ├── EndingScreen.tsx  # Ending results, weakest skill, next step, level change
    │   ├── IntakeScreen.tsx  # Level and goal selection screen
    │   └── SceneScreen.tsx   # Decision view, status bar, timer/hints, and AI tutor
    └── game/
        ├── rules.ts          # Decision definitions, consequence evaluation, AC7 logic
        └── rules.test.ts     # Unit tests verifying questions, hints, and ending rules
```

---

## Product Decisions

1. [TODO: I will write which 3 features I did not build and one sentence why each]
2. [TODO: I will write which 3 features I did not build and one sentence why each]
3. [TODO: I will write which 3 features I did not build and one sentence why each]

---

## Known Limitations

- **Gemini API Transient Fallback (503 / 429)**: When the Gemini API is unavailable or rate-limited, the application retries up to 3 times (1s, 2s, 4s backoff). If all retries fail, it falls back to displaying the decision's pre-written opening question with a "Try again" button rather than displaying raw error traces to the user.
- **Tutor Answer-Leaking Safeguard**: The app currently relies on the model system prompt to enforce Socratic behavior. An automated post-processing filter (to catch and rewrite phrases like "choose A" or "choose B") is deferred pending the completion of hand-labeled eval results.
- **Session Progress Persistence**: State is stored in memory during the active browser session. Refreshing the browser returns to the intake screen; no persistent user database or external authentication is utilized (in accordance with spec scope).
- **Audio Feedback**: The application focuses on responsive mobile visual elements (countdown timer, monospace clock, status indicators, animated sheets) and does not play audio alerts.
