class PermissionDenied(Exception):
    """Raised when permission is denied."""

    def __init__(self, message="Permission denied"):
        super().__init__(message)


class InvalidCursor(Exception):
    """Raised when cursor token is invalid."""

    def __init__(self, message="Invalid cursor"):
        super().__init__(message)
