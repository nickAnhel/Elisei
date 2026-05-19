from __future__ import annotations

import json
from typing import Any


def serialize_json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False, default=str)


def deserialize_json(raw: str | bytes | None) -> Any | None:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)
