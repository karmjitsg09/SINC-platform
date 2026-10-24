const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testLifecycleAndEdgeCases() {
  console.log('--- TEST H & J: Lifecycle Stability & Edge Cases ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Test 1: Failed password login does NOT trigger welcome story
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('#email');
  await page.fill('#email', 'nonexistent.user@example.com');
  await page.fill('#password', 'WrongPassword123!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(1500);

  const failedLoginCheck = await page.evaluate(() => {
    const hasCanvas = Boolean(document.querySelector('div[role="dialog"] canvas'));
    const hasWelcomeStage = Boolean(document.querySelector('.sinc-welcome-story-stage'));
    const hasError = Boolean(document.querySelector('.auth-general-error'));
    return { hasCanvas, hasWelcomeStage, hasError };
  });

  const passFailedLogin = !failedLoginCheck.hasCanvas && !failedLoginCheck.hasWelcomeStage && failedLoginCheck.hasError;
  console.log(`[${passFailedLogin ? 'PASS' : 'FAIL'}] Failed Login Rejection: Canvas not triggered, error banner rendered: ${passFailedLogin}`);

  // Test 2: Invalid/corrupt session in localStorage recovery (Test H)
  await page.evaluate(() => {
    localStorage.setItem('sb-vctwzlsatqsuinmosnzo-auth-token', JSON.stringify({ access_token: 'corrupt-invalid-token', user: null }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 6000 });

  const invalidTokenCheck = await page.evaluate(() => {
    const isLogin = Boolean(document.getElementById('email') && document.getElementById('auth-switch-to-signup-btn'));
    const hasDashboard = Boolean(document.querySelector('.sinc-app-shell'));
    const hasInfiniteLoader = Boolean(document.querySelector('.sinc-session-restoring'));
    return { isLogin, hasDashboard, hasInfiniteLoader };
  });

  const passInvalidToken = invalidTokenCheck.isLogin && !invalidTokenCheck.hasDashboard && !invalidTokenCheck.hasInfiniteLoader;
  console.log(`[${passInvalidToken ? 'PASS' : 'FAIL'}] Corrupt Token Recovery: Safely falls back to unauthenticated login without hanging: ${passInvalidToken}`);

  // Test 3: Browser Back / Forward sync
  await page.click('#auth-switch-to-signup-btn');
  await page.waitForSelector('#confirmPassword');
  await page.goBack();
  await page.waitForSelector('#auth-switch-to-signup-btn');
  const isBackToLogin = await page.evaluate(() => !document.getElementById('confirmPassword'));
  await page.goForward();
  await page.waitForSelector('#confirmPassword');
  const isForwardToSignUp = await page.evaluate(() => Boolean(document.getElementById('confirmPassword')));

  const passHistory = isBackToLogin && isForwardToSignUp;
  console.log(`[${passHistory ? 'PASS' : 'FAIL'}] History Popstate Sync: Back/Forward navigation smoothly tracks auth routes: ${passHistory}`);

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, 'lifecycle_edge_case_results.json'),
    JSON.stringify({ passFailedLogin, passInvalidToken, passHistory }, null, 2)
  );
}

testLifecycleAndEdgeCases().catch(err => {
  console.error(err);
  process.exit(1);
});
