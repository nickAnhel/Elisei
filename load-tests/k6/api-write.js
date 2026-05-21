import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  DEMO_PASSWORD,
  authParams,
  extractAuthorId,
  extractChatId,
  extractContentId,
  extractMessageId,
  login,
  maybeSleep,
  normalizeList,
  optionsFor,
  pickAccount,
  randomItem,
  safeJson,
} from './_common.js';

export const options = optionsFor('write');

const RUN_ID = `${Date.now()}`;

const state = {
  token: null,
  me: null,
  username: null,
};

function uniqueSuffix() {
  return `${RUN_ID}-${__VU}-${__ITER}`;
}

function ensureToken() {
  if (state.token) {
    return state.token;
  }

  const account = pickAccount();
  state.username = account.username;
  state.token = login(BASE_URL, account.username, DEMO_PASSWORD);
  return state.token;
}

function statusAllowed(response, statuses) {
  return statuses.includes(response.status);
}

function fetchMe(token) {
  const response = http.get(`${BASE_URL}/users/me`, authParams(token, 'users_me'));
  check(response, {
    'users/me status is 200': (r) => r.status === 200,
  });
  const me = safeJson(response, null);
  state.me = me;
  return me;
}

function fetchUsers(token) {
  const response = http.get(`${BASE_URL}/users/list?limit=80&offset=0`, authParams(token, 'users_list'));
  check(response, {
    'users/list status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function fetchFeed(token) {
  const response = http.get(`${BASE_URL}/contents/list?limit=40&offset=0`, authParams(token, 'feed'));
  check(response, {
    'contents/list status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function fetchChats(token) {
  const response = http.get(`${BASE_URL}/chats/user?limit=50&offset=0`, authParams(token, 'chats_user'));
  check(response, {
    'chats/user status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function profileUpdateScenario(token) {
  const meBefore = fetchMe(token);
  const suffix = uniqueSuffix();
  const payload = {
    display_name: `[LOADTEST] ${state.username || 'user'} ${suffix}`,
    bio: `lt_profile_${suffix}`,
  };

  const updateResponse = http.put(
    `${BASE_URL}/users/me/profile`,
    JSON.stringify(payload),
    authParams(token, 'profile_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  check(updateResponse, {
    'profile update status is 200': (r) => r.status === 200,
  });

  const meAfterResponse = http.get(`${BASE_URL}/users/me`, authParams(token, 'users_me'));
  check(meAfterResponse, {
    'users/me after profile update is 200': (r) => r.status === 200,
  });

  const meAfter = safeJson(meAfterResponse, {});
  check(meAfter, {
    'profile update applied': (obj) =>
      obj && typeof obj.display_name === 'string' && obj.display_name.includes('[LOADTEST]'),
  });

  return meBefore;
}

function subscribeScenario(token, me, users) {
  const meUserId = me && me.user_id;
  const candidate = randomItem(users.filter((u) => extractAuthorId(u) && extractAuthorId(u) !== meUserId));
  const targetUserId = extractAuthorId(candidate);
  if (!targetUserId) {
    return;
  }

  const subscribeResp = http.post(
    `${BASE_URL}/users/subscribe?user_id=${targetUserId}`,
    null,
    authParams(token, 'subscribe')
  );
  check(subscribeResp, {
    'subscribe status is expected': (r) => statusAllowed(r, [200, 400, 409]),
  });

  const subscriptionsResp = http.get(
    `${BASE_URL}/users/subscriptions?user_id=${me.user_id}&limit=20&offset=0`,
    authParams(token, 'subscriptions_list')
  );
  check(subscriptionsResp, {
    'subscriptions list status is 200': (r) => r.status === 200,
  });

  const unsubscribeResp = http.del(
    `${BASE_URL}/users/unsubscribe?user_id=${targetUserId}`,
    null,
    authParams(token, 'unsubscribe')
  );
  check(unsubscribeResp, {
    'unsubscribe status is expected': (r) => statusAllowed(r, [200, 400, 409]),
  });
}

function postLifecycleScenario(token) {
  const suffix = uniqueSuffix();
  const createPayload = {
    content: `[LOADTEST:${suffix}] post content`,
    status: 'published',
    visibility: 'public',
    tags: ['loadtest', 'k6'],
    attachments: [],
  };

  const createResp = http.post(
    `${BASE_URL}/posts/`,
    JSON.stringify(createPayload),
    authParams(token, 'post_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(createResp, {
    'post create status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(createResp.status)) {
    return;
  }

  const createdPost = safeJson(createResp, {});
  const postId = createdPost && createdPost.post_id;
  if (!postId) {
    return;
  }

  const getResp = http.get(`${BASE_URL}/posts/${postId}`, authParams(token, 'post_detail'));
  check(getResp, {
    'post get status is 200': (r) => r.status === 200,
  });

  const updateResp = http.put(
    `${BASE_URL}/posts/${postId}`,
    JSON.stringify({ content: `[LOADTEST:${suffix}] post updated` }),
    authParams(token, 'post_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'post update status is 200': (r) => r.status === 200,
  });

  const likeResp = http.post(`${BASE_URL}/posts/${postId}/like`, null, authParams(token, 'post_like'));
  check(likeResp, {
    'post like status is 200': (r) => r.status === 200,
  });

  const unlikeResp = http.del(`${BASE_URL}/posts/${postId}/like`, null, authParams(token, 'post_unlike'));
  check(unlikeResp, {
    'post unlike status is 200': (r) => r.status === 200,
  });

  const deleteResp = http.del(`${BASE_URL}/posts/${postId}`, null, authParams(token, 'post_delete'));
  check(deleteResp, {
    'post delete status is 200': (r) => r.status === 200,
  });
}

function articleLifecycleScenario(token) {
  const suffix = uniqueSuffix();
  const createPayload = {
    title: `[LOADTEST:${suffix}] article`,
    body_markdown: `# [LOADTEST]\n\narticle body ${suffix}`,
    status: 'published',
    visibility: 'public',
    tags: ['loadtest', 'k6'],
  };

  const createResp = http.post(
    `${BASE_URL}/articles/`,
    JSON.stringify(createPayload),
    authParams(token, 'article_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(createResp, {
    'article create status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(createResp.status)) {
    return;
  }

  const createdArticle = safeJson(createResp, {});
  const articleId = createdArticle && createdArticle.article_id;
  if (!articleId) {
    return;
  }

  const getResp = http.get(`${BASE_URL}/articles/${articleId}`, authParams(token, 'article_detail'));
  check(getResp, {
    'article get status is 200': (r) => r.status === 200,
  });

  const updateResp = http.put(
    `${BASE_URL}/articles/${articleId}`,
    JSON.stringify({ body_markdown: `# [LOADTEST UPDATED]\n\n${suffix}` }),
    authParams(token, 'article_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'article update status is 200': (r) => r.status === 200,
  });

  const likeResp = http.post(`${BASE_URL}/articles/${articleId}/like`, null, authParams(token, 'article_like'));
  check(likeResp, {
    'article like status is 200': (r) => r.status === 200,
  });

  const unlikeResp = http.del(
    `${BASE_URL}/articles/${articleId}/like`,
    null,
    authParams(token, 'article_unlike')
  );
  check(unlikeResp, {
    'article unlike status is 200': (r) => r.status === 200,
  });

  const deleteResp = http.del(`${BASE_URL}/articles/${articleId}`, null, authParams(token, 'article_delete'));
  check(deleteResp, {
    'article delete status is 200': (r) => r.status === 200,
  });
}

function commentLifecycleScenario(token, feedItems) {
  const content = randomItem(feedItems);
  const contentId = extractContentId(content);
  if (!contentId) {
    return;
  }

  const suffix = uniqueSuffix();
  const createResp = http.post(
    `${BASE_URL}/contents/${contentId}/comments`,
    JSON.stringify({ body_text: `[LOADTEST:${suffix}] root comment` }),
    authParams(token, 'comment_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(createResp, {
    'comment create status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(createResp.status)) {
    return;
  }

  const createdComment = safeJson(createResp, {});
  const commentId = createdComment && createdComment.comment_id;
  if (!commentId) {
    return;
  }

  const updateResp = http.patch(
    `${BASE_URL}/comments/${commentId}`,
    JSON.stringify({ body_text: `[LOADTEST:${suffix}] updated comment` }),
    authParams(token, 'comment_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'comment update status is 200': (r) => r.status === 200,
  });

  const replyResp = http.post(
    `${BASE_URL}/comments/${commentId}/replies`,
    JSON.stringify({ body_text: `[LOADTEST:${suffix}] reply` }),
    authParams(token, 'comment_reply_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(replyResp, {
    'comment reply status is 200': (r) => statusAllowed(r, [200, 404]),
  });

  const likeResp = http.post(`${BASE_URL}/comments/${commentId}/like`, null, authParams(token, 'comment_like'));
  check(likeResp, {
    'comment like status is 200': (r) => statusAllowed(r, [200, 404]),
  });

  const unlikeResp = http.del(
    `${BASE_URL}/comments/${commentId}/like`,
    null,
    authParams(token, 'comment_unlike')
  );
  check(unlikeResp, {
    'comment unlike status is 200': (r) => statusAllowed(r, [200, 404]),
  });

  const deleteResp = http.del(`${BASE_URL}/comments/${commentId}`, null, authParams(token, 'comment_delete'));
  check(deleteResp, {
    'comment delete status is 200': (r) => r.status === 200,
  });
}

function viewSessionScenario(token, feedItems) {
  const content = randomItem(feedItems);
  const contentId = extractContentId(content);
  if (!contentId) {
    return;
  }

  const startResp = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/start`,
    JSON.stringify({
      source: 'k6-loadtest',
      initial_position_seconds: 0,
      initial_progress_percent: 0,
      metadata: { run_id: RUN_ID },
    }),
    authParams(token, 'view_session_start', {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  check(startResp, {
    'view session start status is expected': (r) => statusAllowed(r, [200, 201, 404]),
  });

  if (![200, 201].includes(startResp.status)) {
    return;
  }

  const startData = safeJson(startResp, {});
  const sessionId = startData && startData.view_session_id;
  if (!sessionId) {
    return;
  }

  const heartbeatResp = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/${sessionId}/heartbeat`,
    JSON.stringify({
      position_seconds: 5,
      watched_seconds_delta: 5,
      progress_percent: 10,
      metadata: { run_id: RUN_ID },
    }),
    authParams(token, 'view_session_heartbeat', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(heartbeatResp, {
    'view session heartbeat status is 200': (r) => r.status === 200,
  });

  const finishResp = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/${sessionId}/finish`,
    JSON.stringify({
      position_seconds: 20,
      watched_seconds_delta: 15,
      progress_percent: 100,
      ended: true,
      metadata: { run_id: RUN_ID },
    }),
    authParams(token, 'view_session_finish', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(finishResp, {
    'view session finish status is 200': (r) => r.status === 200,
  });
}

function chatLifecycleScenario(token, users) {
  const suffix = uniqueSuffix();
  const createResp = http.post(
    `${BASE_URL}/chats/`,
    JSON.stringify({
      chat_type: 'group',
      title: `[LOADTEST:${suffix}] chat`,
      is_private: false,
      members: [],
    }),
    authParams(token, 'chat_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(createResp, {
    'chat create status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(createResp.status)) {
    return null;
  }

  const chat = safeJson(createResp, {});
  const chatId = extractChatId(chat);
  if (!chatId) {
    return null;
  }

  const getResp = http.get(`${BASE_URL}/chats/${chatId}`, authParams(token, 'chat_get'));
  check(getResp, {
    'chat get status is 200': (r) => r.status === 200,
  });

  const updateResp = http.patch(
    `${BASE_URL}/chats/${chatId}`,
    JSON.stringify({ title: `[LOADTEST:${suffix}] chat updated` }),
    authParams(token, 'chat_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'chat update status is 200': (r) => r.status === 200,
  });

  const candidateMember = randomItem(
    users
      .map((u) => extractAuthorId(u))
      .filter((id) => typeof id === 'string' && (!state.me || id !== state.me.user_id))
  );

  if (candidateMember) {
    const addResp = http.post(
      `${BASE_URL}/chats/${chatId}/add-members`,
      JSON.stringify([candidateMember]),
      authParams(token, 'chat_add_members', {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    check(addResp, {
      'chat add-members status is expected': (r) => statusAllowed(r, [200, 201, 400, 409]),
    });

    const removeResp = http.request(
      'DELETE',
      `${BASE_URL}/chats/${chatId}/remove-members`,
      JSON.stringify([candidateMember]),
      authParams(token, 'chat_remove_members', {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    check(removeResp, {
      'chat remove-members status is expected': (r) => statusAllowed(r, [200, 400, 404, 409]),
    });
  }

  const markReadResp = http.post(`${BASE_URL}/chats/${chatId}/read`, null, authParams(token, 'chat_mark_read'));
  check(markReadResp, {
    'chat read status is 200': (r) => r.status === 200,
  });

  return chatId;
}

function shareContentScenario(token, feedItems, fallbackChatId) {
  const chatId = fallbackChatId || extractChatId(randomItem(fetchChats(token)));
  const contentId = extractContentId(randomItem(feedItems));
  if (!chatId || !contentId) {
    return;
  }

  const shareResp = http.post(
    `${BASE_URL}/messages/share-content`,
    JSON.stringify({
      content_id: contentId,
      chat_ids: [chatId],
      content: `[LOADTEST:${uniqueSuffix()}] shared content`,
    }),
    authParams(token, 'message_share_content', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(shareResp, {
    'messages/share-content status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(shareResp.status)) {
    return;
  }

  const sharedMessages = normalizeList(safeJson(shareResp, []));

  const listResp = http.get(
    `${BASE_URL}/messages?chat_id=${chatId}&limit=20&offset=0`,
    authParams(token, 'messages_list')
  );
  check(listResp, {
    'messages list after share is 200': (r) => r.status === 200,
  });

  const messageId = extractMessageId(randomItem(sharedMessages));
  if (!messageId) {
    return;
  }

  const updateResp = http.patch(
    `${BASE_URL}/messages/${messageId}`,
    JSON.stringify({ content: `[LOADTEST:${uniqueSuffix()}] shared message updated` }),
    authParams(token, 'message_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'message update status is expected': (r) => statusAllowed(r, [200, 403, 404]),
  });

  const deleteResp = http.del(`${BASE_URL}/messages/${messageId}`, null, authParams(token, 'message_delete'));
  check(deleteResp, {
    'message delete status is expected': (r) => statusAllowed(r, [200, 403, 404]),
  });
}

export default function () {
  const token = ensureToken();
  if (!token) {
    return;
  }

  const me = profileUpdateScenario(token) || fetchMe(token);
  if (!(me && me.user_id)) {
    return;
  }

  const users = fetchUsers(token);
  const feed = fetchFeed(token);

  subscribeScenario(token, me, users);
  postLifecycleScenario(token);
  articleLifecycleScenario(token);
  commentLifecycleScenario(token, feed);
  viewSessionScenario(token, feed);

  const chatId = chatLifecycleScenario(token, users);
  shareContentScenario(token, feed, chatId);

  if (chatId) {
    const deleteResp = http.del(`${BASE_URL}/chats/${chatId}`, null, authParams(token, 'chat_delete'));
    check(deleteResp, {
      'chat delete status is expected': (r) => statusAllowed(r, [200, 403, 404]),
    });
  }

  maybeSleep(0.1, 0.4);
}
