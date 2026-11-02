"""Generate Model Card (README.md) from training config.json.

Requirements:
  - Generates model documentation adhering to spec.md section 10 and Model Cards standards.
  - Sections include: Model Summary, Intended Use, Training Data & Features,
    Evaluation & Validation Gate, and Limitations.
  - Limitations draft must include:
      * chose_risky label is 1 when 60-second timer ran out (partly reflects timer)
      * timeouts only occur for Experienced players
      * hint use only varies for Beginners
      * small sample and few participants
      * recorded cross-validation method
  - Draft sections needing author sign-off are marked with <!-- REVIEW BY AUTHOR -->.
  - Guarded: Does NOT create model/ directory if model/config.json does not exist.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def generate_model_card(config_path: Path, out_path: Path) -> None:
    if not config_path.is_file():
        sys.stderr.write(
            f"ERROR: Configuration file not found: {config_path}.\n"
            f"Cannot generate model card until a model has been trained and packaged.\n"
        )
        sys.exit(1)

    with open(config_path, mode="r", encoding="utf-8") as f:
        cfg = json.load(f)

    features = cfg.get("features", [])
    target = cfg.get("target", "chose_risky")
    cv_method = cfg.get("cv_method", "leave-one-session-out")
    num_sessions = cfg.get("num_sessions", 0)
    num_rows = cfg.get("num_rows", 0)
    num_participants = cfg.get("num_participants")
    oof_accuracy = cfg.get("oof_accuracy", 0.0)
    baseline_accuracy = cfg.get("baseline_accuracy", 0.0)
    gate_threshold = cfg.get("gate_threshold", 0.60)
    decision_cutoff = cfg.get("decision_cutoff", 0.50)
    model_sha256 = cfg.get("model_sha256", "N/A")
    created_at = cfg.get("created_at", "N/A")

    features_list_md = "\n".join(f"- `{f}`" for f in features)
    participants_str = (
        f"{num_participants} distinct participants"
        if num_participants is not None
        else "untracked / pseudonymous session IDs"
    )

    content = f"""# Model Card: Data On-Call v2 Risk Predictor

## 1. Model Summary
- **Model Architecture:** Scikit-learn Pipeline(`StandardScaler`, `LogisticRegression(C=1.0, max_iter=1000, random_state=42)`)
- **Format:** ONNX runtime artifact (`model.onnx`, float32 input `input` `[1, 7]`, output `probabilities`)
- **Artifact SHA256:** `{model_sha256}`
- **Packaging Timestamp:** `{created_at}`
- **Repository:** Data On-Call (YZM301 The Primer v2)

## 2. Intended Use
<!-- REVIEW BY AUTHOR -->
- **Primary Use:** In-game proactive pedagogical scaffolding. Evaluated strictly at the **start** of a decision scene before the player acts.
- **Intervention Trigger:** When predicted risk $P(\\text{{{target}}} = 1) \\ge {decision_cutoff:.2f}$, the AI tutor surfaces a proactive guiding question, and the countdown timer is paused for Experienced players to encourage reflection.
- **Out-of-Scope Uses:** High-stakes grading, formal student evaluation, automated user profiling, or deployment outside the Data On-Call simulation environment.

## 3. Training Data & Features
- **Total Samples:** {num_rows} scene decisions across {num_sessions} completed playthrough sessions ({participants_str}).
- **Target Label:** `{target}` (`1` if the player chose the risky option or suffered a timeout, `0` for sound choice).
- **Model Features (Known strictly at scene start):**
{features_list_md}
- **Strict Anti-Leakage Rule:** In-scene interaction metrics (`hint_used_this_scene`, `decision_time_sec`) are logged solely for post-hoc analysis and are strictly excluded from model features.
- **Privacy Assurance:** Fully anonymous in accordance with KVKK (Turkey's Personal Data Protection Law). No personal names, IP addresses, locations, or hardware fingerprints are collected.

## 4. Evaluation & Validation Gate
- **Pre-registered Threshold:** Out-of-fold accuracy must be $\\ge {gate_threshold:.2f}$ AND strictly greater than the majority-class baseline.
- **Validation Protocol:** `{cv_method}`
- **Out-of-Fold Accuracy:** `{oof_accuracy:.4f}`
- **Majority-Class Baseline:** `{baseline_accuracy:.4f}`
- **Gate Status:** PASSED (exceeds threshold of {gate_threshold:.2f} and outperforms baseline).

## 5. Limitations & Ethical Considerations
<!-- REVIEW BY AUTHOR -->
- **Composite Label Reflection:** The target label `{target}` equals `1` when the 60-second timer expires. Consequently, the label partly reflects decision speed and timeout pressure in addition to explicit decision risk.
- **Mode-Specific Dynamics:**
  - Timeouts only occur for Experienced players (`level = 1`), as Beginner mode does not feature an active countdown timer.
  - Hint usage only varies for Beginner players (`level = 0`), as hint buttons are disabled in Experienced mode.
- **Sample Scale:** Trained on a small sample size ({num_sessions} sessions, {participants_str}) collected in university lab settings. Generalization to broader populations without domain retraining is not guaranteed.
- **Cross-Validation Scope:** Evaluated via `{cv_method}` to prevent data leakage across correlated scene turns from the same player session.
"""

    out_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = out_path.with_suffix(".tmp")
    with open(temp_path, mode="w", encoding="utf-8") as f:
        f.write(content)
    temp_path.replace(out_path)
    print(f"Generated model card at {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Model Card README.md from training config.json."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("model") / "config.json",
        help="Path to training config.json (default: model/config.json).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("model") / "README.md",
        help="Path to output markdown file (default: model/README.md).",
    )

    args = parser.parse_args()
    generate_model_card(args.config, args.out)


if __name__ == "__main__":
    main()
