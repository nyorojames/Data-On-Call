"""Tag recent sessions in data/sessions.csv with a pseudonymous participant label.

Usage:
    python scripts/tag_participant.py P1 --last-sessions 5 [--data data/sessions.csv] [--participants data/participants.csv]

Rules:
    - Pseudonymous participant labels only (e.g. P1, P2, P3). No personal information.
    - Appends session_id,participant to data/participants.csv (creates file with header if missing).
    - Refuses to tag any session that is already tagged in data/participants.csv.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

PARTICIPANTS_HEADER = ["session_id", "participant"]


def tag_participant(
    label: str,
    last_sessions_count: int,
    data_path: Path,
    participants_path: Path,
) -> list[str]:
    if not label or not label.strip():
        raise ValueError("Participant label cannot be empty.")

    clean_label = label.strip()

    if not data_path.is_file():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    # Read sessions file to get distinct session_ids in order of appearance
    distinct_sessions: list[str] = []
    seen = set()
    with open(data_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row.get("session_id")
            if sid and sid not in seen:
                seen.add(sid)
                distinct_sessions.append(sid)

    if not distinct_sessions:
        raise ValueError(f"No sessions found in {data_path}")

    # Take the last N distinct sessions
    selected_sessions = distinct_sessions[-last_sessions_count:]

    # Check existing tagged sessions
    already_tagged: dict[str, str] = {}
    if participants_path.is_file():
        with open(participants_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sid = row.get("session_id")
                p = row.get("participant")
                if sid:
                    already_tagged[sid] = p or ""

    # Refuse if any selected session is already tagged
    conflicts = [sid for sid in selected_sessions if sid in already_tagged]
    if conflicts:
        raise ValueError(
            f"Cannot tag sessions: the following session(s) are already tagged: {conflicts}"
        )

    # Append to participants file
    write_header = not participants_path.is_file() or participants_path.stat().st_size == 0
    participants_path.parent.mkdir(parents=True, exist_ok=True)

    with open(participants_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(PARTICIPANTS_HEADER)
        for sid in selected_sessions:
            writer.writerow([sid, clean_label])

    return selected_sessions


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tag the last N gameplay sessions with a pseudonymous participant label."
    )
    parser.add_argument(
        "label",
        type=str,
        help="Pseudonymous participant identifier (e.g., P1, P2). Never use real names.",
    )
    parser.add_argument(
        "--last-sessions",
        type=int,
        required=True,
        help="Number of recent distinct sessions to tag.",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("data") / "sessions.csv",
        help="Path to sessions CSV file (default: data/sessions.csv).",
    )
    parser.add_argument(
        "--participants",
        type=Path,
        default=Path("data") / "participants.csv",
        help="Path to participants CSV mapping (default: data/participants.csv).",
    )

    args = parser.parse_args()

    try:
        tagged = tag_participant(
            label=args.label,
            last_sessions_count=args.last_sessions,
            data_path=args.data,
            participants_path=args.participants,
        )
        print(f"Successfully tagged {len(tagged)} session(s) as {args.label}: {tagged}")
    except Exception as err:
        sys.stderr.write(f"ERROR: {err}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
