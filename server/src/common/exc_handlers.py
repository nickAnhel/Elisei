from fastapi import HTTPException, Request, status

from src.common.exceptions import InvalidCursor, PermissionDenied


async def permission_denied_handler(request: Request, exc: PermissionDenied) -> HTTPException:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=str(exc),
    )


async def invalid_cursor_handler(request: Request, exc: InvalidCursor) -> HTTPException:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
    )
