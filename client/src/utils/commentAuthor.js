export function hydrateCurrentUserCommentAuthor(comment, currentUser) {
    if (!comment || !currentUser) {
        return comment;
    }

    const author = comment.author;
    const isCurrentUserAuthor = author?.user_id
        ? author.user_id === currentUser.user_id
        : Boolean(comment.is_owner);

    if (!isCurrentUserAuthor) {
        return comment;
    }

    return {
        ...comment,
        author: {
            ...author,
            user_id: author?.user_id || currentUser.user_id,
            username: author?.username || currentUser.username,
            display_name: author?.display_name || currentUser.display_name || null,
            first_name: author?.first_name || currentUser.first_name || null,
            last_name: author?.last_name || currentUser.last_name || null,
            avatar: author?.avatar || currentUser.avatar || null,
            avatar_asset_id: author?.avatar_asset_id || currentUser.avatar_asset_id || null,
        },
    };
}
