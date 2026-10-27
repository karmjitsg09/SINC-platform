/**
 * SINC Platform — Fail-Closed Database Test Environment Guard
 *
 * Enforces strict isolation for database-writing integration tests.
 *
 * Rules:
 * 1. Requires explicit opt-in: ALLOW_DATABASE_MUTATING_TESTS === 'true'
 * 2. Never trusts a boolean flag alone as proof of isolation.
 * 3. Never trusts NODE_ENV=test alone.
 * 4. Requires an explicitly configured test target URL via SINC_TEST_SUPABASE_URL.
 * 5. Prohibits falling back to the application's root .env production/shared URL.
 * 6. Hostname must match an allowlist of confirmed local/isolated test environments:
 *    - 'localhost'
 *    - '127.0.0.1'
 *    - Explicitly approved test staging projects (e.g., matching APPROVED_TEST_SUPABASE_HOSTNAMES)
 * 7. Specifically rejects the known remote project (vctwzlsatqsuinmosnzo.supabase.co).
 */

const fs = require('fs');
const path = require('path');

const DISALLOWED_PRODUCTION_HOSTS = new Set([
  'vctwzlsatqsuinmosnzo.supabase.co'
]);

const ALLOWED_LOCAL_TEST_HOSTS = new Set([
  'localhost',
  '127.0.0.1'
]);

function parseUrl(urlStr) {
  try {
    return new URL(urlStr);
  } catch {
    return null;
  }
}

function getAppRootEnvUrl() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return null;

  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
          return val;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Asserts that the current process environment is safely configured for isolated database testing.
 * Throws a fatal Error if any condition is not met.
 *
 * @returns {{ testUrl: string, hostname: string, isLocal: boolean }}
 */
function assertIsolatedTestEnvironment() {
  const optIn = process.env.ALLOW_DATABASE_MUTATING_TESTS;
  if (optIn !== 'true') {
    throw new Error(
      '[SAFETY_INTERLOCK_BLOCKED]: Database-writing integration tests require explicit opt-in.\n' +
      'To run in an approved isolated environment, set:\n' +
      '  ALLOW_DATABASE_MUTATING_TESTS=true\n' +
      '  SINC_TEST_SUPABASE_URL=http://127.0.0.1:54321 (or approved test project URL)'
    );
  }

  // A boolean flag alone is never sufficient proof
  const testUrlRaw = process.env.SINC_TEST_SUPABASE_URL || process.env.TEST_SUPABASE_URL;
  if (!testUrlRaw || typeof testUrlRaw !== 'string' || testUrlRaw.trim() === '') {
    throw new Error(
      '[SAFETY_INTERLOCK_BLOCKED]: Missing SINC_TEST_SUPABASE_URL.\n' +
      'Database-writing tests must NOT use the default application database.\n' +
      'Provide a dedicated local or staging Supabase instance via SINC_TEST_SUPABASE_URL.'
    );
  }

  const parsedTestUrl = parseUrl(testUrlRaw.trim());
  if (!parsedTestUrl) {
    throw new Error(`[SAFETY_INTERLOCK_BLOCKED]: SINC_TEST_SUPABASE_URL is not a valid URL: "${testUrlRaw}"`);
  }

  const hostname = parsedTestUrl.hostname.toLowerCase();

  // Check against known production/shared hosts
  if (DISALLOWED_PRODUCTION_HOSTS.has(hostname)) {
    throw new Error(
      `[SAFETY_INTERLOCK_BLOCKED]: Target database "${hostname}" is identified as the primary/production project.\n` +
      'Database-writing tests against this host are strictly forbidden to protect production data integrity.'
    );
  }

  // Check against root .env URL (prevent silent leakage into application's configured database)
  const appRootUrl = getAppRootEnvUrl();
  if (appRootUrl) {
    const parsedAppUrl = parseUrl(appRootUrl);
    if (parsedAppUrl && parsedAppUrl.hostname.toLowerCase() === hostname && !ALLOWED_LOCAL_TEST_HOSTS.has(hostname)) {
      throw new Error(
        `[SAFETY_INTERLOCK_BLOCKED]: SINC_TEST_SUPABASE_URL matches the application's root .env database ("${hostname}").\n` +
        'Database-writing tests must use an independent, isolated test project.'
      );
    }
  }

  // Allow local Docker Supabase (http://127.0.0.1:54321 or http://localhost:54321)
  const isLocal = ALLOWED_LOCAL_TEST_HOSTS.has(hostname);

  // If remote, verify it matches an explicitly approved test staging allowlist
  let isApprovedRemote = false;
  const approvedRemotes = (process.env.APPROVED_TEST_SUPABASE_HOSTNAMES || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);

  if (approvedRemotes.includes(hostname)) {
    isApprovedRemote = true;
  }

  if (!isLocal && !isApprovedRemote) {
    throw new Error(
      `[SAFETY_INTERLOCK_BLOCKED]: Hostname "${hostname}" is not in the approved test allowlist.\n` +
      'Approved targets: localhost, 127.0.0.1, or hosts listed in APPROVED_TEST_SUPABASE_HOSTNAMES.\n' +
      'Execution aborted to prevent accidental writes.'
    );
  }

  return {
    testUrl: testUrlRaw.trim(),
    hostname,
    isLocal
  };
}

const PRODUCTION_PROJECT_REF = 'vctwzlsatqsuinmosnzo';

/**
 * Validates that a staging database URL does NOT point to the production database.
 * Throws a fatal Error if vctwzlsatqsuinmosnzo is detected.
 */
function assertStagingDatabaseUrl(dbUrlRaw) {
  if (!dbUrlRaw || typeof dbUrlRaw !== 'string' || dbUrlRaw.trim() === '') {
    throw new Error('[FATAL_GUARD_BLOCK]: STAGING_DATABASE_URL is missing or empty.');
  }

  const cleanUrl = dbUrlRaw.replace(/^["']|["']$/g, '').trim();

  // Fail-closed check: Never allow production project ref in any part of the URL
  if (cleanUrl.toLowerCase().includes(PRODUCTION_PROJECT_REF.toLowerCase())) {
    throw new Error(
      `[FATAL_GUARD_BLOCK]: Target connection URL contains production project ref "${PRODUCTION_PROJECT_REF}".\n` +
      'Writes to production via STAGING_DATABASE_URL are strictly prohibited!'
    );
  }

  try {
    const parsed = new URL(cleanUrl);
    for (const disallowed of DISALLOWED_PRODUCTION_HOSTS) {
      if (parsed.hostname.toLowerCase().includes(disallowed.toLowerCase())) {
        throw new Error(`[FATAL_GUARD_BLOCK]: Target connection points to production host "${disallowed}".`);
      }
    }

    return {
      cleanUrl,
      host: parsed.host,
      isProduction: false
    };
  } catch (err) {
    if (err.message.includes('[FATAL_GUARD_BLOCK]')) throw err;
    throw new Error(`[FATAL_GUARD_BLOCK]: STAGING_DATABASE_URL is not a valid connection URL: ${err.message}`);
  }
}

module.exports = {
  assertIsolatedTestEnvironment,
  assertStagingDatabaseUrl,
  PRODUCTION_PROJECT_REF,
  DISALLOWED_PRODUCTION_HOSTS,
  ALLOWED_LOCAL_TEST_HOSTS
};

