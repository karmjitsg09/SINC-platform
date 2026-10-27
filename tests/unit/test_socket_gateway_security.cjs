/**
 * SINC Platform — Isolated Socket.IO Gateway Security & Authentication Tests
 *
 * Comprehensive audit suite verifying:
 * 1. Missing verification configuration fail-closed behavior
 * 2. Missing token handshake rejection
 * 3. Malformed token structure rejection
 * 4. Asymmetric token: Expired ES256 token rejected
 * 5. Asymmetric token: Forged ES256 signature rejected
 * 6. Asymmetric token: Untrusted key (not in JWKS) rejected
 * 7. Symmetric token: Expired HS256 token rejected
 * 8. Symmetric token: Forged HS256 signature rejected
 * 9. Unsupported algorithm (alg: none) rejected
 * 10. Identity spoofing (client-supplied userId != token sub) rejected
 * 11. Valid asymmetric ES256 token connects successfully and authoritatively binds userId
 * 12. Valid symmetric HS256 token connects successfully when secret configured
 * 13. Room join protection: Cannot join another user's personal room
 * 14. Ephemeral typing authorization: authoritatively bound to verified token identity
 * 15. Notification relay: authoritatively bound to verified token identity
 * 16. Presence query: authoritatively reports verified token identities
 * 17. Real Supabase Staging Login Token: Connects to socket gateway with real ES256 JWKS verification
 */

const http = require('http');
const crypto = require('crypto');
const { io: Client } = require('socket.io-client');
const { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } = require('jose');
const { createClient } = require('@supabase/supabase-js');

const TEST_SECRET = 'sinc_test_jwt_secret_do_not_use_in_prod_1234567890';
const TEST_PORT = 3099;

// Configure test environment variables before requiring server module
process.env.SOCKET_PORT = String(TEST_PORT);
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

const { server, io, verifySupabaseToken, setCustomJwksOverride } = require('../../backend/socket-gateway/server.js');

function createSymmetricToken(sub, expiresInSec = 3600, customClaims = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
    iat: Math.floor(Date.now() / 1000),
    ...customClaims
  };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log('SINC — SOCKET.IO GATEWAY SECURITY & AUTHENTICATION AUDIT SUITE');
  console.log('================================================================\n');

  // Setup local EC key pair and local JWKS for fast offline asymmetric testing
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const testJwk = await exportJWK(publicKey);
  testJwk.kid = 'test-es256-local-kid';
  const localJwks = createLocalJWKSet({ keys: [testJwk] });
  setCustomJwksOverride(localJwks);

  // Generate an untrusted key pair (not in JWKS)
  const untrustedKeys = await generateKeyPair('ES256');

  async function createAsymmetricToken(sub, expiresInSec = 3600, customClaims = {}, signingKey = privateKey, kid = 'test-es256-local-kid') {
    return new SignJWT({
      sub,
      aud: 'authenticated',
      role: 'authenticated',
      ...customClaims
    })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .setIssuer('https://bqmylyedpjeutxhcvmrf.supabase.co/auth/v1')
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSec)
      .sign(signingKey);
  }

  // Start test server
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[SETUP] Isolated test gateway listening on port ${TEST_PORT}\n`);

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

  try {
    // -------------------------------------------------------------
    // TEST 1: Missing Verification Configuration Fail-Closed
    // -------------------------------------------------------------
    {
      const originalSecret = process.env.SUPABASE_JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;
      const validToken = createSymmetricToken('user-alice-123');
      const noSecretResult = await verifySupabaseToken(validToken);
      process.env.SUPABASE_JWT_SECRET = originalSecret;

      if (!noSecretResult.valid && noSecretResult.error.includes('SUPABASE_JWT_SECRET required')) {
        recordPass('Missing verification configuration fails closed safely');
      } else {
        recordFail('Missing verification configuration', `Expected fail-closed error, got: ${JSON.stringify(noSecretResult)}`);
      }
    }

    // -------------------------------------------------------------
    // TEST 2: Missing Token Rejection
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { userId: 'unauthenticated-user' },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Missing access token')) {
          recordPass('Missing token handshake is rejected');
        } else {
          recordFail('Missing token handshake', `Unexpected error message: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Missing token handshake', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 3: Malformed Token Rejection
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'malformed.jwt.token.with.too.many.dots' },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Malformed token structure')) {
          recordPass('Malformed token structure is rejected');
        } else {
          recordFail('Malformed token', `Unexpected error message: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Malformed token', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 4: Asymmetric Expired Token Rejection
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const expiredToken = await createAsymmetricToken('user-alice-123', -60);
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Expired authentication token') || err.message.includes('expired')) {
          recordPass('Expired asymmetric token (ES256) is rejected');
        } else {
          recordFail('Expired asymmetric token', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Expired asymmetric token', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 5: Asymmetric Forged Signature Rejection
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const validToken = await createAsymmetricToken('user-alice-123', 3600);
      const parts = validToken.split('.');
      // Tamper signature
      const forgedSig = 'invalidSignatureStringHereForTestingES256FailedVerification12345';
      const forgedToken = `${parts[0]}.${parts[1]}.${forgedSig}`;

      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: forgedToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Invalid token signature') || err.message.includes('signature')) {
          recordPass('Forged asymmetric cryptographic signature is rejected');
        } else {
          recordFail('Forged asymmetric signature', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Forged asymmetric signature', 'Expected forged token to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 6: Untrusted Asymmetric Key Rejection (Not in JWKS)
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const untrustedToken = await createAsymmetricToken('user-attacker-123', 3600, {}, untrustedKeys.privateKey, 'untrusted-kid');
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: untrustedToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Invalid token signature') || err.message.includes('verification failed') || err.message.includes('JWKS')) {
          recordPass('Asymmetric token from untrusted key (not in JWKS) is rejected');
        } else {
          recordFail('Untrusted key rejection', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Untrusted key rejection', 'Expected untrusted key to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 7: Symmetric Expired Token Rejection (HS256)
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const expiredToken = createSymmetricToken('user-alice-123', -60);
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Expired authentication token')) {
          recordPass('Expired symmetric token (HS256) is rejected');
        } else {
          recordFail('Expired symmetric token', `Unexpected error message: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Expired symmetric token', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 8: Symmetric Invalid Signature Rejection (HS256)
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = { sub: 'user-forger-666', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' };
      const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const forgedSig = crypto.createHmac('sha256', 'wrong_key').update(`${hB64}.${pB64}`).digest('base64url');
      const forgedToken = `${hB64}.${pB64}.${forgedSig}`;

      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: forgedToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Invalid token signature')) {
          recordPass('Forged symmetric cryptographic signature is rejected');
        } else {
          recordFail('Forged symmetric signature', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Forged symmetric signature', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 9: Unsupported Signing Algorithm Rejection (alg: none)
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const noneHeader = { alg: 'none', typ: 'JWT' };
      const payload = { sub: 'user-attacker-none', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' };
      const hB64 = Buffer.from(JSON.stringify(noneHeader)).toString('base64url');
      const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const noneToken = `${hB64}.${pB64}.`;

      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: noneToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Algorithm "none" is not permitted') || err.message.includes('Unsupported signing algorithm')) {
          recordPass('Unsupported signing algorithm (alg: none) is rejected');
        } else {
          recordFail('Unsupported algorithm', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Unsupported algorithm', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 10: Identity Spoofing Rejection (Token sub != Client userId)
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const validAliceToken = await createAsymmetricToken('user-alice-123');
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: {
          token: validAliceToken,
          userId: 'user-bob-999' // Malicious spoof attempt
        },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Client userId mismatch with token identity')) {
          recordPass('Identity spoofing (client userId mismatch) is rejected');
        } else {
          recordFail('Identity spoofing', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Identity spoofing', 'Expected spoofed connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 11: Valid Asymmetric ES256 Token Connects Successfully
    // -------------------------------------------------------------
    let clientAlice;
    await new Promise(async (resolve) => {
      const aliceToken = await createAsymmetricToken('user-alice-123');
      clientAlice = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: aliceToken },
        transports: ['websocket'],
        reconnection: false
      });
      clientAlice.on('connect', () => {
        recordPass('Valid asymmetric token (ES256) connects successfully');
        resolve();
      });
      clientAlice.on('connect_error', (err) => {
        recordFail('Valid asymmetric token connection', err.message);
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 12: Valid Symmetric HS256 Token Connects Successfully
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const bobToken = createSymmetricToken('user-bob-symmetric-999');
      const clientBobSym = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: bobToken },
        transports: ['websocket'],
        reconnection: false
      });
      clientBobSym.on('connect', () => {
        recordPass('Valid symmetric token (HS256 fallback) connects successfully');
        clientBobSym.close();
        resolve();
      });
      clientBobSym.on('connect_error', (err) => {
        recordFail('Valid symmetric token connection', err.message);
        clientBobSym.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 13: Unauthorized Personal Room Join Protection
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      if (!clientAlice || !clientAlice.connected) {
        recordFail('Unauthorized room join', 'Client Alice not connected');
        return resolve();
      }
      clientAlice.once('error', (err) => {
        if (err.message.includes('Cannot join another user private room')) {
          recordPass('Attempt to join another user private room is blocked');
        } else {
          recordFail('Unauthorized room join', `Unexpected error message: ${err.message}`);
        }
        resolve();
      });
      clientAlice.emit('user:join', { userId: 'user-bob-999' });
    });

    // -------------------------------------------------------------
    // TEST 14: Ephemeral Typing Authoritative Identity Binding
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const bobToken = await createAsymmetricToken('user-bob-999');
      const clientBob = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: bobToken },
        transports: ['websocket'],
        reconnection: false
      });

      clientBob.on('connect', () => {
        const testConvId = 'conv-test-security-room-777';
        clientAlice.emit('conversation:join', { conversationId: testConvId });
        clientBob.emit('conversation:join', { conversationId: testConvId });

        clientBob.on('typing:status', (event) => {
          if (event.userId === 'user-alice-123' && event.isTyping === true) {
            recordPass('Typing event authoritatively binds sender to token identity (user-alice-123)');
          } else {
            recordFail('Typing event identity', `Expected user-alice-123, got: ${event.userId}`);
          }
          clientBob.close();
          resolve();
        });

        setTimeout(() => {
          clientAlice.emit('typing:start', { conversationId: testConvId, userId: 'spoofed-eve-id' });
        }, 50);
      });
    });

    // -------------------------------------------------------------
    // TEST 15: Notification Relay Authoritative Sender Identity Binding
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const bobToken = await createAsymmetricToken('user-bob-999');
      const clientBob = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: bobToken },
        transports: ['websocket'],
        reconnection: false
      });

      clientBob.on('connect', () => {
        clientBob.on('notification:received', (data) => {
          if (data.senderId === 'user-alice-123' && data.title === 'Security Alert') {
            recordPass('Notification relay authoritatively binds senderId to token identity (user-alice-123)');
          } else {
            recordFail('Notification relay identity', `Expected senderId user-alice-123, got: ${data.senderId}`);
          }
          clientBob.close();
          resolve();
        });

        setTimeout(() => {
          clientAlice.emit('notification:send', {
            recipientId: 'user-bob-999',
            senderId: 'forged-attacker-identity',
            title: 'Security Alert',
            message: 'Testing authoritative sender binding'
          });
        }, 50);
      });
    });

    // -------------------------------------------------------------
    // TEST 16: Presence Broadcast Authoritative User ID Binding
    // -------------------------------------------------------------
    await new Promise(async (resolve) => {
      const charlieToken = await createAsymmetricToken('user-charlie-777');
      const clientCharlie = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: charlieToken },
        transports: ['websocket'],
        reconnection: false
      });

      clientCharlie.on('connect', () => {
        clientCharlie.emit('presence:query', (response) => {
          if (response && Array.isArray(response.onlineUserIds) && response.onlineUserIds.includes('user-alice-123')) {
            recordPass('Presence query authoritatively reports verified token identities');
          } else {
            recordFail('Presence query', `Expected online list to include user-alice-123, got: ${JSON.stringify(response)}`);
          }
          clientCharlie.close();
          resolve();
        });
      });
    });

    if (clientAlice) clientAlice.close();

    // -------------------------------------------------------------
    // TEST 17: Live Supabase Staging Login Token Integration Test
    // -------------------------------------------------------------
    try {
      // Temporarily remove local JWKS override so the gateway connects to live Staging JWKS
      setCustomJwksOverride(null);
      const stagingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bqmylyedpjeutxhcvmrf.supabase.co';
      const stagingAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (stagingAnonKey) {
        const sb = createClient(stagingUrl, stagingAnonKey);
        const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
          email: 'operator.verifier@example.com',
          password: 'Password123!'
        });

        if (!authErr && authData?.session) {
          const liveToken = authData.session.access_token;
          const liveUserId = authData.user.id;

          await new Promise((resolve) => {
            const liveClient = Client(`http://localhost:${TEST_PORT}`, {
              auth: { token: liveToken, userId: liveUserId },
              transports: ['websocket'],
              reconnection: false
            });
            liveClient.on('connect', () => {
              recordPass('Live Staging Login token connects and verifies against live Supabase JWKS (ES256)');
              liveClient.close();
              resolve();
            });
            liveClient.on('connect_error', (err) => {
              recordFail('Live Staging Login token', err.message);
              liveClient.close();
              resolve();
            });
          });
        } else {
          console.log('[SKIP] Test 17: Live staging user credentials not active in this test run; skipped live staging handshake.');
        }
      }
    } catch (liveErr) {
      console.warn('[TEST 17 NOTE] Staging live check note:', liveErr.message);
    }

  } finally {
    setCustomJwksOverride(null);
    await new Promise((resolve) => server.close(resolve));
    console.log(`\n[TEARDOWN] Test gateway shut down cleanly.`);
  }

  console.log(`\n================================================================`);
  console.log(`FINAL SECURITY TEST RESULTS: ${passed} / ${total} PASSED`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
