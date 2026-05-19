class NotificationNotFound(Exception):
    """Raised when notification is not found"""


class NotificationAuthorSettingsNotFound(Exception):
    """Raised when author notification settings target is missing"""


class NotificationChatSettingsNotFound(Exception):
    """Raised when chat notification settings target is missing"""
