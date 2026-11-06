"""Split multi-playthrough sessions into distinct single-playthrough sessions.

Rules (label-blind, mechanical):
  - Reads data/sessions_raw.csv in file order.
  - Starts a new playthrough whenever scene_no is 1 and the current session_id already has rows.
  - The first playthrough of a session keeps its original session_id.
  - Later playthroughs of the same original ID get a new deterministic 32-character hex ID:
    the first 32 hex characters of sha256("<original_id>:<playthrough_index>").
  - Preserves row order and all other column values byte-identically.
  - Enforces strict validation:
      * Rows of any session_id must be contiguous.
      * Each playthrough must have scenes 1, 2, 3 exactly once.
      * Scene 1 must have all prev_* values equal to 0.
      * Scenes 2 and 3 prev_* values must be consistent with prior rows of that playthrough.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from pathlib import Path
from typing import Any

EXPECTED_COLUMNS = [
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


def validate_playthrough(playthrough_rows: list[dict[str, str]], sid_label: str) -> None:
    if len(playthrough_rows) != 3:
        raise ValueError(
            f"Playthrough for {sid_label} has {len(playthrough_rows)} rows (expected 3)."
        )

    scenes = [int(r["scene_no"]) for r in playthrough_rows]
    if scenes != [1, 2, 3]:
        raise ValueError(
            f"Playthrough for {sid_label} has scenes {scenes}, expected [1, 2, 3]."
        )

    r1, r2, r3 = playthrough_rows

    # Scene 1 checks: all prev_* must be 0
    if (
        int(r1["prev_hints_used"]) != 0
        or int(r1["prev_risky_count"]) != 0
        or int(r1["prev_timeout_count"]) != 0
        or float(r1["prev_decision_time_sec"]) != 0.0
    ):
        raise ValueError(f"Scene 1 for {sid_label} has non-zero prev_* values.")

    # Scene 2 cumulative checks
    if int(r2["prev_hints_used"]) != int(r1["hint_used_this_scene"]):
        raise ValueError(f"Scene 2 prev_hints_used mismatch in {sid_label}.")
    if int(r2["prev_risky_count"]) != int(r1["chose_risky"]):
        raise ValueError(f"Scene 2 prev_risky_count mismatch in {sid_label}.")
    if float(r2["prev_decision_time_sec"]) != float(r1["decision_time_sec"]):
        raise ValueError(f"Scene 2 prev_decision_time_sec mismatch in {sid_label}.")

    # Scene 3 cumulative checks
    cum_hints = int(r1["hint_used_this_scene"]) + int(r2["hint_used_this_scene"])
    if int(r3["prev_hints_used"]) != cum_hints:
        raise ValueError(f"Scene 3 prev_hints_used mismatch in {sid_label}.")
    cum_risky = int(r1["chose_risky"]) + int(r2["chose_risky"])
    if int(r3["prev_risky_count"]) != cum_risky:
        raise ValueError(f"Scene 3 prev_risky_count mismatch in {sid_label}.")
    if float(r3["prev_decision_time_sec"]) != float(r2["decision_time_sec"]):
        raise ValueError(f"Scene 3 prev_decision_time_sec mismatch in {sid_label}.")


def split_playthroughs(
    raw_rows: list[dict[str, str]]
) -> tuple[list[dict[str, str]], dict[str, list[str]]]:
    """Process raw rows and assign deterministic IDs to later playthroughs.

    Returns:
        repaired_rows: list of all rows with updated session_id fields.
        session_mapping: mapping of original_id -> list of assigned session_ids.
    """
    if not raw_rows:
        return [], {}

    # Check contiguity of original session_ids
    seen_sessions: set[str] = set()
    current_sid: str | None = None
    for r in raw_rows:
        sid = r["session_id"]
        if sid != current_sid:
            if sid in seen_sessions:
                raise ValueError(
                    f"Session ID {sid} is not contiguous in the telemetry file."
                )
            seen_sessions.add(sid)
            current_sid = sid

    # Group into playthroughs
    playthroughs_by_orig_id: dict[str, list[list[dict[str, str]]]] = {}
    current_sid = None
    current_playthrough: list[dict[str, str]] = []

    for r in raw_rows:
        sid = r["session_id"]
        scene_no = int(r["scene_no"])

        if sid != current_sid:
            if current_playthrough:
                playthroughs_by_orig_id[current_sid].append(current_playthrough)
                current_playthrough = []
            current_sid = sid
            if current_sid not in playthroughs_by_orig_id:
                playthroughs_by_orig_id[current_sid] = []

        if scene_no == 1 and current_playthrough:
            # New playthrough within the same session_id
            playthroughs_by_orig_id[current_sid].append(current_playthrough)
            current_playthrough = []

        current_playthrough.append(r)

    if current_playthrough and current_sid:
        playthroughs_by_orig_id[current_sid].append(current_playthrough)

    # Validate each playthrough and assign session IDs
    repaired_rows: list[dict[str, str]] = []
    session_mapping: dict[str, list[str]] = {}

    for orig_id, pts in playthroughs_by_orig_id.items():
        session_mapping[orig_id] = []
        for pt_idx, pt_rows in enumerate(pts, start=1):
            validate_playthrough(pt_rows, f"{orig_id} (playthrough {pt_idx})")

            if pt_idx == 1:
                assigned_id = orig_id
            else:
                # Deterministic 32-character hex ID: sha256("<original_id>:<playthrough_index>")[:32]
                hash_input = f"{orig_id}:{pt_idx}".encode("utf-8")
                assigned_id = hashlib.sha256(hash_input).hexdigest()[:32]

            session_mapping[orig_id].append(assigned_id)

            for r in pt_rows:
                new_row = dict(r)
                new_row["session_id"] = assigned_id
                repaired_rows.append(new_row)

    return repaired_rows, session_mapping


def repair_file(input_path: Path, output_path: Path) -> dict[str, Any]:
    with open(input_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != EXPECTED_COLUMNS:
            raise ValueError(
                f"Fieldnames mismatch in {input_path}: expected {EXPECTED_COLUMNS}, got {reader.fieldnames}"
            )
        raw_rows = list(reader)

    repaired_rows, session_mapping = split_playthroughs(raw_rows)

    # Atomic write to output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output_path.with_suffix(".tmp")
    with open(temp_output, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=EXPECTED_COLUMNS)
        writer.writeheader()
        writer.writerows(repaired_rows)
    temp_output.replace(output_path)

    orig_sids = list(session_mapping.keys())
    new_sids = [sid for sids in session_mapping.values() for sid in sids]

    return {
        "rows_before": len(raw_rows),
        "rows_after": len(repaired_rows),
        "distinct_sessions_before": len(orig_sids),
        "distinct_sessions_after": len(new_sids),
        "session_mapping": session_mapping,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Split multi-playthrough sessions into clean single-playthrough sessions."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data") / "sessions_raw.csv",
        help="Path to input raw CSV (default: data/sessions_raw.csv)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data") / "sessions.csv",
        help="Path to output repaired CSV (default: data/sessions.csv)",
    )

    args = parser.parse_args()

    try:
        info = repair_file(args.input, args.output)
        print("Data repair successful:")
        print(f"  Rows before: {info['rows_before']}, Rows after: {info['rows_after']}")
        print(
            f"  Sessions before: {info['distinct_sessions_before']}, Sessions after: {info['distinct_sessions_after']}"
        )
    except Exception as err:
        sys.stderr.write(f"ERROR: {err}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
