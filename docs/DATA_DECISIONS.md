# Data Decisions & Telemetry Repair Record

- **Date & Time:** 2026-11-06T09:36:00+03:00
- **Base Commit Hash:** `9c397a8dfaa7500f1cd1ac7c113f23a264582292`
- **Raw Telemetry File:** `data/sessions_raw.csv`
- **SHA-256 (`data/sessions_raw.csv`):** `f7217a76d8ef62d52336815dc4348c44a8d777e36fa5e75d373c1f6ad5da850d`

---

## 1. Summary of Finding

During Step 1 pre-training data verification on `data/sessions.csv`, the following telemetry anomaly was identified:
- Expected: 45 rows across 15 sessions (3 scenes per session).
- Observed: 54 rows across 15 distinct `session_id` values.
- Specifically, 12 sessions had exactly 3 rows, while 3 sessions (`261ba306532dec0e087893add106d337`, `2555c65dd4c98f350df173857a22a84f`, and `276e58a6a28b5a354df527176a001d0c`) contained 6 rows each (two complete 3-scene playthroughs logged under the same `session_id`).

## 2. Root Cause Analysis

In `src/App.tsx`:
- The `handlePlayAgain` and `handleStartShift` functions generated a new `sessionId` via `generateSessionId()`.
- However, the `handleChangeAnswers` ("Change my answers") and `handleLevelChange` ("Try Experienced mode" / "Try Beginner mode") restart callbacks in `App.tsx` reset decision choices and cumulative telemetry counters, but **omitted** regenerating `sessionId`.
- Consequently, when participants clicked "Try Beginner mode" or "Try Experienced mode" upon completing a run, their subsequent playthrough was logged under the previous playthrough's `session_id`.

## 3. Application Fix

- Fixed in `src/App.tsx` by consolidating session reset logic into `resetSessionState()`, ensuring that **every** restart path (`handlePlayAgain`, `handleChangeAnswers`, `handleLevelChange`, and `handleStartShift`) generates a fresh random 32-character hex `sessionId` and zeroes all cumulative counters (`hintsCount`, `riskyCount`, `timeoutsCount`, `lastDecisionTimeSec`, `decisionIndex`).
- Verified via Cypress acceptance test (`cypress/e2e/data-logging.cy.js`) covering all three restart paths, confirming that the next scene 1 record carries a fresh `session_id` and all `prev_*` values are strictly zero.

## 4. Mechanical Data Repair (Label-Blind)

Rather than deleting legitimate gameplay data, a mechanical, label-blind split was performed using `scripts/split_playthroughs.py`:
- **Label-Blind Rule:** A new playthrough boundary was initiated whenever `scene_no == 1` was encountered within an already-active `session_id`. No feature values or target labels (`chose_risky`) were consulted or altered.
- **Deterministic ID Generation:**
  - The first playthrough of a session retained its original `session_id`.
  - The second playthrough was assigned a deterministic 32-character hex ID: the first 32 characters of `sha256("<original_id>:2")`.
- **Integrity Validation:** Every playthrough was checked to confirm that scenes 1, 2, 3 appeared exactly once, scene 1 had zero `prev_*` values, and cumulative metrics in scenes 2 and 3 matched prior rows.
- **Diff Verification:** Exactly 9 rows were modified (rows 25–27, 34–36, 46–48). Across the entire file, **only** the `session_id` column changed in those 9 rows; all other 11 column values and row order remained byte-identical.
- **Timing:** This repair was performed strictly **prior to any model training run**, ensuring the evaluation gate and training process remain completely uncontaminated.
