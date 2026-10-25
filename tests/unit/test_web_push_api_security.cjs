/**
 * SINC Platform — Isolated Web Push API Route Security & Underlying Event Authorization Tests
 *
 * Requirements Verified:
 * 1. Missing server configuration (SUPABASE_JWT_SECRET missing) -> 500 fail-closed.
 * 2. Missing authentication (Missing Authorization header) -> 401 Unauthorized.
 * 3. Malformed authentication header (Not Bearer) -> 401 Unauthorized.
 * 4. Malformed token structure (Not 3 parts / invalid base64) -> 401 Unauthorized.
 * 5. Expired token -> 401 Unauthorized.
 * 6. Unsupported signing algorithm (alg: none) -> 401 Unauthorized.
 * 7. Unsupported signing algorithm (alg: RS256) -> 401 Unauthorized.
 * 8. Invalid / forged cryptographic signature -> 401 Unauthorized.
 * 9. Valid authorized event: Direct message with verified mutual conversation membership -> 200 OK.
 * 10. Valid authorized event: Verified pending follow request -> 200 OK.
 * 11. Valid authorized event: Verified accepted follow relationship -> 200 OK.
 * 12. Valid authorized event: Verified like on recipient post -> 200 OK.
 * 13. Valid authorized event: Verified comment on recipient post -> 200 OK.
 * 14. Valid authorized event: Verified mention of recipient -> 200 OK.
 * 15. Valid authorized event: Verified authoritative notification record -> 200 OK.
 * 16. Valid authorized event: Self-notification (test, system to own account) -> 200 OK.
 * 17. Missing underlying event: Message referencing non-existent conversation -> 403 Forbidden.
 * 18. Missing underlying event: Follow request when no pending request exists -> 403 Forbidden.
 * 19. Missing underlying event: Like notification when no like exists on recipient content -> 403 Forbidden.
 * 20. Missing underlying event: Comment notification when no comment exists -> 403 Forbidden.
 * 21. Forged sender ID: Client-supplied callerId/senderId discarded, bound to verified token identity.
 * 22. Unrelated recipient: Caller references real conversation but targets third-party recipient not in room -> 403 Forbidden.
 * 23. Forged notification type: Arbitrary unapproved type (e.g. admin_eval) -> 400 Bad Request.
 * 24. Valid user but unauthorized recipient: System or test notification to another user -> 403 Forbidden.
 * 25. Valid user but unauthorized recipient: Self-messaging and self-follow-requests -> 400 Bad Request.
 * 26. Malformed payload: Missing recipientId -> 400 Bad Request.
 * 27. Malformed payload: Missing required entityId for social notification types -> 400 Bad Request.
 * 28. Malformed payload: Non-object body -> 400 Bad Request.
 * 29. Payload sanitization: Untrusted URLs (javascript:, //, external) sanitized to /notifications.
 * 30. Unauthorized subscription targeting: Cross-user registration hijack -> 403 Forbidden.
 * 31. Unauthorized subscription targeting: Insecure endpoint (non-HTTPS or oversized) -> 400 Bad Request.
 * 32. Anti-SSRF: Injected arbitrary subscription endpoint in send-web-push is strictly ignored.
 * 33. Push delivery dispatch: Authorized delivery using verified caller ID and stored recipient subscription.
 * 34. Request abuse & rate limiting: Rapid repeat dispatch bursts constrained (throttled: true).
 * 35. Authenticated unregistration: Recipient device cleanly removed from dispatch registry.
 *
 * Completely isolated: Purely in-memory request simulation with mocked test JWTs & mock event resolver, 0 remote calls.
 */

const crypto = require('crypto');

const TEST_SECRET = 'sinc_push_test_secret_1234567890_abcdef_isolated';
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
process.env.NODE_ENV = 'test';

function createTestToken(sub, expiresInSec = 3600, options = {}) {
  const header = {
    alg: options.alg || 'HS256',
    typ: 'JWT'
  };
  const payload = {
    sub,
    aud: options.aud !== undefined ? options.aud : 'authenticated',
    role: options.role !== undefined ? options.role : 'authenticated',
    exp: Math.floor(Date.now() / 1000) + expiresInSec
  };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

  if (options.alg === 'none') {
    return `${hB64}.${pB64}.`;
  }

  const secretToUse = options.secret || TEST_SECRET;
  const sig = crypto.createHmac('sha256', secretToUse).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

const {
  verifyServerAuth,
  authorizePushNotificationRequest,
  authorizeAndVerifyPushNotification,
  verifyAuthoritativePushEvent,
  validatePushSubscription,
  computePushEventIdempotencyKey,
  MemoryPushIdempotencyStore,
  PostgresPushIdempotencyStore,
  defaultPushIdempotencyStore,
  getActivePushIdempotencyStore,
  isEventWithinFreshnessWindow,
  PUSH_EVENT_FRESHNESS_WINDOW_SECONDS,
  ALLOWED_NOTIFICATION_TYPES
} = require('../../src/lib/serverAuth.ts');

const {
  registerLocalSubscription,
  unregisterLocalSubscription,
  sendPushNotification
} = require('../../src/lib/serverPushDispatcher.cjs');

// Mock in-memory database of authoritative application events
const mockDatabase = {
  // Alice and Bob share conversation conv-101
  conversations: {
    'conv-101': ['user-alice-123', 'user-bob-999'],
    'conv-charlie-dave': ['user-charlie-777', 'user-dave-888']
  },
  // Authoritative messages with timestamps
  messages: [
    { id: 'msg-valid-101', conversation_id: 'conv-101', sender_id: 'user-alice-123', content: 'Hello Bob', createdAt: Date.now() },
    { id: 'msg-valid-102', conversation_id: 'conv-101', sender_id: 'user-alice-123', content: 'Second distinct message', createdAt: Date.now() },
    { id: 'msg-forged-author', conversation_id: 'conv-101', sender_id: 'user-bob-999', content: 'Message from Bob', createdAt: Date.now() },
    { id: 'msg-fresh-201', conversation_id: 'conv-101', sender_id: 'user-alice-123', content: 'Fresh message', createdAt: Date.now() },
    { id: 'msg-stale-202', conversation_id: 'conv-101', sender_id: 'user-alice-123', content: 'Old message', createdAt: Date.now() - 3600 * 1000 }
  ],
  // Alice has a pending follow request to Bob; Bob has accepted follow to Charlie; Alice accepted Bob
  followRequests: [
    { id: 'req-alice-bob', follower: 'user-alice-123', following: 'user-bob-999', status: 'pending', createdAt: Date.now() },
    { id: 'req-charlie-accepted-bob', follower: 'user-bob-999', following: 'user-charlie-777', status: 'accepted', transitionEvent: true, updatedAt: Date.now() },
    { id: 'req-bob-charlie-stale', follower: 'user-bob-999', following: 'user-charlie-777', status: 'accepted', transitionEvent: false, updatedAt: Date.now() },
    { id: 'req-alice-accepted-bob', follower: 'user-bob-999', following: 'user-alice-123', status: 'accepted', transitionEvent: true, updatedAt: Date.now() },
    { id: 'req-bob-charlie-old', follower: 'user-bob-999', following: 'user-charlie-777', status: 'accepted', transitionEvent: true, updatedAt: Date.now() - 7200 * 1000 },
    { id: 'req-accepted-follower-bob', follower: 'user-bob-999', following: 'user-private-owner', status: 'accepted' }
  ],
  // Blocked users
  blockedUsers: [
    { blocker_user_id: 'user-blocked-alpha', blocked_user_id: 'user-blocked-beta' }
  ],
  // User profiles with privacy settings
  profiles: {
    'user-private-owner': { id: 'user-private-owner', is_private: true },
    'user-public-owner': { id: 'user-public-owner', is_private: false }
  },
  // Posts
  posts: [
    { id: 'post-bob-555', authorId: 'user-bob-999', content: 'Tech patterns' },
    { id: 'post-alice-777', authorId: 'user-alice-123', content: 'Hey @user-bob-999 check this out' },
    { id: 'post-alice-nomention', authorId: 'user-alice-123', content: 'General post without mentions' },
    { id: 'post-private-owner-1', authorId: 'user-private-owner', content: 'Private post' }
  ],
  // Alice liked Bob's post
  likes: [
    { id: 'like-1', actorId: 'user-alice-123', recipientId: 'user-bob-999', entityId: 'post-bob-555', createdAt: Date.now() }
  ],
  // Alice commented on Bob's post
  comments: [
    { id: 'comment-1', actorId: 'user-alice-123', recipientId: 'user-bob-999', entityId: 'post-bob-555', content: 'Nice!', createdAt: Date.now() }
  ],
  // Alice mentioned Bob in her post
  mentions: [
    { id: 'mention-1', actorId: 'user-alice-123', recipientId: 'user-bob-999', entityId: 'post-alice-777', createdAt: Date.now() },
    { id: 'mention-private-eve', actorId: 'user-private-owner', recipientId: 'user-eve-unauthorized', entityId: 'post-private-owner-1', createdAt: Date.now() },
    { id: 'mention-private-bob', actorId: 'user-private-owner', recipientId: 'user-bob-999', entityId: 'post-private-owner-1', createdAt: Date.now() }
  ],
  // Authoritative notification record
  notifications: [
    { id: 'notif-auth-123', actorId: 'user-alice-123', recipientId: 'user-bob-999', createdAt: Date.now() }
  ]
};

const mockEventResolver = {
  isBlocked: async (callerId, recipientId) => {
    return mockDatabase.blockedUsers.some(
      (b) =>
        (b.blocker_user_id === callerId && b.blocked_user_id === recipientId) ||
        (b.blocker_user_id === recipientId && b.blocked_user_id === callerId)
    );
  },
  isPrivateProfile: async (userId) => {
    return Boolean(mockDatabase.profiles[userId]?.is_private);
  },
  canViewContent: async (viewerId, authorId, entityId) => {
    if (viewerId === authorId) return true;
    const isPrivate = Boolean(mockDatabase.profiles[authorId]?.is_private);
    if (!isPrivate) return true;
    return mockDatabase.followRequests.some(
      (r) => r.follower === viewerId && r.following === authorId && r.status === 'accepted'
    );
  },
  hasMessageEvent: async ({ messageId, conversationId, callerId, recipientId }) => {
    if (conversationId) {
      const members = mockDatabase.conversations[conversationId] || [];
      if (!members.includes(callerId) || !members.includes(recipientId)) {
        return false;
      }
    }
    const match = mockDatabase.messages.find((m) => {
      const matchId = !messageId || m.id === messageId;
      const matchConv = !conversationId || m.conversation_id === conversationId;
      const matchAuthor = m.sender_id === callerId;
      const convMembers = mockDatabase.conversations[m.conversation_id] || [];
      const matchRecipient = convMembers.includes(recipientId);
      return matchId && matchConv && matchAuthor && matchRecipient;
    });
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  },
  hasConversationMembership: async (convId, callerId, recipientId) => {
    const members = mockDatabase.conversations[convId] || [];
    return members.includes(callerId) && members.includes(recipientId);
  },
  hasPendingFollowRequest: async (paramsOrCallerId, recipientId) => {
    const callerId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
    const targetId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
    const reqId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.requestId : undefined;
    const match = mockDatabase.followRequests.find(
      (r) => r.follower === callerId && r.following === targetId && r.status === 'pending' && (!reqId || r.id === reqId)
    );
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  },
  hasFollowAcceptedEvent: async (paramsOrCallerId, recipientId) => {
    const callerId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
    const targetId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
    const reqId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.requestId : undefined;
    const match = mockDatabase.followRequests.find(
      (r) => r.following === callerId && r.follower === targetId && r.status === 'accepted' && r.transitionEvent && (!reqId || r.id === reqId)
    );
    if (!match) return false;
    return {
      verified: true,
      updatedAt: match.updatedAt !== undefined ? match.updatedAt : Date.now(),
      acceptedAt: match.acceptedAt !== undefined ? match.acceptedAt : undefined
    };
  },
  hasAcceptedFollowRelationship: async (followerId, followingId) => {
    return mockDatabase.followRequests.some(
      (r) => r.follower === followerId && r.following === followingId && r.status === 'accepted'
    );
  },
  hasLikeEvent: async (paramsOrCallerId, recipientId, entityId) => {
    const callerId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
    const targetId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
    const entId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
    const match = mockDatabase.likes.find(
      (l) => l.actorId === callerId && l.recipientId === targetId && l.entityId === entId
    );
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  },
  hasCommentEvent: async (paramsOrCallerId, recipientId, entityId) => {
    const callerId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
    const targetId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
    const entId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
    const match = mockDatabase.comments.find(
      (c) => c.actorId === callerId && c.recipientId === targetId && (c.entityId === entId || c.id === entId)
    );
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  },
  hasMentionEvent: async (paramsOrCallerId, recipientId, entityId) => {
    const callerId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
    const targetId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
    const entId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
    const match = mockDatabase.mentions.find(
      (m) => m.actorId === callerId && m.recipientId === targetId && m.entityId === entId
    );
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  },
  hasNotificationRecord: async (paramsOrNotifId, actorId, recipientId) => {
    const notifId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.notificationId : paramsOrNotifId;
    const actId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.actorId : actorId;
    const recId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.recipientId : recipientId;
    const match = mockDatabase.notifications.find(
      (n) => (!notifId || n.id === notifId) && n.actorId === actId && n.recipientId === recId
    );
    if (!match) return false;
    return { verified: true, createdAt: match.createdAt !== undefined ? match.createdAt : Date.now() };
  }
};

async function runPushSecurityTests() {
  console.log('================================================================');
  console.log('SINC — WEB PUSH API SECURITY & UNDERLYING EVENT AUDIT SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function recordPass(name) {
    passed++;
    total++;
    console.log(`[PASS] Test ${total}: ${name}`);
  }

  function recordFail(name, err) {
    total++;
    console.error(`[FAIL] Test ${total}: ${name} —`, err);
  }

  // -------------------------------------------------------------
  // TEST 1: Missing Server Configuration (Fail-Closed)
  // -------------------------------------------------------------
  {
    const originalSecret = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${createTestToken('user-alice-123')}`
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    process.env.SUPABASE_JWT_SECRET = originalSecret;

    if (!auth.authenticated && auth.status === 500 && auth.error.includes('SUPABASE_JWT_SECRET required')) {
      recordPass('Missing SUPABASE_JWT_SECRET fails closed with 500 Server Configuration Error');
    } else {
      recordFail('Missing verification configuration', `Expected status 500 fail-closed, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 2: Missing Authorization Header
  // -------------------------------------------------------------
  {
    const req = new Request('http://localhost:3000/api/register-web-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'alice', subscription: { endpoint: 'https://push.example.com/123' } })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Missing Authorization header')) {
      recordPass('Missing Authorization header returns 401 Unauthorized');
    } else {
      recordFail('Missing Authorization header', `Expected 401, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 3: Malformed Authorization Header (Not Bearer)
  // -------------------------------------------------------------
  {
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic dXNlcjpwYXNz'
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Bearer token format required')) {
      recordPass('Non-Bearer Authorization header returns 401 Unauthorized');
    } else {
      recordFail('Non-Bearer header', `Expected 401, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Malformed JWT Token Structure
  // -------------------------------------------------------------
  {
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.with.too.many.segments.123'
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Malformed JWT token structure')) {
      recordPass('Malformed JWT structure returns 401 Unauthorized');
    } else {
      recordFail('Malformed JWT', `Expected 401, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Expired Session Token
  // -------------------------------------------------------------
  {
    const expiredToken = createTestToken('user-alice-123', -60);
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredToken}`
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('expired')) {
      recordPass('Expired session token returns 401 Unauthorized');
    } else {
      recordFail('Expired token', `Expected 401 expired error, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 6: Unsupported Signing Algorithm (alg: none)
  // -------------------------------------------------------------
  {
    const noneToken = createTestToken('user-attacker-none', 3600, { alg: 'none' });
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${noneToken}`
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Unsupported signing algorithm')) {
      recordPass('Unsupported signing algorithm (alg: none) returns 401 Unauthorized');
    } else {
      recordFail('alg: none token', `Expected 401 unsupported alg, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 7: Unsupported Signing Algorithm (alg: RS256)
  // -------------------------------------------------------------
  {
    const rsToken = createTestToken('user-attacker-rs', 3600, { alg: 'RS256' });
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rsToken}`
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Unsupported signing algorithm')) {
      recordPass('Unsupported signing algorithm (alg: RS256) returns 401 Unauthorized');
    } else {
      recordFail('alg: RS256 token', `Expected 401 unsupported alg, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 8: Invalid / Forged Cryptographic Signature
  // -------------------------------------------------------------
  {
    const forgedToken = createTestToken('user-forger-666', 3600, { secret: 'different_wrong_secret_123' });
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedToken}`
      },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('Invalid token signature')) {
      recordPass('Invalid cryptographic signature returns 401 Unauthorized');
    } else {
      recordFail('Forged signature', `Expected 401 invalid signature, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 9: Valid Authorized Event: Message with verified mutual conversation
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        title: 'New Message',
        message: 'Hey Bob!'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.callerId === 'user-alice-123' && res.payload.recipientId === 'user-bob-999') {
      recordPass('Valid authorized direct message event succeeds with bound callerId');
    } else {
      recordFail('Valid authorized message event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 10: Valid Authorized Event: Verified pending follow request
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'follow_request',
        title: 'Follow Request',
        message: 'Alice requested to follow you'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'follow_request') {
      recordPass('Valid authorized follow_request event succeeds');
    } else {
      recordFail('Valid follow_request event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 11: Valid Authorized Event: Verified accepted follow relationship
  // -------------------------------------------------------------
  {
    // Charlie was followed by Bob, and Charlie accepted
    const res = await authorizeAndVerifyPushNotification(
      'user-charlie-777',
      {
        recipientId: 'user-bob-999',
        type: 'follow_accepted',
        title: 'Follow Accepted',
        message: 'Charlie accepted your follow request'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'follow_accepted') {
      recordPass('Valid authorized follow_accepted event succeeds');
    } else {
      recordFail('Valid follow_accepted event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 12: Valid Authorized Event: Verified like on recipient post
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'like',
        entityId: 'post-bob-555',
        title: 'Post Liked',
        message: 'Alice liked your post'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'like') {
      recordPass('Valid authorized like event succeeds');
    } else {
      recordFail('Valid like event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 13: Valid Authorized Event: Verified comment on recipient post
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'comment',
        entityId: 'post-bob-555',
        title: 'New Comment',
        message: 'Alice commented on your post'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'comment') {
      recordPass('Valid authorized comment event succeeds');
    } else {
      recordFail('Valid comment event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 14: Valid Authorized Event: Verified mention of recipient
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'mention',
        entityId: 'post-alice-777',
        title: 'You were mentioned',
        message: 'Alice mentioned you in a post'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'mention') {
      recordPass('Valid authorized mention event succeeds');
    } else {
      recordFail('Valid mention event', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 15: Valid Authorized Event: Verified authoritative notification record
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'notification',
        entityId: 'notif-auth-123',
        title: 'Notification',
        message: 'Authoritative notification'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.type === 'notification') {
      recordPass('Valid authorized notification record succeeds');
    } else {
      recordFail('Valid notification record', `Unexpected result: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 16: Valid Authorized Event: Self-notification (test, system)
  // -------------------------------------------------------------
  {
    const testRes = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-alice-123',
        type: 'test',
        title: 'Test',
        message: 'Self test'
      },
      mockEventResolver
    );
    const systemRes = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-alice-123',
        type: 'system',
        title: 'System',
        message: 'Self system alert'
      },
      mockEventResolver
    );

    if (testRes.authorized && systemRes.authorized) {
      recordPass('Valid authorized self-notifications (test and system) succeed');
    } else {
      recordFail('Self notifications', 'Failed authorization for self notifications');
    }
  }

  // -------------------------------------------------------------
  // TEST 17: Missing Underlying Event: Message in non-existent conversation
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-missing-999',
        title: 'Fake Message',
        message: 'Ghost message'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 403 && (res.error.includes('do not share an authorized mutual conversation') || res.error.includes('Authoritative message record not found'))) {
      recordPass('Message notification referencing missing conversation is rejected with 403 Forbidden');
    } else {
      recordFail('Missing conversation event', `Expected 403, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 18: Missing Underlying Event: Unrequested follow request
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-dave-888',
      {
        recipientId: 'user-bob-999',
        type: 'follow_request',
        title: 'Fake Follow',
        message: 'Spam follow'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 403 && res.error.includes('No pending follow request exists')) {
      recordPass('Forged follow request lacking underlying pending database event is rejected with 403 Forbidden');
    } else {
      recordFail('Missing follow request event', `Expected 403, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 19: Missing Underlying Event: Like on unliked / non-existent post
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'like',
        entityId: 'post-unliked-888',
        title: 'Fake Like',
        message: 'Unliked post'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 403 && res.error.includes('No verified like event exists')) {
      recordPass('Forged like notification lacking underlying database like is rejected with 403 Forbidden');
    } else {
      recordFail('Missing like event', `Expected 403, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 20: Missing Underlying Event: Comment on uncommented post
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'comment',
        entityId: 'post-uncommented-777',
        title: 'Fake Comment',
        message: 'Fake comment'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 403 && res.error.includes('No verified comment event exists')) {
      recordPass('Forged comment notification lacking underlying database comment is rejected with 403 Forbidden');
    } else {
      recordFail('Missing comment event', `Expected 403, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 21: Forged Sender ID Neutralized
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        callerId: 'user-admin-root',
        senderId: 'user-victim-spoofed',
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        title: 'Spoofed Sender',
        message: 'Hello'
      },
      mockEventResolver
    );

    if (res.authorized && res.payload.callerId === 'user-alice-123' && !('senderId' in res.payload)) {
      recordPass('Client-supplied callerId/senderId are discarded; callerId is authoritatively bound to token identity');
    } else {
      recordFail('Forged sender ID', `Unexpected payload: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 22: Unrelated Recipient Blocked
  // -------------------------------------------------------------
  {
    // Alice references real conv-101 (between Alice and Bob), but targets Eve (not in conv-101)
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-eve-victim',
        type: 'message',
        entityId: 'conv-101',
        title: 'Harassing Ping',
        message: 'You are not in this conversation'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 403 && (res.error.includes('do not share an authorized mutual conversation') || res.error.includes('recipient is not in conversation'))) {
      recordPass('Notification targeting unrelated recipient not in conversation is blocked with 403 Forbidden');
    } else {
      recordFail('Unrelated recipient', `Expected 403, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 23: Forged / Unapproved Notification Type Rejection
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'admin_eval_arbitrary_cmd',
        message: 'Exploit'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 400 && res.error.includes('Invalid or unauthorized notification type')) {
      recordPass('Forged unapproved notification type is rejected with 400 Bad Request');
    } else {
      recordFail('Forged notification type', `Expected 400, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 24: Valid User but Unauthorized Recipient (Cross-User System/Test)
  // -------------------------------------------------------------
  {
    const crossSystem = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'system',
        message: 'Fake System Alert'
      },
      mockEventResolver
    );

    if (!crossSystem.authorized && crossSystem.status === 403 && crossSystem.error.includes('Cannot dispatch system or test notifications to other users')) {
      recordPass('System/test notifications targeting other users are rejected with 403 Forbidden');
    } else {
      recordFail('Cross-user system alert', `Expected 403, got: ${JSON.stringify(crossSystem)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 25: Valid User but Unauthorized Recipient (Self-Messaging)
  // -------------------------------------------------------------
  {
    const selfMessage = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-alice-123',
        type: 'message',
        entityId: 'conv-101',
        message: 'Self message'
      },
      mockEventResolver
    );

    if (!selfMessage.authorized && selfMessage.status === 400 && selfMessage.error.includes('Cannot send message or follow request notifications to self')) {
      recordPass('Self-messaging and self-follow-requests are rejected with 400 Bad Request');
    } else {
      recordFail('Self-messaging', `Expected 400, got: ${JSON.stringify(selfMessage)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 26: Malformed Payload: Missing recipientId
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification('user-alice-123', { type: 'message' }, mockEventResolver);
    if (!res.authorized && res.status === 400 && res.error.includes('Missing or invalid recipientId')) {
      recordPass('Missing recipientId is rejected with 400 Bad Request');
    } else {
      recordFail('Missing recipientId', `Expected 400, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 27: Malformed Payload: Missing Required entityId
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message'
      },
      mockEventResolver
    );

    if (!res.authorized && res.status === 400 && res.error.includes('Missing conversation entityId')) {
      recordPass('Message notification lacking entityId is rejected with 400 Bad Request');
    } else {
      recordFail('Missing entityId', `Expected 400, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 28: Malformed Payload: Non-Object Body
  // -------------------------------------------------------------
  {
    const res = await authorizeAndVerifyPushNotification('user-alice-123', 'string-payload', mockEventResolver);
    if (!res.authorized && res.status === 400 && res.error.includes('Request body must be an object')) {
      recordPass('Non-object request body is rejected with 400 Bad Request');
    } else {
      recordFail('Non-object body', `Expected 400, got: ${JSON.stringify(res)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 29: Payload URL Sanitization (Anti-XSS / Open-Redirect)
  // -------------------------------------------------------------
  {
    const jsUrl = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      url: 'javascript:alert(1)'
    });
    const externalUrl = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      url: 'https://evil.phishing.site.com'
    });
    const safeUrl = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      url: '/messages/conv-101'
    });

    if (
      jsUrl.authorized && jsUrl.payload.url === '/notifications' &&
      externalUrl.authorized && externalUrl.payload.url === '/notifications' &&
      safeUrl.authorized && safeUrl.payload.url === '/messages/conv-101'
    ) {
      recordPass('Unsafe URLs (javascript:, external) sanitized to safe default (/notifications)');
    } else {
      recordFail('URL sanitization', `Failed URL sanitization: ${JSON.stringify({ jsUrl, externalUrl, safeUrl })}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 30: Cross-User Subscription Registration Hijack Rejection
  // -------------------------------------------------------------
  {
    const crossSub = validatePushSubscription(
      'user-attacker-666',
      'user-victim-111',
      { endpoint: 'https://fcm.googleapis.com/fcm/send/attacker-sub' }
    );

    if (!crossSub.valid && crossSub.status === 403 && crossSub.error.includes('Forbidden')) {
      recordPass('Cross-user push subscription registration is rejected with 403 Forbidden');
    } else {
      recordFail('Cross-user subscription hijack', `Expected 403, got: ${JSON.stringify(crossSub)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 31: Insecure / Malformed Subscription Endpoint Rejection
  // -------------------------------------------------------------
  {
    const httpSub = validatePushSubscription('user-alice-123', 'user-alice-123', {
      endpoint: 'http://insecure-push.example.com/send'
    });
    const oversizeSub = validatePushSubscription('user-alice-123', 'user-alice-123', {
      endpoint: 'https://push.example.com/' + 'a'.repeat(1050)
    });

    if (!httpSub.valid && httpSub.status === 400 && !oversizeSub.valid && oversizeSub.status === 400) {
      recordPass('Insecure (non-HTTPS) or oversized subscription endpoints are rejected with 400 Bad Request');
    } else {
      recordFail('Insecure endpoint check', `Expected 400, got: ${JSON.stringify({ httpSub, oversizeSub })}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 32: Arbitrary Subscription Injection in send-web-push Ignored (Anti-SSRF)
  // -------------------------------------------------------------
  {
    const arbitrarySub = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      subscription: { endpoint: 'https://internal-service.local/admin' }
    });

    if (arbitrarySub.authorized && !('subscription' in arbitrarySub.payload)) {
      recordPass('Caller-injected subscription object in send-web-push is strictly ignored (anti-SSRF)');
    } else {
      recordFail('Anti-SSRF check', `Payload contained caller subscription: ${JSON.stringify(arbitrarySub)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 33: Mock Push Dispatch Execution with Authoritatively Bound Identity
  // -------------------------------------------------------------
  {
    const bobEndpoint = 'https://fcm.googleapis.com/fcm/send/bob-device-secure-endpoint';
    registerLocalSubscription('user-bob-999', {
      endpoint: bobEndpoint,
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
    });

    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        title: 'Hello Bob',
        message: 'Testing verified push delivery'
      },
      mockEventResolver
    );

    if (authResult.authorized) {
      const dispatchResult = await sendPushNotification(authResult.payload);
      if (dispatchResult && (dispatchResult.success || dispatchResult.message)) {
        recordPass('Push dispatcher executes delivery with authoritatively bound callerId and stored recipient subscription');
      } else {
        recordFail('Push dispatch execution', `Dispatch returned unexpected: ${JSON.stringify(dispatchResult)}`);
      }
    } else {
      recordFail('Push dispatch execution', 'Authorization step failed');
    }
  }

  // -------------------------------------------------------------
  // TEST 34: Request Abuse & Rate Limiting Enforcement
  // -------------------------------------------------------------
  {
    const rapidRepeat = await sendPushNotification({
      callerId: 'user-alice-123',
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      title: 'Spam Burst',
      message: 'Burst attempt'
    });

    if (rapidRepeat && rapidRepeat.success && rapidRepeat.throttled === true) {
      recordPass('Rapid repeat dispatch requests are throttled to prevent spam and abuse (throttled: true)');
    } else {
      recordFail('Rate limiting abuse constraint', `Expected throttled: true, got: ${JSON.stringify(rapidRepeat)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 35: Valid Authenticated Unregistration
  // -------------------------------------------------------------
  {
    const charlieEndpoint = 'https://fcm.googleapis.com/fcm/send/charlie-device-secure-endpoint';
    registerLocalSubscription('user-charlie-777', {
      endpoint: charlieEndpoint,
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
    });

    unregisterLocalSubscription('user-charlie-777', charlieEndpoint);

    const postUnregDispatch = await sendPushNotification({
      callerId: 'user-dave-888',
      recipientId: 'user-charlie-777',
      type: 'message',
      entityId: 'conv-charlie-dave',
      title: 'Hello Charlie',
      message: 'Are you there?'
    });

    if (postUnregDispatch && postUnregDispatch.success && postUnregDispatch.message?.includes('No active subscriptions')) {
      recordPass('Valid authenticated unregistration cleanly removes recipient device from dispatch list');
    } else {
      recordFail('Post-unregistration dispatch', `Expected no active subscriptions, got: ${JSON.stringify(postUnregDispatch)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 36: Replayed Event Deduplication (Idempotency Guard)
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();
    const eventKey = 'event:message:msg-replay-test-001';

    // First attempt acquires lock and marks dispatched
    const lock1 = idempStore.acquireLock(eventKey);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markDispatched(eventKey, { success: true, delivered: 1 });
    }

    // Replay attempt detects DISPATCHED and prevents duplicate dispatch
    const lock2 = idempStore.acquireLock(eventKey);
    if (lock2.state === 'DISPATCHED' && lock2.cachedResult?.delivered === 1) {
      recordPass('Replayed event is deduplicated and blocked from duplicate push dispatch (state: DISPATCHED)');
    } else {
      recordFail('Replay deduplication', `Expected state DISPATCHED, got: ${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 37: Concurrent Dispatch Lockout (Race Condition Prevention)
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();
    const raceKey = 'event:message:msg-race-test-002';

    // First concurrent request acquires lock
    const lock1 = idempStore.acquireLock(raceKey);
    // Second concurrent request arrives while first is IN_PROGRESS
    const lock2 = idempStore.acquireLock(raceKey);

    if (lock1.state === 'ACQUIRED' && lock2.state === 'IN_PROGRESS') {
      recordPass('Concurrent dispatch request is locked out from bypassing the guard (state: IN_PROGRESS / 409 Conflict)');
    } else {
      recordFail('Concurrent dispatch lockout', `Expected lock1 ACQUIRED & lock2 IN_PROGRESS, got: lock1=${lock1.state}, lock2=${lock2.state}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 38: Transient Failure Retry Behavior
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();
    const retryKey = 'event:message:msg-retry-test-003';

    // Initial attempt acquires lock but encounters transient failure
    const lock1 = idempStore.acquireLock(retryKey);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markFailed(retryKey, 'Transient gateway timeout 504');
    }

    // Subsequent retry re-acquires lock and completes successfully
    const lock2 = idempStore.acquireLock(retryKey);
    if (lock2.state === 'ACQUIRED') {
      idempStore.markDispatched(retryKey, { success: true, delivered: 1 });
      recordPass('Transient failure retry successfully re-acquires lock and delivers notification');
    } else {
      recordFail('Transient failure retry', `Expected state ACQUIRED on retry, got: ${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 39: Message Push Rejected When Sender is Not the Author
  // -------------------------------------------------------------
  {
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-forged-author' // Message authored by Bob, not Alice
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('caller is not message author')) {
      recordPass('Message notification referencing message authored by someone else is rejected with 403 Forbidden');
    } else {
      recordFail('Message author verification', `Expected 403 caller is not author, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 40: Message Push Rejected Without Authoritative Message Record
  // -------------------------------------------------------------
  {
    // Conversation membership exists, but message ID does not exist in messages table
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-non-existent-999'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('Authoritative message record not found')) {
      recordPass('Message push rejected when message does not exist (conversation membership alone is insufficient)');
    } else {
      recordFail('Message event existence check', `Expected 403 message not found, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 41: Follow Accepted Push Rejected Without Authoritative State Transition
  // -------------------------------------------------------------
  {
    // Bob and Charlie have an old accepted relationship, but no active acceptance event/transition
    const authResult = await authorizeAndVerifyPushNotification(
      'user-bob-999',
      {
        recipientId: 'user-charlie-777',
        type: 'follow_accepted',
        eventId: 'req-bob-charlie-stale'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('No authoritative follow acceptance event exists')) {
      recordPass('Follow accepted push rejected when no authoritative state transition event occurred (status: 403)');
    } else {
      recordFail('Follow acceptance transition check', `Expected 403 transition missing, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 42: Comment Push Rejected When Caller is Not Comment Author
  // -------------------------------------------------------------
  {
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'comment',
        entityId: 'comment-forged-999'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('No verified comment event exists')) {
      recordPass('Comment push rejected when caller is not the verified comment author (status: 403)');
    } else {
      recordFail('Comment author check', `Expected 403 comment author mismatch, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 43: Mention Push Rejected When Content Does Not Mention Recipient
  // -------------------------------------------------------------
  {
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'mention',
        entityId: 'post-alice-nomention' // Alice authored post, but does not mention Bob
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('No verified mention event exists')) {
      recordPass('Mention push rejected when authored content does not mention recipient (status: 403)');
    } else {
      recordFail('Mention verification check', `Expected 403 mention missing, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 44: Replay Bypass Audit: Same Real Message Requested with Two Different Client Idempotency Keys
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();

    // Client request 1 with client-generated key A
    const req1 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      eventId: 'msg-valid-101',
      idempotencyKey: 'client-key-attempt-AAA'
    });
    const key1 = computePushEventIdempotencyKey(req1.payload);
    const lock1 = idempStore.acquireLock(key1);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markDispatched(key1, { success: true, delivered: 1 });
    }

    // Client request 2 for the SAME underlying message with client-generated key B
    const req2 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      eventId: 'msg-valid-101',
      idempotencyKey: 'client-key-attempt-BBB'
    });
    const key2 = computePushEventIdempotencyKey(req2.payload);
    const lock2 = idempStore.acquireLock(key2);

    // Assert that the authoritative event identity controlled deduplication (key1 === key2)
    // and lock2 returned DISPATCHED, completely preventing replay bypass
    if (key1 === key2 && lock2.state === 'DISPATCHED' && lock2.cachedResult?.delivered === 1) {
      recordPass('Replay bypass prevented: Different client idempotency keys for same message resolve to identical event key (state: DISPATCHED)');
    } else {
      recordFail('Message idempotency key bypass check', `Bypass detected! key1=${key1}, key2=${key2}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 45: Replay Bypass Audit: Same Like Event Requested with Different Client Keys
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();

    // Alice likes Bob's post post-bob-555
    const req1 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'like',
      entityId: 'post-bob-555',
      idempotencyKey: 'like-key-111'
    });
    const key1 = computePushEventIdempotencyKey(req1.payload);
    const lock1 = idempStore.acquireLock(key1);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markDispatched(key1, { success: true, delivered: 1 });
    }

    // Alice attempts second like push with different client idempotency key
    const req2 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'like',
      entityId: 'post-bob-555',
      idempotencyKey: 'like-key-222'
    });
    const key2 = computePushEventIdempotencyKey(req2.payload);
    const lock2 = idempStore.acquireLock(key2);

    if (key1 === key2 && lock2.state === 'DISPATCHED') {
      recordPass('Replay bypass prevented: Same like event with varying client keys resolves to identical event key');
    } else {
      recordFail('Like idempotency key bypass check', `Bypass detected! key1=${key1}, key2=${key2}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 46: Replay Bypass Audit: Same Follow Request with Different Client Keys
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();

    const req1 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'follow_request',
      eventId: 'req-alice-bob',
      idempotencyKey: 'fr-key-alpha'
    });
    const key1 = computePushEventIdempotencyKey(req1.payload);
    const lock1 = idempStore.acquireLock(key1);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markDispatched(key1, { success: true, delivered: 1 });
    }

    const req2 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'follow_request',
      eventId: 'req-alice-bob',
      idempotencyKey: 'fr-key-beta'
    });
    const key2 = computePushEventIdempotencyKey(req2.payload);
    const lock2 = idempStore.acquireLock(key2);

    if (key1 === key2 && lock2.state === 'DISPATCHED') {
      recordPass('Replay bypass prevented: Same follow request with varying client keys resolves to identical event key');
    } else {
      recordFail('Follow request key bypass check', `Bypass detected! key1=${key1}, key2=${key2}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 47: Concurrency Guard: Concurrent Requests for the Same Authoritative Event
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();
    const eventPayload = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      eventId: 'msg-valid-101'
    }).payload;

    const eventKey = computePushEventIdempotencyKey(eventPayload);

    // Request 1 acquires lock
    const lock1 = idempStore.acquireLock(eventKey);
    // Request 2 arrives while Request 1 is IN_PROGRESS
    const lock2 = idempStore.acquireLock(eventKey);

    if (lock1.state === 'ACQUIRED' && lock2.state === 'IN_PROGRESS') {
      recordPass('Concurrency lockout: Concurrent request for same event receives IN_PROGRESS (409 Conflict)');
    } else {
      recordFail('Concurrency lockout', `Expected ACQUIRED then IN_PROGRESS, got: lock1=${lock1.state}, lock2=${lock2.state}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 48: Legitimate New Event from Same Caller to Same Recipient
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();

    // Alice dispatches message 1 (msg-valid-101)
    const req1 = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      eventId: 'msg-valid-101'
    });
    const key1 = computePushEventIdempotencyKey(req1.payload);
    const lock1 = idempStore.acquireLock(key1);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markDispatched(key1, { success: true, delivered: 1 });
    }

    // Alice dispatches a separate, distinct new message 2 (msg-valid-102) to Bob
    const auth2 = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-valid-102'
      },
      mockEventResolver
    );
    const key2 = computePushEventIdempotencyKey(auth2.payload);
    const lock2 = idempStore.acquireLock(key2);

    if (auth2.authorized && key1 !== key2 && lock2.state === 'ACQUIRED') {
      recordPass('Legitimate new event from same caller to same recipient acquires lock and delivers normally');
    } else {
      recordFail('Legitimate new event dispatch', `Expected distinct key & ACQUIRED, got: key1=${key1}, key2=${key2}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 49: Retry Behavior After Simulated Transient Dispatch Failure
  // -------------------------------------------------------------
  {
    const idempStore = new MemoryPushIdempotencyStore();
    const eventPayload = authorizePushNotificationRequest('user-alice-123', {
      recipientId: 'user-bob-999',
      type: 'message',
      entityId: 'conv-101',
      eventId: 'msg-transient-504'
    }).payload;
    const eventKey = computePushEventIdempotencyKey(eventPayload);

    // Initial attempt acquires lock but encounters transient network failure
    const lock1 = idempStore.acquireLock(eventKey);
    if (lock1.state === 'ACQUIRED') {
      idempStore.markFailed(eventKey, 'Transient upstream gateway 504 Gateway Timeout');
    }

    // Subsequent retry request arrives
    const lock2 = idempStore.acquireLock(eventKey);
    if (lock2.state === 'ACQUIRED') {
      idempStore.markDispatched(eventKey, { success: true, delivered: 1 });
      recordPass('Retry after transient dispatch failure cleanly re-acquires lock and completes delivery');
    } else {
      recordFail('Transient failure retry', `Expected state ACQUIRED on retry, got: ${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 50: Reusing Event Identifier with Different Recipient Rejected
  // -------------------------------------------------------------
  {
    // msg-valid-101 was sent in conv-101 (Alice and Bob).
    // Caller Alice attempts to reuse msg-valid-101 targeting Charlie (who is NOT in conv-101)
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-charlie-777',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-valid-101'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && (authResult.error.includes('recipient is not in conversation') || authResult.error.includes('Authoritative message record not found'))) {
      recordPass('Attempt to reuse event identifier with a different recipient is rejected with 403 Forbidden');
    } else {
      recordFail('Event reuse with different recipient', `Expected 403 Forbidden, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 51: Reusing Event Identifier with Different Notification Type Rejected
  // -------------------------------------------------------------
  {
    // msg-valid-101 is a message record.
    // Caller Alice attempts to reuse msg-valid-101 claiming it is a like event
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'like',
        entityId: 'msg-valid-101'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.status === 403 && authResult.error.includes('No verified like event exists')) {
      recordPass('Attempt to reuse event identifier with a different notification type is rejected with 403 Forbidden');
    } else {
      recordFail('Event reuse with different notification type', `Expected 403 Forbidden, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 52: Event Freshness: Old Event Rejected (No Dispatch, No UI Error)
  // -------------------------------------------------------------
  {
    // msg-stale-202 is 1 hour old (> 10 minutes)
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-stale-202'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.stale === true && authResult.suppressed === true && authResult.status === 200 && authResult.reason === 'stale_event') {
      recordPass('Old authoritative event (>10m) rejected with 200 suppressed (no dispatch, no UI error)');
    } else {
      recordFail('Event freshness rejection', `Expected stale suppressed status 200, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 53: Event Freshness: Fresh Event Allowed
  // -------------------------------------------------------------
  {
    // msg-fresh-201 is fresh (Date.now())
    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-fresh-201'
      },
      mockEventResolver
    );

    if (authResult.authorized && authResult.payload) {
      recordPass('Fresh authoritative event (<10m) allowed for dispatch');
    } else {
      recordFail('Fresh event allowed', `Expected authorized: true, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 54: Event Freshness: Follow Accepted Long Ago Then Re-Requested -> No Push
  // -------------------------------------------------------------
  {
    // req-bob-charlie-old was accepted 2 hours ago (> 10 minutes)
    const authResult = await authorizeAndVerifyPushNotification(
      'user-charlie-777',
      {
        recipientId: 'user-bob-999',
        type: 'follow_accepted',
        eventId: 'req-bob-charlie-old'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.stale === true && authResult.suppressed === true && authResult.status === 200) {
      recordPass('Follow accepted long ago then re-requested rejected without dispatch (stale suppressed)');
    } else {
      recordFail('Follow accepted freshness', `Expected stale suppressed status 200, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 55: Content Visibility: Mention of User Who Cannot View Private Post -> No Push
  // -------------------------------------------------------------
  {
    // user-private-owner authored post-private-owner-1 (private profile).
    // user-eve-unauthorized is NOT an accepted follower.
    const authResult = await authorizeAndVerifyPushNotification(
      'user-private-owner',
      {
        recipientId: 'user-eve-unauthorized',
        type: 'mention',
        entityId: 'post-private-owner-1',
        eventId: 'mention-private-eve'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.suppressed === true && authResult.reason === 'content_visibility_restricted' && authResult.status === 200) {
      recordPass('Mention of user who cannot view private post is suppressed with status 200 (no push)');
    } else {
      recordFail('Private post mention visibility', `Expected suppressed content_visibility_restricted, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 56: Content Visibility: Mention of Accepted Follower on Private Post Allowed
  // -------------------------------------------------------------
  {
    // user-bob-999 is an accepted follower of user-private-owner.
    const authResult = await authorizeAndVerifyPushNotification(
      'user-private-owner',
      {
        recipientId: 'user-bob-999',
        type: 'mention',
        entityId: 'post-private-owner-1',
        eventId: 'mention-private-bob'
      },
      mockEventResolver
    );

    if (authResult.authorized && authResult.payload) {
      recordPass('Mention of accepted follower on private post is authorized for push delivery');
    } else {
      recordFail('Accepted follower mention visibility', `Expected authorized: true, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 57: Social Blocks: Blocked Pair -> No Push (Direction A -> B)
  // -------------------------------------------------------------
  {
    // user-blocked-alpha has blocked user-blocked-beta
    const authResult = await authorizeAndVerifyPushNotification(
      'user-blocked-alpha',
      {
        recipientId: 'user-blocked-beta',
        type: 'follow_request'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.suppressed === true && authResult.reason === 'blocked_relationship' && authResult.status === 200) {
      recordPass('Blocked relationship suppresses push in direction A -> B (no push, status 200)');
    } else {
      recordFail('Block suppression A->B', `Expected suppressed blocked_relationship, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 58: Social Blocks: Blocked Pair -> No Push (Direction B -> A)
  // -------------------------------------------------------------
  {
    // Direction B -> A: user-blocked-beta targeting user-blocked-alpha
    const authResult = await authorizeAndVerifyPushNotification(
      'user-blocked-beta',
      {
        recipientId: 'user-blocked-alpha',
        type: 'follow_request'
      },
      mockEventResolver
    );

    if (!authResult.authorized && authResult.suppressed === true && authResult.reason === 'blocked_relationship' && authResult.status === 200) {
      recordPass('Blocked relationship suppresses push in reverse direction B -> A (bidirectional enforcement)');
    } else {
      recordFail('Block suppression B->A', `Expected suppressed blocked_relationship, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // SHARED MOCK PG CLIENT FACTORY FOR DURABLE IDEMPOTENCY TESTS
  // -------------------------------------------------------------
  function createMockPg() {
    const db = new Map();
    return {
      from: (_t) => ({
        insert: (rows) => ({
          select: () => ({
            maybeSingle: async () => {
              const r = rows[0];
              if (db.has(r.key)) return { data: null, error: { code: '23505' } };
              db.set(r.key, { ...r, created_at: new Date().toISOString() });
              return { data: { key: r.key }, error: null };
            }
          })
        }),
        select: () => ({
          eq: (_c, val) => ({
            maybeSingle: async () => ({ data: db.get(val) || null, error: null })
          })
        }),
        update: (u) => ({
          eq: (_c, val) => {
            const applyUpdate = () => {
              const existing = db.get(val);
              if (existing) {
                const updated = { ...existing, ...u };
                db.set(val, updated);
                return updated;
              }
              return null;
            };
            return {
              then: (resolve, reject) => {
                applyUpdate();
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              },
              select: () => ({
                maybeSingle: async () => {
                  const updated = applyUpdate();
                  if (!updated) return { data: null, error: null };
                  return { data: { key: val }, error: null };
                }
              }),
              maybeSingle: async () => {
                applyUpdate();
                return { data: null, error: null };
              }
            };
          }
        })
      })
    };
  }

  // -------------------------------------------------------------
  // TEST 59: Durable Idempotency (Postgres Store): Replay Deduplication Verified
  // -------------------------------------------------------------
  {
    const pgClient = createMockPg();
    const pgStore = new PostgresPushIdempotencyStore(pgClient);
    const testKey = 'event:message:msg-pg-test-01:user-charlie';

    // 1. Initial lock acquisition
    const lock1 = await pgStore.acquireLock(testKey);
    // 2. Mark dispatched with 7-day retention
    await pgStore.markDispatched(testKey, { delivered: 1, success: true });
    // 3. Second call with same key -> DISPATCHED
    const lock2 = await pgStore.acquireLock(testKey);

    const rec = await pgStore.getRecord(testKey);
    const expiresMs = new Date(rec.expires_at).getTime();
    const isSevenDayRetention = expiresMs - Date.now() >= 6 * 24 * 3600 * 1000;

    if (lock1.state === 'ACQUIRED' && lock2.state === 'DISPATCHED' && isSevenDayRetention) {
      recordPass('Durable Postgres store: Replay deduplication verified with >=7 days retention');
    } else {
      recordFail('Durable Postgres replay deduplication', `lock1=${JSON.stringify(lock1)}, lock2=${JSON.stringify(lock2)}, 7day=${isSevenDayRetention}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 60: Durable Idempotency (Postgres Store): Concurrency Lock Verified
  // -------------------------------------------------------------
  {
    const pgClient = createMockPg();
    const pgStore = new PostgresPushIdempotencyStore(pgClient);
    const testKey = 'event:message:msg-pg-concurrent-02:user-charlie';

    const lock1 = await pgStore.acquireLock(testKey);
    const lock2 = await pgStore.acquireLock(testKey);

    if (lock1.state === 'ACQUIRED' && lock2.state === 'IN_PROGRESS') {
      recordPass('Durable Postgres store: Concurrency lockout (IN_PROGRESS) verified');
    } else {
      recordFail('Durable Postgres concurrency', `lock1=${JSON.stringify(lock1)}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 61: Durable Idempotency (Postgres Store): Transient Failure Retry
  // -------------------------------------------------------------
  {
    const pgClient = createMockPg();
    const pgStore = new PostgresPushIdempotencyStore(pgClient);
    const testKey = 'event:message:msg-pg-transient-03:user-charlie';

    // 1. Initial attempt fails
    const lock1 = await pgStore.acquireLock(testKey);
    await pgStore.markFailed(testKey, 'Transient HTTP 503 Service Unavailable');
    // 2. Retry attempt re-acquires lock
    const lock2 = await pgStore.acquireLock(testKey);

    if (lock1.state === 'ACQUIRED' && lock2.state === 'ACQUIRED') {
      recordPass('Durable Postgres store: Transient failure retry re-acquires lock cleanly');
    } else {
      recordFail('Durable Postgres transient retry', `lock1=${JSON.stringify(lock1)}, lock2=${JSON.stringify(lock2)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 62: Server Lookup Client: Block Lookup Error Fails Closed (No Push, Status 500)
  // -------------------------------------------------------------
  {
    // Resolver whose isBlocked throws an error (e.g. database failure / timeout)
    const erroringBlockResolver = {
      ...mockEventResolver,
      isBlocked: async () => {
        throw new Error('Database connection reset during block lookup');
      }
    };

    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-fresh-201'
      },
      erroringBlockResolver
    );

    // Must NOT be treated as not blocked; must NOT return authorized: true; must fail closed with 500
    if (!authResult.authorized && authResult.status === 500 && authResult.error && !authResult.suppressed) {
      recordPass('Block lookup error fails closed with 500 Server Error (not treated as "not blocked")');
    } else {
      recordFail('Block lookup error fail-closed', `Expected status 500 fail closed, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 63: Server Lookup Client: Missing Server Key Fails Closed (Status 500)
  // -------------------------------------------------------------
  {
    const origKey = process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SECRET_KEY;

    try {
      // Call authorizeAndVerifyPushNotification without passing custom resolver
      const authResult = await authorizeAndVerifyPushNotification(
        'user-alice-123',
        {
          recipientId: 'user-bob-999',
          type: 'message',
          entityId: 'conv-101',
          eventId: 'msg-fresh-201'
        }
      );

      if (!authResult.authorized && authResult.status === 500 && authResult.error && authResult.error.includes('SUPABASE_SECRET_KEY')) {
        recordPass('Missing server key (SUPABASE_SECRET_KEY) fails closed with status 500');
      } else {
        recordFail('Missing server key fail-closed', `Expected status 500 mentioning SUPABASE_SECRET_KEY, got: ${JSON.stringify(authResult)}`);
      }
    } finally {
      if (origKey !== undefined) {
        process.env.SUPABASE_SECRET_KEY = origKey;
      }
    }
  }

  // -------------------------------------------------------------
  // TEST 64: Server Lookup Client: Missing Block Check Capability Fails Closed (Status 500)
  // -------------------------------------------------------------
  {
    // Resolver completely lacking isBlocked function
    const resolverWithoutBlock = {
      ...mockEventResolver,
      isBlocked: undefined
    };

    const authResult = await authorizeAndVerifyPushNotification(
      'user-alice-123',
      {
        recipientId: 'user-bob-999',
        type: 'message',
        entityId: 'conv-101',
        eventId: 'msg-fresh-201'
      },
      resolverWithoutBlock
    );

    if (!authResult.authorized && authResult.status === 500 && authResult.error && authResult.error.includes('Block check capability required')) {
      recordPass('Missing block check capability fails closed with 500 Server Error');
    } else {
      recordFail('Missing block capability fail-closed', `Expected status 500 mentioning Block check capability, got: ${JSON.stringify(authResult)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 65: Server Push Dispatcher: Outside Test Mode, Missing Server Key Fails Closed
  // -------------------------------------------------------------
  {
    const origEnv = process.env.NODE_ENV;
    const origKey = process.env.SUPABASE_SECRET_KEY;
    const origUrl = process.env.SUPABASE_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_URL;

      const result = await sendPushNotification({
        recipientId: 'user-bob-999',
        type: 'message',
        message: 'Hello'
      });

      // Must fail closed: success === false, error present; must NOT report success: true with delivered: 0
      if (result.success === false && result.error && result.error.includes('Database client credentials missing')) {
        recordPass('serverPushDispatcher outside test mode fails closed on missing credentials (no silent fallback)');
      } else {
        recordFail('serverPushDispatcher missing credentials', `Expected success: false with credentials error, got: ${JSON.stringify(result)}`);
      }
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origKey !== undefined) process.env.SUPABASE_SECRET_KEY = origKey;
      if (origUrl !== undefined) process.env.SUPABASE_URL = origUrl;
    }
  }

  // -------------------------------------------------------------
  // TEST 66: Server Push Dispatcher: Outside Test Mode, Subscription Query Error Fails Closed
  // -------------------------------------------------------------
  {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const mockFailingClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: null,
                error: { message: 'Connection terminated unexpectedly during subscription query' }
              })
            })
          })
        })
      };

      const result = await sendPushNotification({
        recipientId: 'user-db-err-recipient',
        type: 'message',
        message: 'Hello',
        customClient: mockFailingClient
      });

      // Must fail closed: success === false, error present; must NOT report success: true with delivered: 0
      if (result.success === false && result.error && result.error.includes('Database error fetching recipient subscriptions')) {
        recordPass('serverPushDispatcher outside test mode fails closed on subscription DB query error (no silent fallback)');
      } else {
        recordFail('serverPushDispatcher DB query error', `Expected success: false with subscription error, got: ${JSON.stringify(result)}`);
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  }

  // -------------------------------------------------------------
  // TEST 67: Postgres Idempotency Store: Missing Admin Client Fails Closed (No Memory Fallback)
  // -------------------------------------------------------------
  {
    const origKey = process.env.SUPABASE_SECRET_KEY;
    const origUrl = process.env.SUPABASE_URL;

    try {
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_URL;

      const store = new PostgresPushIdempotencyStore(null);
      let threw = false;
      let errorMsg = '';

      try {
        await store.acquireLock('event:message:msg-fail-test:user-charlie');
      } catch (err) {
        threw = true;
        errorMsg = err.message;
      }

      if (threw && errorMsg.includes('Unable to create database client for postgres idempotency store')) {
        recordPass('PostgresPushIdempotencyStore fails closed when admin client cannot be created (never falls back to memory)');
      } else {
        recordFail('Postgres store missing client fail-closed', `Expected throw with Unable to create database client, threw=${threw}, msg=${errorMsg}`);
      }
    } finally {
      if (origKey !== undefined) process.env.SUPABASE_SECRET_KEY = origKey;
      if (origUrl !== undefined) process.env.SUPABASE_URL = origUrl;
    }
  }

  // -------------------------------------------------------------
  // TEST 68: Active Store Selection: PUSH_IDEMPOTENCY_STORE=postgres Fails Closed Without Client
  // -------------------------------------------------------------
  {
    const origStoreEnv = process.env.PUSH_IDEMPOTENCY_STORE;
    const origKey = process.env.SUPABASE_SECRET_KEY;

    try {
      process.env.PUSH_IDEMPOTENCY_STORE = 'postgres';
      delete process.env.SUPABASE_SECRET_KEY;

      const activeStore = getActivePushIdempotencyStore();
      let threw = false;
      let errorMsg = '';

      try {
        await activeStore.acquireLock('event:message:msg-active-pg-test:user-dave');
      } catch (err) {
        threw = true;
        errorMsg = err.message;
      }

      if (threw && errorMsg.includes('Unable to create database client for postgres idempotency store')) {
        recordPass('getActivePushIdempotencyStore() with PUSH_IDEMPOTENCY_STORE=postgres fails closed without falling back to memory');
      } else {
        recordFail('Active postgres store fail-closed', `Expected throw with Unable to create database client, threw=${threw}, msg=${errorMsg}`);
      }
    } finally {
      process.env.PUSH_IDEMPOTENCY_STORE = origStoreEnv || 'memory';
      if (origKey !== undefined) process.env.SUPABASE_SECRET_KEY = origKey;
    }
  }

  console.log(`\n================================================================`);
  console.log(`FINAL WEB PUSH SECURITY RESULTS: ${passed} / ${total} PASSED`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPushSecurityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
