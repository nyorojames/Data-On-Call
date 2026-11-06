"""Pytest suite for scripts/split_playthroughs.py."""

from __future__ import annotations

import csv
import hashlib
from pathlib import Path

import pytest

from scripts.split_playthroughs import repair_file, split_playthroughs


def make_scene_row(
    session_id: str,
    scene_no: int,
    level: int = 0,
    goal: int = 0,
    prev_hints: int = 0,
    prev_risky: int = 0,
    prev_timeout: int = 0,
    prev_dec_time: float = 0.0,
    hint_used: int = 0,
    dec_time: float = 10.0,
    chose_risky: int = 0,
) -> dict[str, str]:
    return {
        "session_id": session_id,
        "scene_no": str(scene_no),
        "level": str(level),
        "goal": str(goal),
        "prev_hints_used": str(prev_hints),
        "prev_risky_count": str(prev_risky),
        "prev_timeout_count": str(prev_timeout),
        "prev_decision_time_sec": str(prev_dec_time),
        "hint_used_this_scene": str(hint_used),
        "decision_time_sec": str(dec_time),
        "chose_risky": str(chose_risky),
        "source": "real",
    }


def test_split_single_playthrough_preserves_id():
    sid = "abcdef0123456789abcdef0123456789"
    rows = [
        make_scene_row(sid, 1, dec_time=12.0, hint_used=1, chose_risky=0),
        make_scene_row(sid, 2, prev_hints=1, prev_dec_time=12.0, dec_time=8.5, chose_risky=1),
        make_scene_row(sid, 3, prev_hints=1, prev_risky=1, prev_dec_time=8.5, dec_time=5.0),
    ]

    repaired, mapping = split_playthroughs(rows)
    assert len(repaired) == 3
    assert mapping == {sid: [sid]}
    assert all(r["session_id"] == sid for r in repaired)


def test_split_two_playthrough_session_generates_deterministic_id():
    sid = "abcdef0123456789abcdef0123456789"
    expected_new_id = hashlib.sha256(f"{sid}:2".encode("utf-8")).hexdigest()[:32]

    # First playthrough (scenes 1, 2, 3)
    pt1 = [
        make_scene_row(sid, 1, level=1, dec_time=15.0, chose_risky=1),
        make_scene_row(sid, 2, level=1, prev_risky=1, prev_dec_time=15.0, dec_time=10.0, chose_risky=0),
        make_scene_row(sid, 3, level=1, prev_risky=1, prev_dec_time=10.0, dec_time=12.0, chose_risky=1),
    ]
    # Second playthrough (scenes 1, 2, 3 under same sid)
    pt2 = [
        make_scene_row(sid, 1, level=0, dec_time=8.0, hint_used=1, chose_risky=0),
        make_scene_row(sid, 2, level=0, prev_hints=1, prev_dec_time=8.0, dec_time=7.0, chose_risky=0),
        make_scene_row(sid, 3, level=0, prev_hints=1, prev_dec_time=7.0, dec_time=6.0, chose_risky=0),
    ]

    rows = pt1 + pt2
    repaired, mapping = split_playthroughs(rows)

    assert len(repaired) == 6
    assert mapping == {sid: [sid, expected_new_id]}
    assert all(r["session_id"] == sid for r in repaired[:3])
    assert all(r["session_id"] == expected_new_id for r in repaired[3:])


def test_rejects_non_contiguous_session():
    sid1 = "11111111111111111111111111111111"
    sid2 = "22222222222222222222222222222222"
    pt1 = [make_scene_row(sid1, 1), make_scene_row(sid1, 2), make_scene_row(sid1, 3)]
    pt2 = [make_scene_row(sid2, 1), make_scene_row(sid2, 2), make_scene_row(sid2, 3)]
    pt1_repeat = [make_scene_row(sid1, 1), make_scene_row(sid1, 2), make_scene_row(sid1, 3)]

    with pytest.raises(ValueError, match="not contiguous"):
        split_playthroughs(pt1 + pt2 + pt1_repeat)


def test_rejects_invalid_scene_sequence():
    sid = "abcdef0123456789abcdef0123456789"
    # Scene sequence [1, 3, 2]
    rows = [
        make_scene_row(sid, 1),
        make_scene_row(sid, 3),
        make_scene_row(sid, 2),
    ]
    with pytest.raises(ValueError, match="expected \\[1, 2, 3\\]"):
        split_playthroughs(rows)


def test_rejects_non_zero_prev_in_scene_1():
    sid = "abcdef0123456789abcdef0123456789"
    rows = [
        make_scene_row(sid, 1, prev_risky=1),  # non-zero prev_risky
        make_scene_row(sid, 2),
        make_scene_row(sid, 3),
    ]
    with pytest.raises(ValueError, match="Scene 1 .* non-zero prev_\\*"):
        split_playthroughs(rows)


def test_rejects_inconsistent_cumulative_values():
    sid = "abcdef0123456789abcdef0123456789"
    rows = [
        make_scene_row(sid, 1, dec_time=10.0, chose_risky=1),
        make_scene_row(sid, 2, prev_risky=0, prev_dec_time=10.0),  # should be prev_risky=1
        make_scene_row(sid, 3, prev_risky=1, prev_dec_time=10.0),
    ]
    with pytest.raises(ValueError, match="prev_risky_count mismatch"):
        split_playthroughs(rows)
