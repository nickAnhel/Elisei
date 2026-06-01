import pytest

from src.common.cursor import decode_cursor, encode_cursor, parse_cursor_timestamp, parse_cursor_uuid
from src.common.exceptions import InvalidCursor


def test_cursor_encode_decode_roundtrip() -> None:
    payload = {
        "kind": "contents:list",
        "endpoint": "/contents/list",
        "timestamp": "2026-06-01T12:00:00+00:00",
        "content_id": "9f37ec4b-1b6d-4c83-a75e-0e64ad32922e",
    }
    token = encode_cursor(payload)
    assert decode_cursor(token) == payload


def test_decode_cursor_rejects_invalid_token() -> None:
    with pytest.raises(InvalidCursor):
        decode_cursor("not-a-valid-token")


def test_parse_cursor_timestamp_requires_timezone() -> None:
    with pytest.raises(InvalidCursor):
        parse_cursor_timestamp("2026-06-01T12:00:00", field_name="timestamp")


def test_parse_cursor_uuid_rejects_invalid_uuid() -> None:
    with pytest.raises(InvalidCursor):
        parse_cursor_uuid("bad-uuid", field_name="content_id")
