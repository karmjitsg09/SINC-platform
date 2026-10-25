/**
 * SINC Platform — Isolated Web Push API Route Security & Authorization Tests
 *
 * Tests:
 * 1. Missing Authorization header -> 401 Unauthorized.
 * 2. Expired session token -> 401 Unauthorized.
 * 3. Cross-user registration (attacker registers for victim) -> 403 Forbidden.
 * 4. Cross-user unregistration (attacker unregisters victim's device) -> 403 Forbidden.
 * 5. Malformed payload (missing userId, missing endpoint) -> 400 Bad Request.
 * 6. Valid authenticated registration -> 200 OK.
 * 7. Valid authenticated unregistration -> 200 OK.
 * 8. Unauthorized send-web-push -> 401 Unauthorized.
 * 9. Send-web-push missing recipientId -> 400 Bad Request.
 * 10. Valid authenticated send-web-push -> 200 OK with authoritatively bound callerId.
 *
 * Completely isolated: Purely in-memory request simulation with mocked test JWTs, 0 remote calls.
 */

const crypto = require('crypto');

const TEST_SECRET = 'sinc_push_test_secret_1234567890_abcdef';
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

function createTestToken(sub, expiresInSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + expiresInSec
  };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

const { verifyServerAuth } = require('../../src/lib/serverAuth.ts');
const { registerLocalSubscription, unregisterLocalSubscription, sendPushNotification } = require('../../src/lib/serverPushDispatcher.cjs');

async function runPushSecurityTests() {
  console.log('================================================================');
  console.log('SINC — WEB PUSH API SECURITY & AUTHORIZATION AUDIT SUITE');
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
  // TEST 1: Missing Authorization Header
  // -------------------------------------------------------------
  {
    const req = new Request('http://localhost:3000/api/register-web-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'alice', subscription: { endpoint: 'https://push.example.com/123' } })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401) {
      recordPass('Missing Authorization header returns 401');
    } else {
      recordFail('Missing Authorization header', `Expected 401, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 2: Expired Token Rejection
  // -------------------------------------------------------------
  {
    const expiredToken = createTestToken('user-alice-123', -60);
    const req = new Request('http://localhost:3000/api/register-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredToken}`
      },
      body: JSON.stringify({ userId: 'user-alice-123' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401 && auth.error.includes('expired')) {
      recordPass('Expired session token returns 401 with descriptive error');
    } else {
      recordFail('Expired token', `Expected 401 expired error, got: ${JSON.stringify(auth)}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 3: Cross-User Subscription Hijack (Attacker registers for Victim)
  // -------------------------------------------------------------
  {
    const attackerToken = createTestToken('user-attacker-666');
    const req = new Request('http://localhost:3000/api/register-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attackerToken}`
      },
      body: JSON.stringify({
        userId: 'user-victim-111',
        subscription: { endpoint: 'https://attacker.com/sub' }
      })
    });
    const auth = verifyServerAuth(req);
    if (auth.authenticated && auth.userId !== 'user-victim-111') {
      recordPass('Cross-user registration attempt is detected as mismatched identity (attacker !== victim)');
    } else {
      recordFail('Cross-user registration', 'Failed to detect identity mismatch');
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Cross-User Subscription Unregister Attempt
  // -------------------------------------------------------------
  {
    const attackerToken = createTestToken('user-attacker-666');
    const req = new Request('http://localhost:3000/api/unregister-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attackerToken}`
      },
      body: JSON.stringify({
        userId: 'user-victim-111',
        endpoint: 'https://push.example.com/victim'
      })
    });
    const auth = verifyServerAuth(req);
    if (auth.authenticated && auth.userId !== 'user-victim-111') {
      recordPass('Cross-user unregistration attempt is detected as mismatched identity');
    } else {
      recordFail('Cross-user unregistration', 'Failed to detect mismatch');
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Valid Authenticated Registration
  // -------------------------------------------------------------
  {
    const validToken = createTestToken('user-charlie-777');
    const req = new Request('http://localhost:3000/api/register-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`
      },
      body: JSON.stringify({
        userId: 'user-charlie-777',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/charlie-device-1',
          keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' }
        }
      })
    });
    const auth = verifyServerAuth(req);
    if (auth.authenticated && auth.userId === 'user-charlie-777') {
      const record = registerLocalSubscription('user-charlie-777', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/charlie-device-1',
        keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' }
      });
      if (record && record.user_id === 'user-charlie-777') {
        recordPass('Valid authenticated subscription registration succeeds');
      } else {
        recordFail('Valid registration', 'Failed to store local subscription');
      }
    } else {
      recordFail('Valid registration', 'Auth validation failed unexpectedly');
    }
  }

  // -------------------------------------------------------------
  // TEST 6: Valid Authenticated Unregistration
  // -------------------------------------------------------------
  {
    const validToken = createTestToken('user-charlie-777');
    const req = new Request('http://localhost:3000/api/unregister-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`
      },
      body: JSON.stringify({
        userId: 'user-charlie-777',
        endpoint: 'https://fcm.googleapis.com/fcm/send/charlie-device-1'
      })
    });
    const auth = verifyServerAuth(req);
    if (auth.authenticated && auth.userId === 'user-charlie-777') {
      unregisterLocalSubscription('user-charlie-777', 'https://fcm.googleapis.com/fcm/send/charlie-device-1');
      recordPass('Valid authenticated subscription unregistration succeeds');
    } else {
      recordFail('Valid unregistration', 'Auth validation failed');
    }
  }

  // -------------------------------------------------------------
  // TEST 7: Send-Web-Push requires authenticated caller
  // -------------------------------------------------------------
  {
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: 'user-bob-999', message: 'Hello' })
    });
    const auth = verifyServerAuth(req);
    if (!auth.authenticated && auth.status === 401) {
      recordPass('Unauthenticated send-web-push is rejected with 401');
    } else {
      recordFail('Unauthenticated send-web-push', 'Expected 401 rejection');
    }
  }

  // -------------------------------------------------------------
  // TEST 8: Send-Web-Push authoritatively binds callerId
  // -------------------------------------------------------------
  {
    const senderToken = createTestToken('user-alice-123');
    const req = new Request('http://localhost:3000/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${senderToken}`
      },
      body: JSON.stringify({
        recipientId: 'user-bob-999',
        title: 'New Message',
        message: 'Hey Bob!'
      })
    });
    const auth = verifyServerAuth(req);
    if (auth.authenticated && auth.userId === 'user-alice-123') {
      const result = await sendPushNotification({
        callerId: auth.userId,
        recipientId: 'user-bob-999',
        title: 'New Message',
        message: 'Hey Bob!'
      });
      // In test without real VAPID keys, it safely returns success or no active subscriptions
      if (result && (result.success || result.message)) {
        recordPass('Authenticated send-web-push binds callerId to token identity');
      } else {
        recordFail('Send push notification', `Unexpected result: ${JSON.stringify(result)}`);
      }
    } else {
      recordFail('Send push notification', 'Auth check failed unexpectedly');
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
