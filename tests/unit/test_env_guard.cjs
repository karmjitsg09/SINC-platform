const { assertIsolatedTestEnvironment } = require('../integration/testEnvironmentGuard.cjs');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

console.log('Testing testEnvironmentGuard fail-closed logic...\n');

// Save original env
const origOptIn = process.env.ALLOW_DATABASE_MUTATING_TESTS;
const origUrl = process.env.SINC_TEST_SUPABASE_URL;
const origApproved = process.env.APPROVED_TEST_SUPABASE_HOSTNAMES;

try {
  // Test 1: No env vars -> must fail
  runTest('Rejects when ALLOW_DATABASE_MUTATING_TESTS is absent', () => {
    delete process.env.ALLOW_DATABASE_MUTATING_TESTS;
    delete process.env.SINC_TEST_SUPABASE_URL;
    let thrown = false;
    try {
      assertIsolatedTestEnvironment();
    } catch (e) {
      if (e.message.includes('explicit opt-in')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for missing opt-in');
  });

  // Test 2: Opt-in present, but URL missing -> must fail
  runTest('Rejects when SINC_TEST_SUPABASE_URL is missing', () => {
    process.env.ALLOW_DATABASE_MUTATING_TESTS = 'true';
    delete process.env.SINC_TEST_SUPABASE_URL;
    let thrown = false;
    try {
      assertIsolatedTestEnvironment();
    } catch (e) {
      if (e.message.includes('Missing SINC_TEST_SUPABASE_URL')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for missing URL');
  });

  // Test 3: URL points to known production host -> must fail
  runTest('Rejects when URL points to production host (vctwzlsatqsuinmosnzo.supabase.co)', () => {
    process.env.ALLOW_DATABASE_MUTATING_TESTS = 'true';
    process.env.SINC_TEST_SUPABASE_URL = 'https://vctwzlsatqsuinmosnzo.supabase.co';
    let thrown = false;
    try {
      assertIsolatedTestEnvironment();
    } catch (e) {
      if (e.message.includes('identified as the primary/production project')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for production URL');
  });

  // Test 4: URL points to an unapproved arbitrary external host -> must fail
  runTest('Rejects when URL points to unapproved external host', () => {
    process.env.ALLOW_DATABASE_MUTATING_TESTS = 'true';
    process.env.SINC_TEST_SUPABASE_URL = 'https://random-unapproved-project.supabase.co';
    delete process.env.APPROVED_TEST_SUPABASE_HOSTNAMES;
    let thrown = false;
    try {
      assertIsolatedTestEnvironment();
    } catch (e) {
      if (e.message.includes('not in the approved test allowlist')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for unapproved host');
  });

  // Test 5: Localhost Docker Supabase -> must pass
  runTest('Accepts local isolated Supabase instance (http://127.0.0.1:54321)', () => {
    process.env.ALLOW_DATABASE_MUTATING_TESTS = 'true';
    process.env.SINC_TEST_SUPABASE_URL = 'http://127.0.0.1:54321';
    const result = assertIsolatedTestEnvironment();
    if (!result.isLocal || result.hostname !== '127.0.0.1') {
      throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
    }
  });

  // Test 6: Explicitly approved staging host in allowlist -> must pass
  runTest('Accepts explicitly allowlisted test staging host', () => {
    process.env.ALLOW_DATABASE_MUTATING_TESTS = 'true';
    process.env.SINC_TEST_SUPABASE_URL = 'https://isolated-test-stage.supabase.co';
    process.env.APPROVED_TEST_SUPABASE_HOSTNAMES = 'isolated-test-stage.supabase.co';
    const result = assertIsolatedTestEnvironment();
    if (result.hostname !== 'isolated-test-stage.supabase.co') {
      throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
    }
  });

  // Staging Database URL Guard Tests
  const { assertStagingDatabaseUrl } = require('../integration/testEnvironmentGuard.cjs');

  runTest('assertStagingDatabaseUrl: Rejects when STAGING_DATABASE_URL is missing', () => {
    let thrown = false;
    try {
      assertStagingDatabaseUrl('');
    } catch (e) {
      if (e.message.includes('missing or empty')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for missing staging URL');
  });

  runTest('assertStagingDatabaseUrl: Rejects when URL contains production project ref (vctwzlsatqsuinmosnzo)', () => {
    let thrown = false;
    try {
      assertStagingDatabaseUrl('postgresql://postgres.vctwzlsatqsuinmosnzo:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres');
    } catch (e) {
      if (e.message.includes('production project ref')) thrown = true;
    }
    if (!thrown) throw new Error('Expected guard to throw for production project ref');
  });

  runTest('assertStagingDatabaseUrl: Accepts valid independent staging database URL', () => {
    const res = assertStagingDatabaseUrl('postgresql://postgres.bqmylyedpjeutxhcvmrf:sinc-staging1@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres');
    if (res.isProduction || !res.host.includes('aws-0-ap-southeast-2.pooler.supabase.com')) {
      throw new Error(`Unexpected result: ${JSON.stringify(res)}`);
    }
  });

} finally {
  // Restore original env
  if (origOptIn) process.env.ALLOW_DATABASE_MUTATING_TESTS = origOptIn;
  else delete process.env.ALLOW_DATABASE_MUTATING_TESTS;

  if (origUrl) process.env.SINC_TEST_SUPABASE_URL = origUrl;
  else delete process.env.SINC_TEST_SUPABASE_URL;

  if (origApproved) process.env.APPROVED_TEST_SUPABASE_HOSTNAMES = origApproved;
  else delete process.env.APPROVED_TEST_SUPABASE_HOSTNAMES;
}

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) process.exit(1);

