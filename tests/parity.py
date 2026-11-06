"""Parity verification script for Data On-Call v2.

Loads model/model.onnx and tests/parity.json with onnxruntime, prints each
probability and expected value, and exits with code 1 if any |difference| >= 1e-4.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

TOLERANCE = 1e-4


def verify_parity(
    model_path: Path = Path("model") / "model.onnx",
    vectors_path: Path = Path("tests") / "parity.json",
    tolerance: float = TOLERANCE,
    verbose: bool = True,
) -> bool:
    """Verify numerical parity of onnxruntime predictions against expected values."""
    if not model_path.is_file():
        sys.stderr.write(f"ERROR: Model artifact not found: {model_path}\n")
        return False

    if not vectors_path.is_file():
        sys.stderr.write(f"ERROR: Benchmark parity file not found: {vectors_path}\n")
        return False

    with open(vectors_path, mode="r", encoding="utf-8") as f:
        vectors = json.load(f)

    if not isinstance(vectors, list) or len(vectors) == 0:
        sys.stderr.write(f"ERROR: No benchmark vectors found in {vectors_path}\n")
        return False

    session = ort.InferenceSession(str(model_path))
    all_passed = True

    if verbose:
        print(f"=== Running Inference Parity Check ({model_path}) ===")
        print(f"Tolerance threshold: {tolerance:.1e}\n")

    for i, item in enumerate(vectors, start=1):
        desc = item.get("description", f"Vector #{i}")
        features = item.get("features", [])
        expected = item.get("expected_probability")

        if expected is None:
            sys.stderr.write(f"ERROR: Vector #{i} is missing 'expected_probability'\n")
            return False

        vec = np.array([features], dtype=np.float32)
        ort_out = session.run(None, {"input": vec})
        # Output 1 is "probabilities", shape [1, 2], column 1 is P(chose_risky=1)
        pred = float(ort_out[1][0][1])
        diff = abs(pred - expected)

        status = "PASS" if diff < tolerance else "FAIL"
        if diff >= tolerance:
            all_passed = False

        if verbose:
            print(f"Vector {i}: {desc}")
            print(f"  Features: {features}")
            print(f"  Expected:   {expected:.6f}")
            print(f"  Predicted:  {pred:.6f}")
            print(f"  |Diff|:     {diff:.6e} [{status}]")

    if all_passed:
        if verbose:
            print("\nALL PARITY CHECKS PASSED: Onnxruntime outputs match expected within tolerance.")
        return True
    else:
        sys.stderr.write(
            f"\nPARITY VIOLATION: One or more predictions exceeded tolerance threshold ({tolerance:.1e}).\n"
        )
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify onnxruntime probability parity against tests/parity.json."
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=Path("model") / "model.onnx",
        help="Path to ONNX model artifact (default: model/model.onnx).",
    )
    parser.add_argument(
        "--vectors",
        type=Path,
        default=Path("tests") / "parity.json",
        help="Path to parity JSON benchmark vectors (default: tests/parity.json).",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=TOLERANCE,
        help=f"Allowed numerical discrepancy (default: {TOLERANCE}).",
    )

    args = parser.parse_args()
    success = verify_parity(
        model_path=args.model,
        vectors_path=args.vectors,
        tolerance=args.tolerance,
        verbose=True,
    )
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
