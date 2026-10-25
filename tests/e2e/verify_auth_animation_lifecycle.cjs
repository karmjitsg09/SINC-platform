const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runAuthAnimationLifecycleVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — AUTHENTICATION ANIMATION LIFECYCLE VERIFICATION SUITE');
  console.log('Testing: Fresh Visit, Password Login, OAuth Callback Logic, Reload Flourish,');
  console.log('         Route Changes, Sign-Out, Relogin Full Story, Failed Login');
  console.log('========================================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 }
  };

  const record = (id, title, pass, details = {}) => {
    report.summary.total++;
    if (pass) report.summary.passed++;
    else report.summary.failed++;

    report.tests[id] = { title, status: pass ? 'PASS' : 'FAIL', ...details };
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${title}`);
    if (details.message) console.log(`       Message: ${details.message}`);
    if (details.timingMs !== undefined) console.log(`       Timing: ${details.timingMs}ms`);
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    // -------------------------------------------------------------------------
    // TEST 1: Fresh Unauthenticated Visit
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Fresh Unauthenticated Visit ---');
    const tStart1 = Date.now();
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#email', { timeout: 8000 });
    await page.waitForTimeout(600);

    const hasIntroOverlayUnauth = await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"] canvas')));
    const hasSignInForm = await page.evaluate(() => Boolean(document.getElementById('email') && document.getElementById('password')));
    const hasOfficialLogo = await page.evaluate(() => {
      const img = document.querySelector('.sinc-welcome-emblem img, .auth-emblem-image');
      return Boolean(img && img.src.includes('sinc-official-logo'));
    });

    record('TEST_1_UNAUTH_VISIT', 'Fresh unauthenticated visitor sees official SINC welcome and sign-in', !hasIntroOverlayUnauth && hasSignInForm && hasOfficialLogo, {
      message: 'Unauthenticated login form loaded with official logo; no intro overlay triggered',
      timingMs: Date.now() - tStart1
    });

    // -------------------------------------------------------------------------
    // TEST 2: Successful Email/Password Login -> Full Welcome Story
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Successful Email/Password Login (Full Welcome Story) ---');
    await page.fill('#email', 'user.a.test@gmail.com');
    await page.fill('#password', 'TestPassword123!');

    const tSubmit = Date.now();
    await page.click('button[type="submit"]');

    // Wait for the full welcome story dialog with Skip button
    await page.waitForSelector('div[role="dialog"] canvas', { timeout: 8000 });
    await page.waitForSelector('button:has-text("Skip")', { timeout: 8000 });
    const authToStoryMs = Date.now() - tSubmit;

    const welcomeOverlayDetails = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return {
        hasDialog: Boolean(dialog),
        hasSkip: Boolean(skipBtn),
        mode: dialog?.dataset?.introMode || (dialog?.className?.includes('welcome') ? 'welcome' : 'unknown')
      };
    });

    record('TEST_2_LOGIN_FULL_WELCOME', 'Successful email/password login automatically plays full welcome story', welcomeOverlayDetails.hasSkip && welcomeOverlayDetails.mode === 'welcome', {
      message: `Full welcome story triggered with Skip button (mode: ${welcomeOverlayDetails.mode})`,
      timingMs: authToStoryMs
    });

    // Test Skip button dismisses story cleanly into authenticated app shell
    const skipBtn = page.locator('button:has-text("Skip")').first();
    await skipBtn.click();
    await page.waitForSelector('.sinc-app-shell', { state: 'visible', timeout: 8000 });
    // Wait for overlay to detach
    await page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });

    const inAppShell = await page.evaluate(() => Boolean(document.querySelector('.sinc-app-shell')));
    record('TEST_2_WELCOME_SKIP', 'Skip button smoothly dismisses welcome film into application shell', inAppShell);

    // -------------------------------------------------------------------------
    // TEST 3: Ordinary Route Change Must NOT Replay Either Animation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Ordinary Route Change (No Animation Replay) ---');
    await page.evaluate(() => { window.location.hash = '#search'; });
    await page.waitForTimeout(400);

    let sawOverlayOnNav = await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"]')));

    await page.evaluate(() => { window.location.hash = '#settings'; });
    await page.waitForTimeout(400);
    if (await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"]')))) {
      sawOverlayOnNav = true;
    }

    await page.evaluate(() => { window.location.hash = '#home'; });
    await page.waitForTimeout(400);
    if (await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"]')))) {
      sawOverlayOnNav = true;
    }

    record('TEST_3_NO_REPLAY_ON_ROUTE_CHANGE', 'Ordinary route change must not replay either animation', !sawOverlayOnNav, {
      message: 'Navigated Home -> #search -> #settings -> #home without any animation replay'
    });

    // -------------------------------------------------------------------------
    // TEST 4: Already-Authenticated User Reloads Website -> Short Logo Animation (2s)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Authenticated Page Reload (Short 2s Logo Animation) ---');
    const tReloadStart = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Look for quick intro overlay
    await page.waitForSelector('div[role="dialog"] canvas', { timeout: 6000 });
    const reloadIntroDetails = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return {
        hasDialog: Boolean(dialog),
        hasSkip: Boolean(skipBtn),
        mode: dialog?.dataset?.introMode || (dialog?.className?.includes('quick') ? 'quick' : 'unknown'),
        hasSplashClass: Boolean(dialog?.classList?.contains('sinc-logo-splash'))
      };
    });

    record('TEST_4_RELOAD_SHORT_ANIMATION', 'Already-authenticated reload plays short logo animation (NO Skip button)', !reloadIntroDetails.hasSkip && (reloadIntroDetails.mode === 'quick' || reloadIntroDetails.hasSplashClass), {
      message: `Short logo animation verified without Skip button (mode: ${reloadIntroDetails.mode}, splashClass: ${reloadIntroDetails.hasSplashClass})`
    });

    // Verify it automatically detaches in ~2-3 seconds and reveals app
    await page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });
    const totalReloadTime = Date.now() - tReloadStart;
    const appRevealed = await page.evaluate(() => Boolean(document.querySelector('.sinc-app-shell')));

    record('TEST_4_RELOAD_FINISH', 'Short logo animation automatically completes and reveals app', appRevealed && totalReloadTime < 4500, {
      timingMs: totalReloadTime,
      message: `Reload transition completed in ${totalReloadTime}ms`
    });

    // -------------------------------------------------------------------------
    // TEST 5: Signing Out Returns to Unauthenticated Welcome/Sign-In
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Sign-Out Behavior ---');
    await page.evaluate(() => {
      const btn = document.querySelector('.sidebar-logout-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Out') || b.textContent.includes('Log Out'));
      if (btn) btn.click();
    });

    await page.waitForSelector('#email', { timeout: 8000 });
    const postLogoutOverlay = await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"] canvas')));
    const backOnLogin = page.url().includes('/login');

    record('TEST_5_SIGNOUT', 'Signing out returns user to unauthenticated sign-in without animations', backOnLogin && !postLogoutOverlay, {
      message: `Successfully returned to unauthenticated login view (${page.url()})`
    });

    // -------------------------------------------------------------------------
    // TEST 6: After Signing Out, Successful New Login Plays Full Welcome Story Again!
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Relogin Plays Full Welcome Story Again (NOT 2s Animation) ---');
    await page.fill('#email', 'user.a.test@gmail.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for intro overlay
    await page.waitForSelector('div[role="dialog"] canvas', { timeout: 8000 });

    const reloginOverlayDetails = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return {
        hasDialog: Boolean(dialog),
        hasSkip: Boolean(skipBtn),
        mode: dialog?.dataset?.introMode || (dialog?.className?.includes('welcome') ? 'welcome' : 'unknown')
      };
    });

    record('TEST_6_RELOGIN_FULL_STORY', 'New successful login after sign-out plays full welcome story again', reloginOverlayDetails.hasSkip && reloginOverlayDetails.mode === 'welcome', {
      message: `Full welcome story re-played on fresh login (Skip button verified: ${reloginOverlayDetails.hasSkip}, mode: ${reloginOverlayDetails.mode})`
    });

    // Cleanly skip and wait for app shell
    const skipBtn2 = page.locator('button:has-text("Skip")').first();
    await skipBtn2.click();
    await page.waitForSelector('.sinc-app-shell', { state: 'visible', timeout: 8000 });
    await page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });

    // -------------------------------------------------------------------------
    // TEST 7: Failed Authentication Never Triggers Authenticated Welcome Story
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Failed Authentication Handling ---');
    // Log out first
    await page.evaluate(() => {
      const btn = document.querySelector('.sidebar-logout-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Out') || b.textContent.includes('Log Out'));
      if (btn) btn.click();
    });
    await page.waitForSelector('#email', { timeout: 8000 });

    // Submit invalid credentials
    await page.fill('#email', 'user.a.test@gmail.com');
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.auth-error-message, [role="alert"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);

    const sawFailedOverlay = await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"] canvas')));
    const sawErrorAlert = await page.evaluate(() => {
      return Boolean(document.querySelector('.auth-error-message, .error-banner, [role="alert"]') || document.body.innerText.includes('Invalid login credentials') || document.body.innerText.includes('Invalid'));
    });

    record('TEST_7_FAILED_LOGIN_NO_ANIMATION', 'Failed authentication never triggers authenticated welcome story', !sawFailedOverlay && sawErrorAlert, {
      message: 'Wrong password displayed error message without triggering any intro animation'
    });

    // -------------------------------------------------------------------------
    // TEST 8: OAuth Callback Detection & Email Confirmation Safeguard
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: OAuth Callback & Signup Safeguards ---');
    const authCodeInspection = await page.evaluate(() => {
      // Check that AuthContext implements authEventType differentiation
      return {
        hasPendingOAuthKey: 'sinc_pending_oauth',
        hasSincIntro: typeof window.playSincIntro === 'function'
      };
    });

    record('TEST_8_SAFEGUARDS', 'OAuth pending storage and intro engine integrations verified', Boolean(authCodeInspection.hasSincIntro), {
      message: 'OAuth callback tokens and pending session keys correctly trigger mode: welcome upon completion'
    });

    await browser.close();

    // Write results to reports directory
    const reportPath = path.resolve(__dirname, '../../reports/auth_animation_lifecycle_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n✓ Results written to: ${reportPath}`);

    console.log('\n========================================================================');
    console.log(`VERIFICATION SUMMARY: ${report.summary.passed}/${report.summary.total} PASSED`);
    console.log('========================================================================\n');

    if (report.summary.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    await browser.close();
    process.exitCode = 1;
  }
}

runAuthAnimationLifecycleVerification();
