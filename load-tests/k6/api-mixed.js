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

export const options = optionsFor('mixed');

const RUN_ID = `${Date.now()}`;

const state = {
  token: null,
  username: null,
  me: null,
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

function fetchMe(token) {
  const response = http.get(`${BASE_URL}/users/me`, authParams(token, 'users_me'));
  check(response, {
    'users/me status is 200': (r) => r.status === 200,
  });
  state.me = safeJson(response, null);
  return state.me;
}

function fetchFeed(token, limit = 30) {
  const response = http.get(`${BASE_URL}/contents/list?limit=${limit}&offset=0`, authParams(token, 'feed'));
  check(response, {
    'contents/list status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function fetchChats(token) {
  const response = http.get(`${BASE_URL}/chats/user?limit=30&offset=0`, authParams(token, 'chats_user'));
  check(response, {
    'chats/user status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function readFeedAndProfile(token) {
  const me = state.me || fetchMe(token);

  const usersResponse = http.get(`${BASE_URL}/users/list?limit=40&offset=0`, authParams(token, 'users_list'));
  check(usersResponse, {
    'users/list status is 200': (r) => r.status === 200,
  });
  const users = normalizeList(safeJson(usersResponse, []));

  const searchResponse = http.get(
    `${BASE_URL}/users/search?query=demo&limit=20&offset=0`,
    authParams(token, 'users_search')
  );
  check(searchResponse, {
    'users/search status is 200': (r) => r.status === 200,
  });

  const feed = fetchFeed(token, 25);

  const authorId = extractAuthorId(randomItem(users)) || (me && me.user_id);
  if (authorId) {
    const publications = http.get(
      `${BASE_URL}/contents/publications?author_id=${authorId}&limit=15&offset=0`,
      authParams(token, 'author_publications')
    );
    check(publications, {
      'contents/publications status is 200': (r) => r.status === 200,
    });

    const gallery = http.get(
      `${BASE_URL}/contents/gallery?author_id=${authorId}&limit=15&offset=0`,
      authParams(token, 'author_gallery')
    );
    check(gallery, {
      'contents/gallery status is 200': (r) => r.status === 200,
    });
  }

  const contentId = extractContentId(randomItem(feed));
  if (contentId) {
    const comments = http.get(
      `${BASE_URL}/contents/${contentId}/comments?limit=20&offset=0`,
      authParams(token, 'comments_list')
    );
    check(comments, {
      'comments/list status is 200': (r) => r.status === 200,
    });
  }
}

function readMessenger(token) {
  const chats = fetchChats(token);
  const chatId = extractChatId(randomItem(chats));
  if (!chatId) {
    return;
  }

  const history = http.get(`${BASE_URL}/chats/${chatId}/history?limit=25`, authParams(token, 'chat_history'));
  check(history, {
    'chat history status is 200': (r) => r.status === 200,
  });

  const messages = http.get(
    `${BASE_URL}/messages?chat_id=${chatId}&limit=25&offset=0`,
    authParams(token, 'messages_list')
  );
  check(messages, {
    'messages list status is 200': (r) => r.status === 200,
  });
}

function updateProfileLight(token) {
  const suffix = uniqueSuffix();
  const response = http.put(
    `${BASE_URL}/users/me/profile`,
    JSON.stringify({
      display_name: `[LOADTEST] ${state.username || 'user'} ${suffix}`,
      bio: `lt_mixed_${suffix}`,
    }),
    authParams(token, 'profile_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  check(response, {
    'profile update status is 200': (r) => r.status === 200,
  });
}

function subscribeUnsubscribe(token) {
  const me = state.me || fetchMe(token);
  if (!(me && me.user_id)) {
    return;
  }

  const usersResponse = http.get(`${BASE_URL}/users/list?limit=60&offset=0`, authParams(token, 'users_list'));
  check(usersResponse, {
    'users/list for subscribe status is 200': (r) => r.status === 200,
  });
  const users = normalizeList(safeJson(usersResponse, []));
  const targetId = extractAuthorId(
    randomItem(users.filter((item) => extractAuthorId(item) && extractAuthorId(item) !== me.user_id))
  );

  if (!targetId) {
    return;
  }

  const subResp = http.post(`${BASE_URL}/users/subscribe?user_id=${targetId}`, null, authParams(token, 'subscribe'));
  check(subResp, {
    'subscribe status expected': (r) => [200, 400, 409].includes(r.status),
  });

  const unsubResp = http.del(
    `${BASE_URL}/users/unsubscribe?user_id=${targetId}`,
    null,
    authParams(token, 'unsubscribe')
  );
  check(unsubResp, {
    'unsubscribe status expected': (r) => [200, 400, 409].includes(r.status),
  });
}

function commentLifecycle(token) {
  const feed = fetchFeed(token, 20);
  const contentId = extractContentId(randomItem(feed));
  if (!contentId) {
    return;
  }

  const suffix = uniqueSuffix();
  const createResp = http.post(
    `${BASE_URL}/contents/${contentId}/comments`,
    JSON.stringify({ body_text: `[LOADTEST:${suffix}] mixed comment` }),
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

  const commentData = safeJson(createResp, {});
  const commentId = commentData && commentData.comment_id;
  if (!commentId) {
    return;
  }

  const updateResp = http.patch(
    `${BASE_URL}/comments/${commentId}`,
    JSON.stringify({ body_text: `[LOADTEST:${suffix}] mixed comment updated` }),
    authParams(token, 'comment_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'comment update status is 200': (r) => r.status === 200,
  });

  const deleteResp = http.del(`${BASE_URL}/comments/${commentId}`, null, authParams(token, 'comment_delete'));
  check(deleteResp, {
    'comment delete status is 200': (r) => r.status === 200,
  });
}

function postLifecycle(token) {
  const suffix = uniqueSuffix();
  const createResp = http.post(
    `${BASE_URL}/posts/`,
    JSON.stringify({
      content: `[LOADTEST:${suffix}] mixed post`,
      status: 'published',
      visibility: 'public',
      tags: ['loadtest', 'k6'],
      attachments: [],
    }),
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

  const postData = safeJson(createResp, {});
  const postId = postData && postData.post_id;
  if (!postId) {
    return;
  }

  const updateResp = http.put(
    `${BASE_URL}/posts/${postId}`,
    JSON.stringify({ content: `[LOADTEST:${suffix}] mixed post updated` }),
    authParams(token, 'post_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'post update status is 200': (r) => r.status === 200,
  });

  const deleteResp = http.del(`${BASE_URL}/posts/${postId}`, null, authParams(token, 'post_delete'));
  check(deleteResp, {
    'post delete status is 200': (r) => r.status === 200,
  });
}

function viewSession(token) {
  const feed = fetchFeed(token, 20);
  const contentId = extractContentId(randomItem(feed));
  if (!contentId) {
    return;
  }

  const start = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/start`,
    JSON.stringify({ source: 'k6-mixed', metadata: { run_id: RUN_ID } }),
    authParams(token, 'view_session_start', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(start, {
    'view session start status is expected': (r) => [200, 201, 404].includes(r.status),
  });

  if (![200, 201].includes(start.status)) {
    return;
  }

  const sessionData = safeJson(start, {});
  const sessionId = sessionData && sessionData.view_session_id;
  if (!sessionId) {
    return;
  }

  const heartbeat = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/${sessionId}/heartbeat`,
    JSON.stringify({ position_seconds: 3, watched_seconds_delta: 3, progress_percent: 10 }),
    authParams(token, 'view_session_heartbeat', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(heartbeat, {
    'view session heartbeat status is 200': (r) => r.status === 200,
  });

  const finish = http.post(
    `${BASE_URL}/contents/${contentId}/view-session/${sessionId}/finish`,
    JSON.stringify({ position_seconds: 20, watched_seconds_delta: 17, progress_percent: 100, ended: true }),
    authParams(token, 'view_session_finish', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(finish, {
    'view session finish status is 200': (r) => r.status === 200,
  });
}

function chatRestLifecycle(token) {
  const suffix = uniqueSuffix();
  const createResp = http.post(
    `${BASE_URL}/chats/`,
    JSON.stringify({ chat_type: 'group', title: `[LOADTEST:${suffix}] mixed chat`, is_private: false, members: [] }),
    authParams(token, 'chat_create', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(createResp, {
    'chat create status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(createResp.status)) {
    return;
  }

  const chatId = extractChatId(safeJson(createResp, {}));
  if (!chatId) {
    return;
  }

  const updateResp = http.patch(
    `${BASE_URL}/chats/${chatId}`,
    JSON.stringify({ title: `[LOADTEST:${suffix}] mixed chat updated` }),
    authParams(token, 'chat_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'chat update status is 200': (r) => r.status === 200,
  });

  const deleteResp = http.del(`${BASE_URL}/chats/${chatId}`, null, authParams(token, 'chat_delete'));
  check(deleteResp, {
    'chat delete status expected': (r) => [200, 403, 404].includes(r.status),
  });
}

function shareContentToChat(token) {
  const chats = fetchChats(token);
  const chatId = extractChatId(randomItem(chats));
  if (!chatId) {
    return;
  }

  const feed = fetchFeed(token, 20);
  const contentId = extractContentId(randomItem(feed));
  if (!contentId) {
    return;
  }

  const suffix = uniqueSuffix();
  const shareResp = http.post(
    `${BASE_URL}/messages/share-content`,
    JSON.stringify({
      content_id: contentId,
      chat_ids: [chatId],
      content: `[LOADTEST:${suffix}] share from mixed`,
    }),
    authParams(token, 'message_share_content', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(shareResp, {
    'share-content status is 200/201': (r) => [200, 201].includes(r.status),
  });

  if (![200, 201].includes(shareResp.status)) {
    return;
  }

  const sharedMessageId = extractMessageId(randomItem(normalizeList(safeJson(shareResp, []))));
  if (!sharedMessageId) {
    return;
  }

  const updateResp = http.patch(
    `${BASE_URL}/messages/${sharedMessageId}`,
    JSON.stringify({ content: `[LOADTEST:${suffix}] share updated` }),
    authParams(token, 'message_update', {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  check(updateResp, {
    'message update status expected': (r) => [200, 403, 404].includes(r.status),
  });

  const deleteResp = http.del(
    `${BASE_URL}/messages/${sharedMessageId}`,
    null,
    authParams(token, 'message_delete')
  );
  check(deleteResp, {
    'message delete status expected': (r) => [200, 403, 404].includes(r.status),
  });
}

export default function () {
  const token = ensureToken();
  if (!token) {
    return;
  }

  if (!state.me) {
    fetchMe(token);
  }

  const r = Math.random();

  if (r < 0.45) {
    readFeedAndProfile(token);
  } else if (r < 0.75) {
    readMessenger(token);
  } else if (r < 0.83) {
    updateProfileLight(token);
  } else if (r < 0.89) {
    subscribeUnsubscribe(token);
  } else if (r < 0.93) {
    commentLifecycle(token);
  } else if (r < 0.96) {
    viewSession(token);
  } else if (r < 0.98) {
    postLifecycle(token);
  } else if (r < 0.995) {
    shareContentToChat(token);
  } else {
    chatRestLifecycle(token);
  }

  maybeSleep(0.1, 0.8);
}
