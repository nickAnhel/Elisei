import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  DEMO_PASSWORD,
  authParams,
  extractAuthorId,
  extractChatId,
  extractContentId,
  login,
  maybeSleep,
  normalizeList,
  optionsFor,
  pickAccount,
  randomItem,
  safeJson,
} from './_common.js';

export const options = optionsFor('read');

const state = {
  token: null,
  username: null,
};

function ensureToken() {
  if (state.token) {
    return state.token;
  }

  const account = pickAccount();
  state.username = account.username;
  state.token = login(BASE_URL, account.username, DEMO_PASSWORD);
  return state.token;
}

function getUsers(token) {
  const response = http.get(
    `${BASE_URL}/users/list?limit=50&offset=0`,
    authParams(token, 'users_list')
  );
  check(response, {
    'users/list status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

function getFeed(token) {
  const response = http.get(
    `${BASE_URL}/contents/list?limit=30&offset=0`,
    authParams(token, 'feed')
  );
  check(response, {
    'contents/list status is 200': (r) => r.status === 200,
  });
  return normalizeList(safeJson(response, []));
}

export default function () {
  const token = ensureToken();
  if (!token) {
    return;
  }

  const meResponse = http.get(`${BASE_URL}/users/me`, authParams(token, 'users_me'));
  check(meResponse, {
    'users/me status is 200': (r) => r.status === 200,
  });
  const me = safeJson(meResponse, {});

  const users = getUsers(token);
  if (state.username) {
    const usersSearch = http.get(
      `${BASE_URL}/users/search?query=${encodeURIComponent(state.username.slice(0, 8))}&limit=20&offset=0`,
      authParams(token, 'users_search')
    );
    check(usersSearch, {
      'users/search status is 200': (r) => r.status === 200,
    });
  }

  const feed = getFeed(token);

  const targetAuthor = randomItem(users) || me;
  const authorId = extractAuthorId(targetAuthor) || (me && me.user_id);
  if (authorId) {
    const publicationsResponse = http.get(
      `${BASE_URL}/contents/publications?author_id=${authorId}&limit=20&offset=0`,
      authParams(token, 'author_publications')
    );
    check(publicationsResponse, {
      'contents/publications status is 200': (r) => r.status === 200,
    });

    const galleryResponse = http.get(
      `${BASE_URL}/contents/gallery?author_id=${authorId}&limit=20&offset=0`,
      authParams(token, 'author_gallery')
    );
    check(galleryResponse, {
      'contents/gallery status is 200': (r) => r.status === 200,
    });
  }

  const subscriptionsFeed = http.get(
    `${BASE_URL}/contents/subscriptions?limit=20&offset=0`,
    authParams(token, 'subscriptions_feed')
  );
  check(subscriptionsFeed, {
    'contents/subscriptions status is 200': (r) => r.status === 200,
  });

  const postsList = http.get(`${BASE_URL}/posts/list?limit=20&offset=0`, authParams(token, 'posts_list'));
  check(postsList, {
    'posts/list status is 200': (r) => r.status === 200,
  });
  const postItems = normalizeList(safeJson(postsList, []));
  const randomPost = randomItem(postItems);
  if (randomPost && randomPost.post_id) {
    const postDetail = http.get(`${BASE_URL}/posts/${randomPost.post_id}`, authParams(token, 'post_detail'));
    check(postDetail, {
      'posts/detail status is 200': (r) => r.status === 200,
    });
  }

  const articlesList = http.get(
    `${BASE_URL}/articles/list?limit=20&offset=0`,
    authParams(token, 'articles_list')
  );
  check(articlesList, {
    'articles/list status is 200': (r) => r.status === 200,
  });
  const articleItems = normalizeList(safeJson(articlesList, []));
  const randomArticle = randomItem(articleItems);
  if (randomArticle && randomArticle.article_id) {
    const articleDetail = http.get(
      `${BASE_URL}/articles/${randomArticle.article_id}`,
      authParams(token, 'article_detail')
    );
    check(articleDetail, {
      'articles/detail status is 200': (r) => r.status === 200,
    });
  }

  const contentItem = randomItem(feed);
  const contentId = extractContentId(contentItem);
  if (contentId) {
    const commentsList = http.get(
      `${BASE_URL}/contents/${contentId}/comments?limit=20&offset=0`,
      authParams(token, 'comments_list')
    );
    check(commentsList, {
      'comments/list status is 200': (r) => r.status === 200,
    });
  }

  const chatsResponse = http.get(`${BASE_URL}/chats/user?limit=20&offset=0`, authParams(token, 'chats_user'));
  check(chatsResponse, {
    'chats/user status is 200': (r) => r.status === 200,
  });

  const chats = normalizeList(safeJson(chatsResponse, []));
  const chat = randomItem(chats);
  const chatId = extractChatId(chat);
  if (chatId) {
    const historyResponse = http.get(
      `${BASE_URL}/chats/${chatId}/history?limit=30`,
      authParams(token, 'chat_history')
    );
    check(historyResponse, {
      'chats/history status is 200': (r) => r.status === 200,
    });

    const messagesResponse = http.get(
      `${BASE_URL}/messages?chat_id=${chatId}&limit=30&offset=0`,
      authParams(token, 'messages_list')
    );
    check(messagesResponse, {
      'messages/list status is 200': (r) => r.status === 200,
    });
  }

  const tagsResponse = http.get(
    `${BASE_URL}/tags/suggestions?query=py&limit=10`,
    authParams(token, 'tags_suggestions')
  );
  check(tagsResponse, {
    'tags/suggestions status is 200': (r) => r.status === 200,
  });

  if (me && me.avatar_asset_id) {
    const assetResponse = http.get(
      `${BASE_URL}/assets/${me.avatar_asset_id}`,
      authParams(token, 'assets_get')
    );
    check(assetResponse, {
      'assets/get status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  }

  maybeSleep();
}
