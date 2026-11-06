"""Generate synthetic gameplay sessions for development and evaluation testing.

Pre-registered seed: 42.
Documented generative rule:
  - Generates ~100 sessions with 3 scenes each (~300 rows total).
  - Risk probability rises with Experienced level (level=1), previous risky choices
    (prev_risky_count), and previous timeouts (prev_timeout_count), and decreases with
    prior hint usage (prev_hints_used), subject to noise.
  - Generates valid telemetry adhering strictly to data/DATA_DICTIONARY.md.
  - In noise-only mode (--noise-only), labels are uninformative random coin flips
    used to test gate failure under AC8.
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import random
import sys
from pathlib import Path

COLUMNS = [
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


def generate_synthetic_data(
    num_sessions: int = 100,
    seed: int = 42,
    noise_only: bool = False,
) -> list[dict[str, int | float | str]]:
    rng = random.Random(seed)
    rows: list[dict[str, int | float | str]] = []

    for _ in range(num_sessions):
        # Generate 16-hex random session ID
        session_id = f"{rng.getrandbits(64):016x}"
        level = rng.choice([0, 1])  # 0: Beginner, 1: Experienced
        goal = rng.choice([0, 1, 2])  # 0: Internship, 1: Trends, 2: AI

        cum_hints = 0
        cum_risky = 0
        cum_timeouts = 0
        prev_decision_time = 0.0

        for scene_no in (1, 2, 3):
            # Features known at scene start
            f_prev_hints = cum_hints
            f_prev_risky = cum_risky
            f_prev_timeouts = cum_timeouts
            f_prev_decision_time = round(prev_decision_time, 2)

            if noise_only:
                # Random coin flip independent of features (should achieve ~50% acc)
                chose_risky = 1 if rng.random() < 0.5 else 0
            else:
                # Documented rule:
                # Base log-odds intercept: -0.85 (targets ~45% risky rate across the population).
                # Risk rises with Experienced level (+1.3), prev_risky_count (+0.9),
                # prev_timeout_count (+1.1), falls with prev_hints_used (-1.3).
                noise = rng.gauss(0.0, 0.45)
                log_odds = (
                    -0.85
                    + 1.3 * level
                    + 0.9 * f_prev_risky
                    + 1.1 * f_prev_timeouts
                    - 1.3 * f_prev_hints
                    - 0.2 * (scene_no - 1)
                    + noise
                )
                prob = 1.0 / (1.0 + math.exp(-log_odds))
                chose_risky = 1 if rng.random() < prob else 0

            # Generate current scene behavior
            if level == 0:
                # Beginners have hints available, no timeout timer
                hint_used = 1 if rng.random() < 0.35 else 0
                timed_out = 0
                decision_time = round(rng.uniform(6.0, 36.0), 2)
            else:
                # Experienced have no hints in v1, but have 60s timer
                hint_used = 0
                if chose_risky and rng.random() < 0.20:
                    timed_out = 1
                    decision_time = 60.00
                else:
                    timed_out = 0
                    decision_time = round(rng.uniform(8.0, 52.0), 2)

            rows.append(
                {
                    "session_id": session_id,
                    "scene_no": scene_no,
                    "level": level,
                    "goal": goal,
                    "prev_hints_used": f_prev_hints,
                    "prev_risky_count": f_prev_risky,
                    "prev_timeout_count": f_prev_timeouts,
                    "prev_decision_time_sec": f_prev_decision_time,
                    "hint_used_this_scene": hint_used,
                    "decision_time_sec": decision_time,
                    "chose_risky": chose_risky,
                    "source": "synthetic",
                }
            )

            # Update accumulated state for next scene
            cum_hints += hint_used
            cum_risky += chose_risky
            cum_timeouts += timed_out
            prev_decision_time = decision_time

    return rows


def write_csv(rows: list[dict[str, int | float | str]], out_path: Path) -> None:
    # HARD RULE: Never write synthetic data to data/sessions.csv
    resolved = out_path.resolve()
    real_sessions = (Path("data") / "sessions.csv").resolve()
    if resolved == real_sessions:
        sys.stderr.write(
            "ERROR: Refusing to write synthetic data into real sessions file (data/sessions.csv).\n"
        )
        sys.exit(1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic gameplay telemetry for Data On-Call v2 development."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output CSV path (defaults to data/synthetic_dev.csv, or data/synthetic_noise.csv if --noise-only).",
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=100,
        help="Number of sessions to generate (default: 100 sessions = ~300 rows).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    parser.add_argument(
        "--noise-only",
        action="store_true",
        help="Generate uninformative random labels for evaluation gate failure tests.",
    )

    args = parser.parse_args()

    if args.out is None:
        args.out = (
            Path("data") / "synthetic_noise.csv"
            if args.noise_only
            else Path("data") / "synthetic_dev.csv"
        )

    rows = generate_synthetic_data(
        num_sessions=args.sessions,
        seed=args.seed,
        noise_only=args.noise_only,
    )
    write_csv(rows, args.out)
    print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
