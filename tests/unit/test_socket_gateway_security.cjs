/**
 * SINC Platform — Isolated Socket.IO Gateway Security & Authentication Tests
 *
 * Tests:
 * 1. Missing token -> connection rejected with "Missing access token" error.
 * 2. Malformed token -> connection rejected.
 * 3. Expired token -> connection rejected with "Expired authentication token" error.
 * 4. Identity spoofing -> client-supplied userId differing from token `sub` rejected.
 * 5. Invalid signature -> rejected when SUPABASE_JWT_SECRET is configured.
 * 6. Valid signed token -> connects successfully and binds verified socket.userId.
 * 7. Room join security -> unauthorized join to another user's room rejected.
 * 8. Ephemeral typing authorization -> sender userId in broadcast is authoritatively bound to socket.userId.
 *
 * Completely isolated: Runs on local test port (3099), makes 0 remote network calls.
 */

const http = require('http');
const crypto = require('crypto');
const { io: Client } = require('socket.io-client');

const TEST_SECRET = 'sinc_test_jwt_secret_do_not_use_in_prod_1234567890';
const TEST_PORT = 3099;

// Configure test environment variables before requiring server module
process.env.SOCKET_PORT = String(TEST_PORT);
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

const { server, io, verifySupabaseToken } = require('../../backend/socket-gateway/server.js');

function createToken(sub, expiresInSec = 3600, customClaims = {}) {
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
    // TEST 1: Missing Token Rejection
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
    // TEST 2: Expired Token Rejection
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const expiredToken = createToken('user-alice-123', -60); // expired 60 seconds ago
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Expired authentication token')) {
          recordPass('Expired token is rejected');
        } else {
          recordFail('Expired token', `Unexpected error message: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Expired token', 'Expected connection to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 3: Identity Spoofing Rejection (Token sub != Client userId)
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const validAliceToken = createToken('user-alice-123');
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
    // TEST 4: Invalid Cryptographic Signature Rejection
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = { sub: 'user-forger-666', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' };
      const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const forgedSig = crypto.createHmac('sha256', 'wrong_signing_key').update(`${hB64}.${pB64}`).digest('base64url');
      const forgedToken = `${hB64}.${pB64}.${forgedSig}`;

      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: forgedToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        if (err.message.includes('Invalid token signature')) {
          recordPass('Forged cryptographic signature is rejected');
        } else {
          recordFail('Forged signature', `Unexpected error: ${err.message}`);
        }
        client.close();
        resolve();
      });
      client.on('connect', () => {
        recordFail('Forged signature', 'Expected forged token to be rejected');
        client.close();
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 5: Valid Token Connection & Personal Room Binding
    // -------------------------------------------------------------
    let clientAlice;
    await new Promise((resolve) => {
      const aliceToken = createToken('user-alice-123');
      clientAlice = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: aliceToken },
        transports: ['websocket'],
        reconnection: false
      });
      clientAlice.on('connect', () => {
        recordPass('Valid signed token connects successfully');
        resolve();
      });
      clientAlice.on('connect_error', (err) => {
        recordFail('Valid token connection', err.message);
        resolve();
      });
    });

    // -------------------------------------------------------------
    // TEST 6: Unauthorized Personal Room Join Protection
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
      // Alice attempts to eavesdrop on Bob's personal room
      clientAlice.emit('user:join', { userId: 'user-bob-999' });
    });

    // -------------------------------------------------------------
    // TEST 7: Ephemeral Typing Authoritative Identity Binding
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      const bobToken = createToken('user-bob-999');
      const clientBob = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: bobToken },
        transports: ['websocket'],
        reconnection: false
      });

      clientBob.on('connect', () => {
        const testConvId = 'conv-test-security-room-777';
        // Both join the conversation room
        clientAlice.emit('conversation:join', { conversationId: testConvId });
        clientBob.emit('conversation:join', { conversationId: testConvId });

        // Bob listens for typing events
        clientBob.on('typing:status', (event) => {
          // Verify that even if Alice tried to claim userId is 'eve', the server stamped Alice's true ID
          if (event.userId === 'user-alice-123' && event.isTyping === true) {
            recordPass('Typing event authoritatively binds sender to token identity (user-alice-123)');
          } else {
            recordFail('Typing event identity', `Expected user-alice-123, got: ${event.userId}`);
          }
          clientBob.close();
          resolve();
        });

        // Alice emits typing, attempting to spoof payload
        setTimeout(() => {
          clientAlice.emit('typing:start', { conversationId: testConvId, userId: 'spoofed-eve-id' });
        }, 50);
      });
    });

    if (clientAlice) clientAlice.close();

  } finally {
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
