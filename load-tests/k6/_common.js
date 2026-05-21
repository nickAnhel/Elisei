import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { sleep } from 'k6';

export const BASE_URL = (__ENV.BASE_URL || 'http://server_loadtest:8000').replace(/\/+$/, '');
export const DEMO_PASSWORD = __ENV.DEMO_PASSWORD || 'Demo123456!';
export const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();
export const WRITE_INTENSITY = (__ENV.WRITE_INTENSITY || 'normal').toLowerCase();

const PROFILE_EXEC = {
  smoke: { vus: 1, duration: '30s' },
  quick: {
    stages: [
      { duration: '30s', target: 3 },
      { duration: '90s', target: 12 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
    gracefulStop: '15s',
  },
  load: {
    stages: [
      { duration: '60s', target: 6 },
      { duration: '180s', target: 20 },
      { duration: '60s', target: 0 },
    ],
    gracefulRampDown: '15s',
    gracefulStop: '20s',
  },
  stress: {
    stages: [
      { duration: '60s', target: 20 },
      { duration: '120s', target: 40 },
      { duration: '180s', target: 60 },
      { duration: '60s', target: 0 },
    ],
    gracefulRampDown: '15s',
    gracefulStop: '20s',
  },
};

const DURATION_THRESHOLDS = {
  'http_req_duration{endpoint:auth_token}': ['p(95)<800'],
  'http_req_duration{endpoint:users_me}': ['p(95)<500'],
  'http_req_duration{endpoint:users_list}': ['p(95)<800'],
  'http_req_duration{endpoint:users_search}': ['p(95)<800'],
  'http_req_duration{endpoint:feed}': ['p(95)<1000'],
  'http_req_duration{endpoint:author_publications}': ['p(95)<1000'],
  'http_req_duration{endpoint:author_gallery}': ['p(95)<1000'],
  'http_req_duration{endpoint:comments_list}': ['p(95)<1000'],
  'http_req_duration{endpoint:chats_user}': ['p(95)<1000'],
  'http_req_duration{endpoint:chat_history}': ['p(95)<1200'],
  'http_req_duration{endpoint:messages_list}': ['p(95)<1000'],
  'http_req_duration{endpoint:profile_update}': ['p(95)<1000'],
  'http_req_duration{endpoint:post_create}': ['p(95)<1200'],
  'http_req_duration{endpoint:post_update}': ['p(95)<1200'],
  'http_req_duration{endpoint:post_delete}': ['p(95)<1200'],
  'http_req_duration{endpoint:article_create}': ['p(95)<1500'],
  'http_req_duration{endpoint:article_update}': ['p(95)<1500'],
  'http_req_duration{endpoint:article_delete}': ['p(95)<1500'],
  'http_req_duration{endpoint:comment_create}': ['p(95)<1200'],
  'http_req_duration{endpoint:comment_update}': ['p(95)<1200'],
  'http_req_duration{endpoint:comment_delete}': ['p(95)<1200'],
  'http_req_duration{endpoint:view_session_start}': ['p(95)<1000'],
  'http_req_duration{endpoint:view_session_heartbeat}': ['p(95)<1000'],
  'http_req_duration{endpoint:view_session_finish}': ['p(95)<1000'],
  'http_req_duration{endpoint:chat_create}': ['p(95)<1500'],
  'http_req_duration{endpoint:chat_update}': ['p(95)<1500'],
  'http_req_duration{endpoint:chat_delete}': ['p(95)<1500'],
};

const SMOKE_THRESHOLDS = {
  checks: ['rate>0.90'],
  http_req_failed: ['rate<0.10'],
  http_req_duration: ['p(95)<2500'],
};

const MIXED_BASE_THRESHOLDS = {
  quick: {
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<15000'],
  },
  load: {
    checks: ['rate>0.90'],
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<20000'],
  },
  stress: {
    checks: ['rate>0.85'],
    http_req_failed: ['rate<0.08'],
    http_req_duration: ['p(95)<25000'],
  },
};

export function optionsFor(mode = 'read') {
  const normalizedMode = (mode || 'read').toLowerCase();
  const isWrite = normalizedMode === 'write';
  const isSmoke = PROFILE === 'smoke';
  const baseThresholds = {};

  if (normalizedMode === 'mixed') {
    const mixedProfileThresholds = MIXED_BASE_THRESHOLDS[PROFILE] || MIXED_BASE_THRESHOLDS.quick;
    Object.keys(mixedProfileThresholds).forEach((key) => {
      baseThresholds[key] = mixedProfileThresholds[key];
    });
  } else if (isSmoke) {
    Object.keys(SMOKE_THRESHOLDS).forEach((key) => {
      baseThresholds[key] = SMOKE_THRESHOLDS[key];
    });
  } else {
    baseThresholds.checks = [isWrite ? 'rate>0.90' : 'rate>0.95'];
    baseThresholds.http_req_failed = [isWrite ? 'rate<0.05' : 'rate<0.02'];
  }

  const profileExec = PROFILE_EXEC[PROFILE] || PROFILE_EXEC.smoke;
  const thresholds = {};
  const profileCopy = {};

  Object.keys(baseThresholds).forEach((key) => {
    thresholds[key] = baseThresholds[key];
  });
  if (normalizedMode !== 'mixed' && !isSmoke) {
    Object.keys(DURATION_THRESHOLDS).forEach((key) => {
      thresholds[key] = DURATION_THRESHOLDS[key];
    });
  }
  Object.keys(profileExec).forEach((key) => {
    profileCopy[key] = profileExec[key];
  });

  profileCopy.thresholds = thresholds;
  return profileCopy;
}

function collectUsers(raw) {
  const fromMap = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.results)) return value.results;
    return [];
  };

  if (Array.isArray(raw)) {
    return raw;
  }

  const result = [];
  if (raw && typeof raw === 'object') {
    fromMap(raw.featured_users).forEach((item) => result.push(item));
    fromMap(raw.generated_users).forEach((item) => result.push(item));
    fromMap(raw.users).forEach((item) => result.push(item));
    fromMap(raw.accounts).forEach((item) => result.push(item));
  }

  return result;
}

export const demoAccounts = new SharedArray('demo_accounts', () => {
  const parsed = JSON.parse(open('./data/demo_accounts.json'));
  const candidates = collectUsers(parsed)
    .map((item) => {
      if (typeof item === 'string') {
        return { username: item };
      }
      return item || {};
    })
    .filter((item) => typeof item.username === 'string' && item.username.trim().length > 0);

  if (!candidates.length) {
    throw new Error(
      'No usernames found in demo_accounts.json. Supported keys: featured_users, generated_users, users, accounts.'
    );
  }

  return candidates;
});

export function safeJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_err) {
    return fallback;
  }
}

export function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

export function randomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function extractContentId(item) {
  return (
    (item && item.content_id) ||
    (item && item.contentId) ||
    (item && item.content && item.content.content_id) ||
    null
  );
}

export function extractAuthorId(item) {
  return (
    (item && item.user && item.user.user_id) ||
    (item && item.user_id) ||
    (item && item.author && item.author.user_id) ||
    (item && item.author_id) ||
    null
  );
}

export function extractChatId(item) {
  return (
    (item && item.chat_id) ||
    (item && item.chatId) ||
    (item && item.chat && item.chat.chat_id) ||
    null
  );
}

export function extractMessageId(item) {
  return (item && item.message_id) || (item && item.messageId) || null;
}

export function statusIs(response, allowedStatuses) {
  return allowedStatuses.includes(response.status);
}

export function authParams(token, endpoint, extra = {}) {
  const mergedHeaders = {};
  const mergedTags = {};
  const params = {};

  Object.keys(extra).forEach((key) => {
    params[key] = extra[key];
  });

  mergedHeaders.Authorization = `Bearer ${token}`;
  if (extra.headers) {
    Object.keys(extra.headers).forEach((key) => {
      mergedHeaders[key] = extra.headers[key];
    });
  }

  mergedTags.endpoint = endpoint;
  if (extra.tags) {
    Object.keys(extra.tags).forEach((key) => {
      mergedTags[key] = extra.tags[key];
    });
  }

  params.headers = mergedHeaders;
  params.tags = mergedTags;
  return params;
}

export function pickAccount() {
  return demoAccounts[(__VU - 1) % demoAccounts.length];
}

export function login(baseUrl, username, password) {
  const payload = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  let response = null;
  const maxAttempts = PROFILE === 'smoke' ? 3 : 2;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    response = http.post(`${baseUrl}/auth/token`, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      tags: {
        endpoint: 'auth_token',
      },
    });

    if (response && response.status === 200) {
      break;
    }

    if (attempt < maxAttempts) {
      sleep(0.3 * attempt);
    }
  }

  check(response, {
    'auth/token status is 200': (r) => r.status === 200,
  });

  if (response.status !== 200) {
    return null;
  }

  const json = safeJson(response, {});
  return (json && json.access_token) || null;
}

export function maybeSleep(minSeconds = 0.2, maxSeconds = 1.0) {
  const duration = minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds);
  sleep(duration);
}

export function maybeWarnNotFound(label, response) {
  if (response.status === 404) {
    console.warn(`${label} skipped: endpoint returned 404`);
    return true;
  }
  return false;
}
