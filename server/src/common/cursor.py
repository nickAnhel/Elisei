from __future__ import annotations

import base64
import binascii
import json
from datetime import datetime
from uuid import UUID

from src.common.exceptions import InvalidCursor


def encode_cursor(payload: dict) -> str:
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(body).decode("ascii")


def decode_cursor(token: str) -> dict:
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
    except (UnicodeEncodeError, binascii.Error) as exc:
        raise InvalidCursor("Cursor token is not valid base64") from exc

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidCursor("Cursor token is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise InvalidCursor("Cursor payload must be an object")
    return payload


def parse_cursor_timestamp(value: object, *, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise InvalidCursor(f"Cursor field '{field_name}' must be an ISO timestamp string")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise InvalidCursor(f"Cursor field '{field_name}' is not a valid ISO timestamp") from exc
    if parsed.tzinfo is None:
        raise InvalidCursor(f"Cursor field '{field_name}' must include timezone")
    return parsed


def parse_cursor_uuid(value: object, *, field_name: str) -> UUID:
    if not isinstance(value, str):
        raise InvalidCursor(f"Cursor field '{field_name}' must be a UUID string")
    try:
        return UUID(value)
    except ValueError as exc:
        raise InvalidCursor(f"Cursor field '{field_name}' is not a valid UUID") from exc

