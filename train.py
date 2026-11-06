"""Training pipeline, evaluation gate, and ONNX packaging for Data On-Call v2.

Pre-registered constants and evaluation metrics strictly adhere to spec.md §10.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# ==============================================================================
# Pre-registered constants (spec.md §10)
# A dedicated test verifies that spec.md and these constants stay strictly synchronized.
# ==============================================================================
FEATURES: list[str] = [
    "level",
    "goal",
    "scene_no",
    "prev_hints_used",
    "prev_risky_count",
    "prev_timeout_count",
    "prev_decision_time_sec",
]  # spec.md §10.2

TARGET_LABEL: str = "chose_risky"  # spec.md §10.2
MIN_ACCURACY_THRESHOLD: float = 0.60  # spec.md §10.3 (Accuracy gate threshold >= 0.60)
DECISION_CUTOFF: float = 0.50  # spec.md §10.4 (Prediction cutoff threshold >= 0.50)
RANDOM_STATE: int = 42

HEX_SESSION_REGEX = re.compile(r"^[a-f0-9]{16,64}$")
EXPECTED_COLUMNS: list[str] = [
    "session_id",
    "scene_no",
    "level",
    "goal",
    "prev_hints_used",
    "prev_risky_count",
    "prev_timeout_count",
    "prev_decision_time_sec",
    "hint_used_this_scene",
    "decision_time_sec",
    "chose_risky",
    "source",
]


def load_and_validate_data(
    data_path: Path,
    is_dev: bool = False,
    allow_synthetic: bool = False,
) -> tuple[np.ndarray, np.ndarray, list[str], list[dict[str, Any]]]:
    """Load session data and validate schema, value ranges, and privacy."""
    if not data_path.is_file():
        sys.stderr.write(f"ERROR: Data file not found: {data_path}\n")
        sys.exit(1)

    rows: list[dict[str, Any]] = []
    with open(data_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != EXPECTED_COLUMNS:
            sys.stderr.write(
                f"ERROR: CSV columns mismatch.\nExpected: {EXPECTED_COLUMNS}\nFound:    {reader.fieldnames}\n"
            )
            sys.exit(1)
        for idx, row in enumerate(reader, start=2):
            rows.append(row)

    if not rows:
        sys.stderr.write(f"ERROR: Data file {data_path} is empty.\n")
        sys.exit(1)

    # Check session integrity and ranges
    sessions_seen: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        sid = r["session_id"]
        if not HEX_SESSION_REGEX.match(sid):
            sys.stderr.write(
                f"ERROR: Invalid session_id format '{sid}'. Must be a 16-64 char lowercase hex string.\n"
            )
            sys.exit(1)

        source = r["source"]
        if source not in ("real", "synthetic"):
            sys.stderr.write(f"ERROR: Invalid source value '{source}'.\n")
            sys.exit(1)

        if source == "synthetic" and not (is_dev or allow_synthetic):
            sys.stderr.write(
                f"ERROR: Synthetic data found in {data_path}. Running without --dev is prohibited on synthetic data.\n"
            )
            sys.exit(1)

        try:
            scene_no = int(r["scene_no"])
            level = int(r["level"])
            goal = int(r["goal"])
            prev_hints = int(r["prev_hints_used"])
            prev_risky = int(r["prev_risky_count"])
            prev_timeouts = int(r["prev_timeout_count"])
            prev_dec_time = float(r["prev_decision_time_sec"])
            hint_curr = int(r["hint_used_this_scene"])
            dec_time = float(r["decision_time_sec"])
            chose_risky = int(r["chose_risky"])
        except ValueError as err:
            sys.stderr.write(f"ERROR: Non-numeric data found in row: {err}\n")
            sys.exit(1)

        # Value range checks
        if scene_no not in (1, 2, 3):
            sys.stderr.write(f"ERROR: Invalid scene_no {scene_no}.\n")
            sys.exit(1)
        if level not in (0, 1):
            sys.stderr.write(f"ERROR: Invalid level {level}.\n")
            sys.exit(1)
        if goal not in (0, 1, 2):
            sys.stderr.write(f"ERROR: Invalid goal {goal}.\n")
            sys.exit(1)
        if prev_hints < 0 or prev_hints > 3:
            sys.stderr.write(f"ERROR: Invalid prev_hints_used {prev_hints}.\n")
            sys.exit(1)
        if prev_risky < 0 or prev_risky > 3:
            sys.stderr.write(f"ERROR: Invalid prev_risky_count {prev_risky}.\n")
            sys.exit(1)
        if prev_timeouts < 0 or prev_timeouts > 3:
            sys.stderr.write(f"ERROR: Invalid prev_timeout_count {prev_timeouts}.\n")
            sys.exit(1)
        if prev_dec_time < 0.0:
            sys.stderr.write(f"ERROR: Invalid prev_decision_time_sec {prev_dec_time}.\n")
            sys.exit(1)
        if hint_curr not in (0, 1):
            sys.stderr.write(f"ERROR: Invalid hint_used_this_scene {hint_curr}.\n")
            sys.exit(1)
        if dec_time < 0.0:
            sys.stderr.write(f"ERROR: Invalid decision_time_sec {dec_time}.\n")
            sys.exit(1)
        if chose_risky not in (0, 1):
            sys.stderr.write(f"ERROR: Invalid chose_risky {chose_risky}.\n")
            sys.exit(1)

        if scene_no == 1:
            if (
                prev_hints != 0
                or prev_risky != 0
                or prev_timeouts != 0
                or prev_dec_time != 0.0
            ):
                sys.stderr.write(
                    f"ERROR: Scene 1 must have 0 for all previous accumulated metrics (session {sid}).\n"
                )
                sys.exit(1)

        sessions_seen.setdefault(sid, []).append(r)

    # Verify every session has exactly 3 consecutive scenes (1, 2, 3)
    for sid, s_rows in sessions_seen.items():
        if len(s_rows) != 3:
            sys.stderr.write(
                f"ERROR: Session {sid} has {len(s_rows)} rows (must have exactly 3).\n"
            )
            sys.exit(1)
        s_scenes = [int(r["scene_no"]) for r in s_rows]
        if s_scenes != [1, 2, 3]:
            sys.stderr.write(
                f"ERROR: Session {sid} scenes are {s_scenes}, expected [1, 2, 3].\n"
            )
            sys.exit(1)

    # Count real sessions
    real_sessions = {
        sid for sid, s_rows in sessions_seen.items() if s_rows[0]["source"] == "real"
    }
    if not is_dev and len(real_sessions) < 15:
        sys.stderr.write(
            f"ERROR: Insufficient real data: found {len(real_sessions)} real session(s), "
            f"minimum required is 15. Run with --dev to evaluate on synthetic data.\n"
        )
        sys.exit(1)

    # Extract X (features in exact order) and y (chose_risky)
    X_list: list[list[float]] = []
    y_list: list[int] = []
    session_ids: list[str] = []

    for r in rows:
        feature_vals = [float(r[col]) for col in FEATURES]
        X_list.append(feature_vals)
        y_list.append(int(r[TARGET_LABEL]))
        session_ids.append(r["session_id"])

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=int)

    # Amendment 3: Class check before any evaluation
    count_0 = int(np.sum(y == 0))
    count_1 = int(np.sum(y == 1))
    if count_0 == 0 or count_1 == 0:
        sys.stderr.write(
            f"ERROR: Target class '{TARGET_LABEL}' has only one class present (0s: {count_0}, 1s: {count_1}). "
            f"Both classes must be represented.\n"
        )
        sys.exit(1)
    if count_0 < 5 or count_1 < 5:
        sys.stderr.write(
            f"ERROR: Insufficient class representation: class 0 has {count_0} rows, "
            f"class 1 has {count_1} rows. Both classes must have at least 5 rows.\n"
        )
        sys.exit(1)

    return X, y, session_ids, rows


def determine_cross_validation_groups(
    session_ids: list[str],
    participants_path: Path,
) -> tuple[np.ndarray, str, int]:
    """Determine CV method and group assignment per Amendment 2."""
    distinct_sessions = set(session_ids)
    if participants_path.is_file():
        participants_map: dict[str, str] = {}
        with open(participants_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                sid = r.get("session_id")
                p = r.get("participant")
                if sid and p:
                    participants_map[sid] = p.strip()

        # If participants.csv covers every session in training data
        if distinct_sessions.issubset(set(participants_map.keys())):
            groups = np.array([participants_map[sid] for sid in session_ids])
            distinct_participants = len(set(groups))
            return groups, "leave-one-participant-out", distinct_participants

    # Otherwise fallback to leave-one-session-out
    groups = np.array(session_ids)
    return groups, "leave-one-session-out", len(distinct_sessions)


def build_pipeline() -> Pipeline:
    """Construct pre-registered scikit-learn Pipeline (spec.md §10.1)."""
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    C=1.0,
                    max_iter=1000,
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )


def evaluate_gate(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
) -> tuple[float, float, bool]:
    """Execute Leave-One-Group-Out CV and evaluate pre-registered gate (spec.md §10.3)."""
    logo = LeaveOneGroupOut()
    oof_preds = np.zeros(len(y), dtype=int)
    baseline_preds = np.zeros(len(y), dtype=int)

    for train_idx, test_idx in logo.split(X, y, groups):
        X_train, y_train = X[train_idx], y[train_idx]
        X_test, y_test = X[test_idx], y[test_idx]

        # Baseline: majority class in the training fold
        train_maj = 1 if np.sum(y_train == 1) > np.sum(y_train == 0) else 0
        baseline_preds[test_idx] = train_maj

        # Train model
        pipe = build_pipeline()
        pipe.fit(X_train, y_train)

        # Predict probability of chose_risky=1
        probs = pipe.predict_proba(X_test)
        preds = (probs[:, 1] >= DECISION_CUTOFF).astype(int)
        oof_preds[test_idx] = preds

    oof_accuracy = float(np.mean(oof_preds == y))
    baseline_accuracy = float(np.mean(baseline_preds == y))

    # Gate check (spec.md §10.3): >= 0.60 AND strictly > baseline
    gate_passed = (oof_accuracy >= MIN_ACCURACY_THRESHOLD) and (
        oof_accuracy > baseline_accuracy
    )
    return oof_accuracy, baseline_accuracy, gate_passed


def export_and_verify_onnx(
    pipeline: Pipeline,
    X: np.ndarray,
    onnx_path: Path,
) -> str:
    """Export pipeline to ONNX and verify onnxruntime numerical parity within 1e-4."""
    initial_type = [("input", FloatTensorType([1, len(FEATURES)]))]
    onnx_model = to_onnx(pipeline, initial_types=initial_type, options={"zipmap": False})

    # Write temporarily to verify
    temp_path = onnx_path.with_suffix(".tmp")
    with open(temp_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    # Verify parity using onnxruntime
    session = ort.InferenceSession(str(temp_path))
    max_diff = 0.0

    for i in range(len(X)):
        row = X[i : i + 1]
        sk_proba = pipeline.predict_proba(row)[0]
        ort_out = session.run(None, {"input": row})
        ort_proba = ort_out[1][0]  # output tensor "probabilities"

        diff = float(np.max(np.abs(sk_proba - ort_proba)))
        if diff > max_diff:
            max_diff = diff

    if max_diff >= 1e-4:
        temp_path.unlink(missing_ok=True)
        sys.stderr.write(
            f"ERROR: ONNX parity check failed! Max discrepancy {max_diff:.6e} >= 1e-4\n"
        )
        sys.exit(1)

    # Atomic rename
    temp_path.replace(onnx_path)

    # Compute sha256
    with open(onnx_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    return sha256


def train(
    data_path: Path,
    out_dir: Path,
    participants_path: Path,
    is_dev: bool = False,
    allow_synthetic: bool = False,
) -> None:
    print(f"--- Starting Data On-Call v2 Model Training ---")
    print(f"Data source: {data_path}")
    print(f"Dev mode:    {is_dev}")

    X, y, session_ids, rows = load_and_validate_data(
        data_path=data_path,
        is_dev=is_dev,
        allow_synthetic=allow_synthetic,
    )

    groups, cv_method, num_groups = determine_cross_validation_groups(
        session_ids=session_ids,
        participants_path=participants_path,
    )

    num_sessions = len(set(session_ids))
    print(f"Loaded {len(y)} rows ({num_sessions} distinct sessions).")
    print(f"Cross-validation method: {cv_method} ({num_groups} groups).")

    # Evaluate gate
    oof_accuracy, baseline_accuracy, gate_passed = evaluate_gate(
        X=X,
        y=y,
        groups=groups,
    )

    print(f"Out-of-fold Accuracy: {oof_accuracy:.4f}")
    print(f"Baseline Accuracy:    {baseline_accuracy:.4f}")
    print(f"Threshold Gate:       {MIN_ACCURACY_THRESHOLD:.2f}")

    if not gate_passed:
        sys.stderr.write(
            f"\nGATE FAILURE (spec.md §10.3 / AC8):\n"
            f"Model accuracy ({oof_accuracy:.4f}) failed to exceed the 0.60 threshold "
            f"or the majority baseline ({baseline_accuracy:.4f}).\n"
            f"Model artifact not published.\n"
        )
        sys.exit(1)

    print("Gate evaluation PASSED.")

    # Train final model on all data
    final_pipeline = build_pipeline()
    final_pipeline.fit(X, y)

    # Target directory safety
    if is_dev:
        if out_dir.resolve() == Path("model").resolve():
            out_dir = Path("build") / "dev"
    out_dir.mkdir(parents=True, exist_ok=True)

    onnx_file = out_dir / "model.onnx"
    config_file = out_dir / "config.json"

    sha256 = export_and_verify_onnx(
        pipeline=final_pipeline,
        X=X,
        onnx_path=onnx_file,
    )

    config_data = {
        "features": FEATURES,
        "target": TARGET_LABEL,
        "model_type": "LogisticRegression",
        "cv_method": cv_method,
        "num_sessions": num_sessions,
        "num_rows": len(y),
        "num_participants": num_groups if "participant" in cv_method else None,
        "oof_accuracy": round(oof_accuracy, 4),
        "baseline_accuracy": round(baseline_accuracy, 4),
        "gate_threshold": MIN_ACCURACY_THRESHOLD,
        "decision_cutoff": DECISION_CUTOFF,
        "model_sha256": sha256,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    config_temp = config_file.with_suffix(".tmp")
    with open(config_temp, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)
    config_temp.replace(config_file)

    print(f"Successfully packaged model to {out_dir}")
    print(f"  Artifact: {onnx_file} (SHA256: {sha256[:16]}...)")
    print(f"  Config:   {config_file}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train, evaluate, and package the Data On-Call v2 risk prediction model."
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("data") / "sessions.csv",
        help="Path to sessions CSV file (default: data/sessions.csv).",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: model/ for production, build/dev/ for dev mode).",
    )
    parser.add_argument(
        "--participants",
        type=Path,
        default=Path("data") / "participants.csv",
        help="Path to participants mapping CSV (default: data/participants.csv).",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Run in development mode (allows synthetic data, writes to build/dev/, no 15-session gate).",
    )
    parser.add_argument(
        "--allow-synthetic",
        action="store_true",
        help="Allow synthetic data without changing the output directory.",
    )

    args = parser.parse_args()

    out_dir = args.out_dir
    if out_dir is None:
        out_dir = Path("build") / "dev" if args.dev else Path("model")

    train(
        data_path=args.data,
        out_dir=out_dir,
        participants_path=args.participants,
        is_dev=args.dev,
        allow_synthetic=args.allow_synthetic,
    )


if __name__ == "__main__":
    main()
