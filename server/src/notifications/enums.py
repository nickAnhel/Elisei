from enum import Enum


class NotificationTypeEnum(str, Enum):
    PUBLICATION = "publication"
    MESSENGER = "messenger"


class NotificationFilterEnum(str, Enum):
    ALL = "all"
    PUBLICATION = NotificationTypeEnum.PUBLICATION.value
    MESSENGER = NotificationTypeEnum.MESSENGER.value
