# Data Dictionary - `data/sessions.csv`

This document defines the schema, field descriptions, allowed values, and distinctions between model features and analysis fields for player session telemetry (`data/sessions.csv`) collected in Data On-Call v2 (YZM301).

---

## 1. Privacy & Data Protection Notice
- **No Personal Data:** The system does not collect or store any player names, email addresses, phone numbers, IP addresses, device identifiers, hardware fingerprints, browser user-agent headers, or geographical locations.
- **Random Session Identifier:** The `session_id` column is a purely random hexadecimal token generated on the client using `crypto.getRandomValues`. It contains no mathematical or logical relation to player identity, network origin, device, or time zone.
- **Regulatory Compliance:** Designed in full compliance with KVKK (Turkey's Personal Data Protection Law) and international data protection standards. All telemetry records represent synthetic simulation decisions and are processed anonymously solely for machine learning evaluation and pedagogical gameplay flow analysis.

---

## 2. Model Features vs. Analysis Fields

| Category | Columns | Description |
|---|---|---|
| **Model Features** | `level`, `goal`, `scene_no`, `prev_hints_used`, `prev_risky_count`, `prev_timeout_count`, `prev_decision_time_sec` | Known strictly at the **start** of the scene before any player interaction. The model uses only these features at prediction time. Nothing from the current scene can be used as a model input (preventing target and temporal leakage). |
| **Target Label** | `chose_risky` | Binary classification target (`0` or `1`) that the model aims to predict. |
| **Analysis Fields (Non-Feature)** | `hint_used_this_scene`, `decision_time_sec` | **Logged for analysis, NOT a model feature (describes the current scene).** Observed only after a decision is made and recorded for post-hoc analysis; strictly prohibited from model feature input. |
| **Metadata** | `session_id`, `source` | Used for session grouping (Grouped CV / Leave-One-Session-Out) and data provenance verification. |

---

## 3. Column Specifications & Value Ranges

### 1. `session_id`
- **Description:** Unique random session identifier generated client-side per playthrough.
- **Role:** Metadata (grouping key for Grouped CV / Leave-One-Session-Out).
- **Type / Unit:** String (hexadecimal string, 16–64 characters).
- **Allowed Values:** Lowercase hexadecimal characters matching regex `^[a-f0-9]{16,64}$`.
- **Collection Method:** Generated on client startup using `crypto.getRandomValues` with fallback.

### 2. `scene_no`
- **Description:** Sequence number of the scene/decision.
- **Role:** **Model Feature**.
- **Type / Unit:** Ordinal integer.
- **Allowed Values:** `1`, `2`, `3`.
- **Collection Method:** Current scene index + 1 in game state machine.

### 3. `level`
- **Description:** Player experience level selected on the intake screen.
- **Role:** **Model Feature**.
- **Type / Unit:** Categorical integer code.
- **Allowed Values:**
  - `0`: Beginner
  - `1`: Experienced
- **Collection Method:** Intake screen selection.

### 4. `goal`
- **Description:** Player learning goal selected on the intake screen.
- **Role:** **Model Feature**.
- **Type / Unit:** Categorical integer code.
- **Allowed Values:**
  - `0`: Internship prep
  - `1`: Keep up with trends
  - `2`: Use AI effectively
- **Collection Method:** Intake screen selection.

### 5. `prev_hints_used`
- **Description:** Total number of hints requested in earlier scenes prior to this scene.
- **Role:** **Model Feature**.
- **Type / Unit:** Integer count.
- **Allowed Values:** `0` to `3` (`0` in scene 1).
- **Collection Method:** Cumulative count accumulated from prior scenes.

### 6. `prev_risky_count`
- **Description:** Total count of risky choices made and timeouts incurred in earlier scenes.
- **Role:** **Model Feature**.
- **Type / Unit:** Integer count.
- **Allowed Values:** `0` to `3` (`0` in scene 1).
- **Collection Method:** Cumulative count accumulated from prior scenes.

### 7. `prev_timeout_count`
- **Description:** Total count of timeouts incurred in earlier scenes.
- **Role:** **Model Feature**.
- **Type / Unit:** Integer count.
- **Allowed Values:** `0` to `3` (`0` in scene 1).
- **Collection Method:** Cumulative count accumulated from prior scenes.

### 8. `prev_decision_time_sec`
- **Description:** Decision duration in seconds taken in the immediately preceding scene.
- **Role:** **Model Feature**.
- **Type / Unit:** Floating-point number (seconds, rounded to 2 decimal places).
- **Allowed Values:** Real numbers $\ge 0.0$ (`0.0` in scene 1).
- **Collection Method:** Elapsed decision time recorded from preceding scene.

### 9. `hint_used_this_scene`
- **Description:** Indicates whether the hint button was opened during the current scene.
- **Role:** **Logged for analysis, NOT a model feature (describes the current scene).**
- **Type / Unit:** Binary integer flag.
- **Allowed Values:**
  - `0`: Hint not opened in this scene
  - `1`: Hint opened in this scene
- **Collection Method:** Tracked via hint button toggle in scene component.

### 10. `decision_time_sec`
- **Description:** Total elapsed time from scene presentation to decision submission or timeout.
- **Role:** **Logged for analysis, NOT a model feature (describes the current scene).**
- **Type / Unit:** Floating-point number (seconds, rounded to 2 decimal places).
- **Allowed Values:** Finite numbers $\ge 0.0$ (practical upper limit $\le 600.0$).
- **Collection Method:** Client-side timestamp delta: `(Date.now() - sceneStartTime) / 1000`.

### 11. `chose_risky`
- **Description:** Supervised binary classification target label indicating whether the choice was risky or timed out.
- **Role:** **Target Label**.
- **Type / Unit:** Binary integer flag.
- **Allowed Values:**
  - `0`: Safe / good choice made (`isGood === true`)
  - `1`: Risky choice made (`isGood === false`) or timeout occurred (`timedOut === true`)
- **Collection Method:** Evaluated by the rule engine upon decision submission or timeout.

### 12. `source`
- **Description:** Provenance origin of the session record.
- **Role:** Metadata.
- **Type / Unit:** String enum.
- **Allowed Values:**
  - `"real"`: Normal live gameplay playthrough
  - `"synthetic"`: Synthetic validation record
- **Collection Method:** Assigned by the telemetry collection service.
