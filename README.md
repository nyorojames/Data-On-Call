# Data On-Call (Kenya E-Mobility Edition)

Data On-Call is a mobile-first scenario game where the player acts as the on-call data engineer resolving a critical telemetry incident at a synthetic Kenyan electric-motorcycle battery-swap network. Built for junior data engineers, each decision carries visible production consequences that teach pipeline architecture, data quality verification, and privacy protection under real-world time pressure. An integrated AI tutor powered by Gemini (using the `gemini-3.5-flash` model) provides Socratic guidance through hints and questions without ever revealing the answers.

**AI Studio Applet Link:** https://ai.studio/apps/5e740619-2393-4262-bc39-799452da29b0  
**Demo Walkthrough Video:** Available via `npm run demo` (generates `cypress/videos/demo.mp4`)

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
| `npm run merge-eval` | Merges retry results into `eval/results-run2.csv` with source tracking | Output file |
| `npm run summarize-eval` | Validates labels and computes summary metrics from evaluation CSV | Terminal output |
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
├── docs/
│   └── ai-studio-sync-prompt.md # Copy-paste prompt for Google AI Studio sync
├── eval/
│   ├── messages.md           # 20 student evaluation prompts, rubric, and summary
│   ├── proposed-labels.md    # LLM-proposed and author-reviewed evaluation labels
│   ├── results.csv           # Run 1 evaluation results table
│   └── results-run2.csv      # Run 2 final configuration evaluation results
├── scripts/
│   ├── merge-eval.js         # Merges rerun evaluation rows with source tracking
│   ├── run-demo.js           # Headless demo runner and ffmpeg speed-adjuster
│   ├── run-eval.js           # Automated eval test harness calling local tutor API
│   └── summarize-eval.js     # Validates labels and prints evaluation breakdown
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

1. No extra scenarios such as dams, roads or bridges: one scenario already covers three decisions and two endings, and more would multiply test and eval work without proving anything new.
2. No user accounts or saved progress: the sheet puts them out of scope, and personalization already works within a session.
3. No native mobile app: a web app that runs on a phone meets the requirement without app-store overhead.

---

## Completing the Eval

When the Gemini API free-tier quota resets, run the following steps to collect the 4 missing replies and update the evaluation:

1. Restart the application server:
   ```bash
   npm run app
   ```
2. Run the eval runner on the 4 missing messages (the script will refuse to overwrite any existing file):
   ```bash
   npm run eval -- --only 15,17,18,19 --out eval/results-run2-retry2.csv
   ```
3. Merge the new rows into `eval/results-run2.csv` (this updates rows 15, 17, 18, and 19 while recording the `source_file` provenance):
   ```bash
   npm run merge-eval eval/results-run2-retry2.csv
   ```
4. Review the merged replies, assign approved labels, and update the summary metrics:
   ```bash
   npm run summarize-eval eval/results-run2.csv
   ```

---

## Known Limitations

- **Answer Leak Filter Scope**: The leak filter matches only explicit phrases such as "choose A", "choose B", "pick A", "pick B", "the answer is", and "yes, it is" and does not catch every subtle or indirect way of recommending an option. Note that the filter never fired in Run 2 because all model replies were organic Socratic questions.
- **Server Filter Test Coverage**: The server filter is not covered by a Cypress test (the Cypress AC4 test mocks the API endpoint to verify client-side safeguard handling).
- **Run 1 vs Run 2 Model Variance**: Run 1 used two Gemini models (`gemini-3-flash-preview` and `gemini-3.5-flash`) because of quota limits, so Run 1 and Run 2 are not a controlled comparison (different models, different prompts, and an answer leak filter in Run 2).
- **Free-Tier Rate Limits & Quota**: Free-tier daily rate limits (20 requests/day per project/model) caused API failures (HTTP 429/503) that were retried with exponential backoffs; 4 of 20 replies in Run 2 are currently missing and pending a rerun when the daily quota resets.
- **Graders API Key Requirement**: Graders need their own `GEMINI_API_KEY` set in `.env` (or environment variables) to run the AI tutor locally with live Gemini API responses.
- **Dev Server Startup**: The first Cypress run can be slow because the dev server compiles on first load; the suite includes a warm-up step.
- **Session Progress Persistence**: State is stored in memory during the active browser session. Refreshing the browser returns to the intake screen; no persistent user database or external authentication is utilized (in accordance with spec scope).
- **Audio Feedback**: The application focuses on responsive mobile visual elements (countdown timer, monospace clock, status indicators, animated sheets) and does not play audio alerts.
