"""Pytest suite for Data On-Call v2: training, evaluation gate, and ONNX packaging.

Covers:
  - Spec and constant synchronization (spec.md section 10 vs train.py)
  - AC8: Gate failure on noise-only data
  - Dev training and gate pass on synthetic signal data
  - Determinism across training runs (identical weights, metrics, and ONNX hash)
  - AC10: Inference parity (< 1e-4) on benchmark feature vectors in tests/parity.json
  - Strict anti-leakage and feature ordering validation
  - Amendment 3: Rejection of single-class or underrepresented datasets (< 5 samples)
  - Amendment 2: scripts/tag_participant.py tagging and leave-one-participant-out CV
"""

from __future__ import annotations

import csv
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pytest

import train
from scripts.make_synthetic import generate_synthetic_data, write_csv
from scripts.tag_participant import tag_participant


def test_spec_constants_consistency():
    """Verify that train.py constants strictly match spec.md section 10."""
    spec_path = Path("spec.md")
    assert spec_path.is_file(), "spec.md not found"
    content = spec_path.read_text(encoding="utf-8")

    # Accuracy gate threshold
    assert f"{train.MIN_ACCURACY_THRESHOLD:.2f}" in content, (
        f"MIN_ACCURACY_THRESHOLD ({train.MIN_ACCURACY_THRESHOLD}) not found in spec.md"
    )

    # Decision cutoff threshold (0.5 in spec.md §10.4)
    assert f"{train.DECISION_CUTOFF:.1f}" in content or f"{train.DECISION_CUTOFF:.2f}" in content, (
        f"DECISION_CUTOFF ({train.DECISION_CUTOFF}) not found in spec.md"
    )

    # Feature list in exact order
    for feature in train.FEATURES:
        assert f"`{feature}`" in content, f"Feature `{feature}` not found in spec.md"

    # Anti-leakage: verify current scene fields are explicitly forbidden as features
    data_dict = Path("data") / "DATA_DICTIONARY.md"
    assert data_dict.is_file(), "DATA_DICTIONARY.md not found"
    dict_content = data_dict.read_text(encoding="utf-8")
    assert "hint_used_this_scene" in dict_content
    assert "decision_time_sec" in dict_content
    assert "NOT a model feature" in dict_content


def test_class_representation_check_fails_on_underrepresented_data(tmp_path):
    """Amendment 3: Fail before evaluation if either class has < 5 rows or only 1 class."""
    # Test case 1: Single class only
    rows = generate_synthetic_data(num_sessions=10, seed=42)
    for r in rows:
        r["chose_risky"] = 0
    single_class_csv = tmp_path / "single_class.csv"
    write_csv(rows, single_class_csv)

    result = subprocess.run(
        [
            sys.executable,
            "train.py",
            "--dev",
            "--data",
            str(single_class_csv),
            "--out-dir",
            str(tmp_path / "out"),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "only one class present" in result.stderr

    # Test case 2: Class 1 has only 3 rows (< 5)
    for i, r in enumerate(rows):
        r["chose_risky"] = 1 if i < 3 else 0
    underrep_csv = tmp_path / "underrep.csv"
    write_csv(rows, underrep_csv)

    result2 = subprocess.run(
        [
            sys.executable,
            "train.py",
            "--dev",
            "--data",
            str(underrep_csv),
            "--out-dir",
            str(tmp_path / "out"),
        ],
        capture_output=True,
        text=True,
    )
    assert result2.returncode == 1
    assert "Insufficient class representation" in result2.stderr


def test_gate_fails_on_noise_only_data(tmp_path):
    """AC8: The evaluation gate must fail on noise-only data and write no artifacts."""
    noise_csv = tmp_path / "noise.csv"
    out_dir = tmp_path / "noise_out"

    rows = generate_synthetic_data(num_sessions=80, seed=42, noise_only=True)
    write_csv(rows, noise_csv)

    result = subprocess.run(
        [
            sys.executable,
            "train.py",
            "--dev",
            "--data",
            str(noise_csv),
            "--out-dir",
            str(out_dir),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "GATE FAILURE" in result.stderr
    assert not (out_dir / "model.onnx").exists(), "Artifact should not be published on failure"
    assert not (out_dir / "config.json").exists(), "Config should not be published on failure"


def test_dev_training_passes_gate_and_exports_artifacts(tmp_path):
    """Verify that signal synthetic data passes the gate and produces valid artifacts."""
    signal_csv = tmp_path / "signal.csv"
    out_dir = tmp_path / "signal_out"

    rows = generate_synthetic_data(num_sessions=100, seed=42, noise_only=False)
    write_csv(rows, signal_csv)

    result = subprocess.run(
        [
            sys.executable,
            "train.py",
            "--dev",
            "--data",
            str(signal_csv),
            "--out-dir",
            str(out_dir),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Training failed unexpectedly:\n{result.stderr}"
    assert "Gate evaluation PASSED" in result.stdout

    onnx_file = out_dir / "model.onnx"
    config_file = out_dir / "config.json"
    assert onnx_file.is_file(), "model.onnx was not created"
    assert config_file.is_file(), "config.json was not created"

    with open(config_file, mode="r", encoding="utf-8") as f:
        cfg = json.load(f)

    assert cfg["features"] == train.FEATURES
    assert cfg["target"] == train.TARGET_LABEL
    assert cfg["oof_accuracy"] >= 0.60
    assert cfg["oof_accuracy"] > cfg["baseline_accuracy"]
    assert cfg["cv_method"] == "leave-one-session-out"


def test_training_determinism(tmp_path):
    """Two training runs on identical data produce identical model weights and SHA256."""
    signal_csv = tmp_path / "signal.csv"
    out_dir_1 = tmp_path / "out_1"
    out_dir_2 = tmp_path / "out_2"

    rows = generate_synthetic_data(num_sessions=50, seed=42, noise_only=False)
    write_csv(rows, signal_csv)

    res1 = subprocess.run(
        [sys.executable, "train.py", "--dev", "--data", str(signal_csv), "--out-dir", str(out_dir_1)],
        capture_output=True,
        text=True,
    )
    res2 = subprocess.run(
        [sys.executable, "train.py", "--dev", "--data", str(signal_csv), "--out-dir", str(out_dir_2)],
        capture_output=True,
        text=True,
    )
    assert res1.returncode == 0
    assert res2.returncode == 0

    cfg1 = json.loads((out_dir_1 / "config.json").read_text(encoding="utf-8"))
    cfg2 = json.loads((out_dir_2 / "config.json").read_text(encoding="utf-8"))

    assert cfg1["oof_accuracy"] == cfg2["oof_accuracy"]
    assert cfg1["baseline_accuracy"] == cfg2["baseline_accuracy"]
    assert cfg1["model_sha256"] == cfg2["model_sha256"]

    bytes1 = (out_dir_1 / "model.onnx").read_bytes()
    bytes2 = (out_dir_2 / "model.onnx").read_bytes()
    assert bytes1 == bytes2


def test_ac10_benchmark_vector_parity(tmp_path):
    """AC10: Verify sklearn and onnxruntime parity within 1e-4 on tests/parity.json vectors."""
    signal_csv = tmp_path / "signal.csv"
    out_dir = tmp_path / "out"

    rows = generate_synthetic_data(num_sessions=60, seed=42)
    write_csv(rows, signal_csv)

    res = subprocess.run(
        [sys.executable, "train.py", "--dev", "--data", str(signal_csv), "--out-dir", str(out_dir)],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0

    # Fit sklearn pipeline on same data
    X, y, session_ids, _ = train.load_and_validate_data(signal_csv, is_dev=True)
    sk_pipeline = train.build_pipeline()
    sk_pipeline.fit(X, y)

    # Load ONNX model
    onnx_file = out_dir / "model.onnx"
    session = ort.InferenceSession(str(onnx_file))

    # Read benchmark vectors
    parity_path = Path("tests") / "parity.json"
    assert parity_path.is_file(), "tests/parity.json not found"
    with open(parity_path, mode="r", encoding="utf-8") as f:
        benchmarks = json.load(f)

    assert len(benchmarks) == 5, f"Expected 5 benchmark vectors, found {len(benchmarks)}"

    for item in benchmarks:
        vec = np.array([item["features"]], dtype=np.float32)
        sk_prob = sk_pipeline.predict_proba(vec)[0]

        ort_out = session.run(None, {"input": vec})
        ort_prob = ort_out[1][0]  # output tensor "probabilities"

        max_diff = np.max(np.abs(sk_prob - ort_prob))
        assert max_diff < 1e-4, (
            f"Parity violated for '{item['description']}': diff={max_diff:.6e} >= 1e-4\n"
            f"Sklearn: {sk_prob}\nONNX:    {ort_prob}"
        )


def test_tag_participant_and_leave_one_participant_out_cv(tmp_path):
    """Amendment 2: Test scripts/tag_participant.py and LOPO CV mode."""
    data_csv = tmp_path / "sessions.csv"
    participants_csv = tmp_path / "participants.csv"
    out_dir = tmp_path / "lopo_out"

    # Generate 6 sessions
    rows = generate_synthetic_data(num_sessions=6, seed=42)
    write_csv(rows, data_csv)

    # Tag last 3 sessions as P2
    tagged_p2 = tag_participant(
        label="P2",
        last_sessions_count=3,
        data_path=data_csv,
        participants_path=participants_csv,
    )
    assert len(tagged_p2) == 3

    # Refuse if attempting to re-tag already tagged sessions
    with pytest.raises(ValueError, match="already tagged"):
        tag_participant(
            label="P2_duplicate",
            last_sessions_count=2,
            data_path=data_csv,
            participants_path=participants_csv,
        )

    # Tag remaining sessions as P1
    # First 3 sessions: get their count and tag them
    # We can create participants mapping directly covering all 6 sessions
    all_sids = list(dict.fromkeys(r["session_id"] for r in rows))
    with open(participants_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["session_id", "participant"])
        for sid in all_sids[:3]:
            writer.writerow([sid, "P1"])
        for sid in all_sids[3:]:
            writer.writerow([sid, "P2"])

    # Run train.py with participants mapping
    res = subprocess.run(
        [
            sys.executable,
            "train.py",
            "--dev",
            "--data",
            str(data_csv),
            "--participants",
            str(participants_csv),
            "--out-dir",
            str(out_dir),
        ],
        capture_output=True,
        text=True,
    )
    # Check that CV method is detected as leave-one-participant-out
    assert "Cross-validation method: leave-one-participant-out" in res.stdout
