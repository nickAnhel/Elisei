class ChatNotFound(Exception):
    """Raised when chat is not found"""


class AlreadyInChat(Exception):
    """Raised when user is already in chat"""


class FailedToLeaveChat(Exception):
    """Raised when failed to leave chat"""


class CantAddMembers(Exception):
    """Raised when cannot add members to chat"""


class CantRemoveMembers(Exception):
    """Raised when cannot remove members from chat"""


class InvalidChatHistoryCursor(Exception):
    """Raised when chat history cursor params are invalid"""


class ChatAvatarNotSupported(Exception):
    """Raised when chat avatar is not supported for selected chat type"""
