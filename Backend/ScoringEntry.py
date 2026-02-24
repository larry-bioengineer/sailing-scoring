"""
Data type for a single boat's series result row (sail number, rank, scores, total, net).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ScoringEntry:
    """One result row: sail number, rank, scores with discard flags, total, net."""

    sail_number: str
    rank: int
    rank_display: str
    scores: list[tuple[float | None, bool]]  # (score, is_discarded) per race
    total: float
    net: float

    @classmethod
    def from_result_row(cls, row: dict[str, Any]) -> "ScoringEntry":
        """Build from build_series_result row dict."""
        return cls(
            sail_number=row["sail_number"],
            rank=row["rank"],
            rank_display=row["rank_display"],
            scores=row["scores"],
            total=row["total"],
            net=row["net"],
        )
