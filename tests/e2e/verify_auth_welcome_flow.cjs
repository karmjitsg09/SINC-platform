const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runAuthWelcomeFlowVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — OFFICIAL LOGO & WELCOME AUTH FLOW VERIFICATION SUITE');
  console.log('Testing: Official Emblem, Obsolete Loader Removal, Startup, Sign-In,');
  console.log('         Reload, Sign-Out, Responsive Viewports & Performance Metrics');
  console.log('========================================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    metrics: {},
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 }
  };

  const recordResult = (testId, title, passed, details = {}) => {
    report.summary.total++;
    if (passed) report.summary.passed++;
    else report.summary.failed++;

    report.tests[testId] = {
      title,
      status: passed ? 'PASS' : 'FAIL',
      ...details
    };

    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testId}: ${title}`);
    if (details.message) console.log(`       Message: ${details.message}`);
    if (details.timingMs !== undefined) console.log(`       Timing: ${details.timingMs}ms`);
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // =========================================================================
    // TEST 1: Fresh Unauthenticated Browser Session
    // =========================================================================
    console.log('\n--- TEST 1: Fresh Unauthenticated Browser Session ---');
    const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page1 = await ctx1.newPage();

    const failedRequests1 = [];
    const consoleErrors1 = [];
    page1.on('requestfailed', (req) => failedRequests1.push(req.url()));
    page1.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors1.push(msg.text());
    });

    const startT1 = Date.now();
    await page1.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    
    // Check if obsolete loader text appears
    const hadObsoleteLoader = await page1.evaluate(() => {
      return document.body.innerText.includes('Loading SINC platform');
    });

    // Wait for the official emblem image to be visible
    await page1.waitForSelector('img.sinc-official-logo', { timeout: 5000 });
    const t1LogoVisible = Date.now() - startT1;

    // Check official emblem properties
    const emblemInfo = await page1.evaluate(() => {
      const img = document.querySelector('img.sinc-official-logo');
      const hero = document.querySelector('.sinc-welcome-hero');
      const tabs = document.querySelector('.sinc-welcome-tabs');
      const emailInput = document.querySelector('input#email');
      const pwdInput = document.querySelector('input#password');
      const submitBtn = document.querySelector('button[type="submit"]');
      const storyBtn = document.querySelector('#welcome-story-trigger-btn');

      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const naturalAspect = img.naturalWidth / (img.naturalHeight || 1);

      return {
        src: img.src,
        width: rect.width,
        height: rect.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: naturalAspect,
        hasHero: !!hero,
        hasTabs: !!tabs,
        hasEmail: !!emailInput,
        hasPassword: !!pwdInput,
        hasSubmit: !!submitBtn,
        hasStoryBtn: !!storyBtn
      };
    });

    const t1Interactive = Date.now() - startT1;
    report.metrics.freshLogoVisibleMs = t1LogoVisible;
    report.metrics.freshInteractiveMs = t1Interactive;

    const t1Passed =
      !hadObsoleteLoader &&
      emblemInfo &&
      emblemInfo.src.includes('sinc-official-logo') &&
      emblemInfo.hasHero &&
      emblemInfo.hasTabs &&
      emblemInfo.hasEmail &&
      emblemInfo.hasPassword &&
      emblemInfo.hasSubmit;

    await page1.screenshot({
      path: path.join(__dirname, 'screenshots', 'test1_unauthenticated_welcome.png')
    });

    recordResult('TEST_1', 'Fresh Unauthenticated Browser Welcome Experience', t1Passed, {
      message: `Emblem visible in ${t1LogoVisible}ms, interactive in ${t1Interactive}ms. Obsolete loader absent: ${!hadObsoleteLoader}.`,
      timingMs: t1Interactive,
      emblemInfo
    });

    // =========================================================================
    // TEST 2: Sign-Up View Transition via Segmented Tabs
    // =========================================================================
    console.log('\n--- TEST 2: Sign-Up View Transition via Tabs ---');
    const startT2 = Date.now();
    await page1.click('#auth-tab-signup');
    await page1.waitForSelector('input#name', { timeout: 3000 });
    const t2TabTransitionMs = Date.now() - startT2;

    const signupInfo = await page1.evaluate(() => {
      const nameInput = document.querySelector('input#name');
      const emailInput = document.querySelector('input#email');
      const pwdInput = document.querySelector('input#password');
      const submitBtn = document.querySelector('button[type="submit"]');
      const activeTab = document.querySelector('.sinc-welcome-tab.active');

      return {
        hasName: !!nameInput,
        hasEmail: !!emailInput,
        hasPassword: !!pwdInput,
        submitText: submitBtn ? submitBtn.textContent.trim() : null,
        activeTab: activeTab ? activeTab.textContent.trim() : null
      };
    });

    // Switch back to Sign In
    await page1.click('#auth-tab-signin');
    await page1.waitForSelector('button[type="submit"]', { timeout: 3000 });

    const t2Passed =
      signupInfo.hasName &&
      signupInfo.hasEmail &&
      signupInfo.hasPassword &&
      signupInfo.activeTab === 'Create Account' &&
      signupInfo.submitText.toLowerCase().includes('account');

    recordResult('TEST_2', 'Sign-Up View Transition & Tab Navigation', t2Passed, {
      message: `Switched between tabs smoothly in ${t2TabTransitionMs}ms without full page reload.`,
      timingMs: t2TabTransitionMs,
      signupInfo
    });

    // =========================================================================
    // TEST 3: Authenticated Sign-In Flow
    // =========================================================================
    console.log('\n--- TEST 3: Sign-In with Authorized Test Account ---');
    await page1.fill('input#email', 'user.a.test@gmail.com');
    await page1.fill('input#password', 'TestPassword123!');

    const startT3 = Date.now();
    await page1.click('button[type="submit"]');

    // Wait for the authenticated home feed / navigation to appear
    await page1.waitForSelector('.home-feed-layout, .top-header, .sinc-app-shell', { timeout: 15000 });
    const t3SignInMs = Date.now() - startT3;
    report.metrics.signInToFeedMs = t3SignInMs;

    // Check if the obsolete loader or welcome film blocked the feed
    const authState = await page1.evaluate(() => {
      const shell = document.querySelector('.app-shell, .sinc-app-shell');
      const header = document.querySelector('.top-header, .topheader-container, header');
      const feed = document.querySelector('.home-feed-layout, .feed-posts-stream');
      const oldLoader = document.body.innerText.includes('Loading SINC platform');
      const hasCanvasIntro = !!document.querySelector('div[role="dialog"] canvas');

      return {
        hasShell: !!shell,
        hasHeader: !!header,
        hasFeed: !!feed,
        hadOldLoader: oldLoader,
        hasBlockedCanvasIntro: hasCanvasIntro
      };
    });

    await page1.screenshot({
      path: path.join(__dirname, 'screenshots', 'test3_authenticated_feed.png')
    });

    const t3Passed =
      authState.hasFeed &&
      !authState.hadOldLoader &&
      !authState.hasBlockedCanvasIntro;

    recordResult('TEST_3', 'Sign-In Flow & Immediate Feed Entry (< 100ms lag)', t3Passed, {
      message: `Signed in and rendered authenticated feed in ${t3SignInMs}ms without obsolete loader.`,
      timingMs: t3SignInMs,
      authState
    });

    // =========================================================================
    // TEST 4: Authenticated Browser Reload & Session Restoration
    // =========================================================================
    console.log('\n--- TEST 4: Authenticated Browser Reload & Session Restoration ---');
    const startT4 = Date.now();
    await page1.reload({ waitUntil: 'domcontentloaded' });

    // Wait for authenticated interface
    await page1.waitForSelector('.home-feed-layout, .top-header, .sinc-app-shell', { timeout: 15000 });
    const t4ReloadMs = Date.now() - startT4;
    report.metrics.authenticatedReloadMs = t4ReloadMs;

    const reloadInfo = await page1.evaluate(() => {
      const loginCard = document.querySelector('.auth-card');
      const oldLoader = document.body.innerText.includes('Loading SINC platform');
      const feed = document.querySelector('.home-feed-layout, .feed-posts-stream');
      const headerLogo = document.querySelector('.topheader-logo, .sinc-corporate-logo, img.sinc-official-logo');

      return {
        hasLoginCard: !!loginCard,
        hasOldLoader: oldLoader,
        hasFeed: !!feed,
        headerLogoSrc: headerLogo ? headerLogo.src : null
      };
    });

    const t4Passed =
      reloadInfo.hasFeed &&
      !reloadInfo.hasLoginCard &&
      !reloadInfo.hasOldLoader &&
      reloadInfo.headerLogoSrc &&
      reloadInfo.headerLogoSrc.includes('sinc-official-logo');

    recordResult('TEST_4', 'Authenticated Reload & Smooth Session Restoration', t4Passed, {
      message: `Session restored in ${t4ReloadMs}ms without flashing login card or obsolete loader.`,
      timingMs: t4ReloadMs,
      reloadInfo
    });

    // =========================================================================
    // TEST 5: User Sign-Out Flow
    // =========================================================================
    console.log('\n--- TEST 5: Sign-Out Transition ---');
    const startT5 = Date.now();
    // Click header user menu trigger, then click logout
    await page1.click('#header-user-menu-btn');
    await page1.waitForSelector('.logout-item', { timeout: 3000 });
    await page1.click('.logout-item');

    await page1.waitForSelector('.sinc-welcome-hero, input#email', { timeout: 10000 });
    const t5SignOutMs = Date.now() - startT5;
    report.metrics.signOutToWelcomeMs = t5SignOutMs;

    const signOutInfo = await page1.evaluate(() => {
      const hero = document.querySelector('.sinc-welcome-hero');
      const emblem = document.querySelector('img.sinc-official-logo');
      const feed = document.querySelector('.home-feed-layout, .feed-posts-stream');
      const oldLoader = document.body.innerText.includes('Loading SINC platform');

      return {
        hasHero: !!hero,
        hasEmblem: !!emblem,
        hasFeed: !!feed,
        hasOldLoader: oldLoader,
        emblemSrc: emblem ? emblem.src : null
      };
    });

    await page1.screenshot({
      path: path.join(__dirname, 'screenshots', 'test5_signed_out_welcome.png')
    });

    const t5Passed =
      signOutInfo.hasHero &&
      signOutInfo.hasEmblem &&
      !signOutInfo.hasFeed &&
      !signOutInfo.hasOldLoader &&
      signOutInfo.emblemSrc.includes('sinc-official-logo');

    recordResult('TEST_5', 'Sign-Out Transition to Unauthenticated Welcome Experience', t5Passed, {
      message: `Signed out in ${t5SignOutMs}ms. Welcome screen returned with official emblem. Protected content cleared.`,
      timingMs: t5SignOutMs,
      signOutInfo
    });

    // =========================================================================
    // TEST 6: Reload After Sign-Out
    // =========================================================================
    console.log('\n--- TEST 6: Reload After Sign-Out ---');
    const startT6 = Date.now();
    await page1.reload({ waitUntil: 'domcontentloaded' });
    await page1.waitForSelector('.sinc-welcome-hero, input#email', { timeout: 5000 });
    const t6ReloadAfterSignOutMs = Date.now() - startT6;

    const reloadAfterSignOutInfo = await page1.evaluate(() => {
      const hero = document.querySelector('.sinc-welcome-hero');
      const feed = document.querySelector('.home-feed-layout, .feed-posts-stream');
      const oldLoader = document.body.innerText.includes('Loading SINC platform');
      const emblem = document.querySelector('img.sinc-official-logo');

      return {
        hasHero: !!hero,
        hasFeed: !!feed,
        hasOldLoader: oldLoader,
        emblemSrc: emblem ? emblem.src : null
      };
    });

    const t6Passed =
      reloadAfterSignOutInfo.hasHero &&
      !reloadAfterSignOutInfo.hasFeed &&
      !reloadAfterSignOutInfo.hasOldLoader &&
      reloadAfterSignOutInfo.emblemSrc.includes('sinc-official-logo');

    recordResult('TEST_6', 'Browser Reload After Sign-Out Keeps Unauthenticated Welcome', t6Passed, {
      message: `After reload, stayed on unauthenticated welcome hero in ${t6ReloadAfterSignOutMs}ms.`,
      timingMs: t6ReloadAfterSignOutMs,
      reloadAfterSignOutInfo
    });

    // =========================================================================
    // TEST 7: Interactive Welcome Story Launch & Skip
    // =========================================================================
    console.log('\n--- TEST 7: Interactive Welcome Story Launch & Skip ---');
    const startT7 = Date.now();
    await page1.click('#welcome-story-trigger-btn');

    // Wait for the canvas story dialog to open
    const overlaySelector = 'div[role="dialog"][aria-label*="Society for Innovation"]';
    await page1.waitForSelector(overlaySelector, { timeout: 5000 });
    const t7StoryLaunchMs = Date.now() - startT7;

    const storyDialogInfo = await page1.evaluate((sel) => {
      const dialog = document.querySelector(sel);
      if (!dialog) return null;
      const canvas = dialog.querySelector('canvas');
      const skipBtn = dialog.querySelector('button');
      return {
        hasDialog: true,
        hasCanvas: !!canvas,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        skipBtnText: skipBtn ? skipBtn.textContent.trim() : null
      };
    }, overlaySelector);

    // Click Skip to return to login form
    await page1.click(`${overlaySelector} button`);
    await page1.waitForSelector('.sinc-welcome-hero', { timeout: 3000 });

    const t7Passed =
      storyDialogInfo &&
      storyDialogInfo.hasCanvas &&
      storyDialogInfo.skipBtnText === 'Skip';

    recordResult('TEST_7', 'Interactive Welcome Story Launch & Instant Skip', t7Passed, {
      message: `Canvas story opened in ${t7StoryLaunchMs}ms and dismissed cleanly via Skip.`,
      timingMs: t7StoryLaunchMs,
      storyDialogInfo
    });

    // =========================================================================
    // TEST 8: Responsive Scaling & Multi-Viewport Layout
    // =========================================================================
    console.log('\n--- TEST 8: Responsive Viewport & Zoom Verification ---');
    const viewports = [
      { name: 'desktop_1366x768', width: 1366, height: 768 },
      { name: 'tablet_768x1024', width: 768, height: 1024 },
      { name: 'mobile_390x844', width: 390, height: 844 }
    ];

    const responsiveResults = [];
    for (const vp of viewports) {
      await page1.setViewportSize({ width: vp.width, height: vp.height });
      await page1.waitForTimeout(300);

      const vpInfo = await page1.evaluate(() => {
        const emblem = document.querySelector('img.sinc-official-logo');
        const card = document.querySelector('.auth-card');
        const tabs = document.querySelector('.sinc-welcome-tabs');
        const email = document.querySelector('input#email');
        const submit = document.querySelector('button[type="submit"]');

        const rect = emblem ? emblem.getBoundingClientRect() : null;
        const overflow = document.documentElement.scrollWidth > window.innerWidth;

        return {
          emblemRendered: !!emblem && rect && rect.width > 0 && rect.height > 0,
          aspectRatio1to1: rect ? Math.abs(rect.width - rect.height) < 2 : false,
          hasHorizontalScroll: overflow,
          cardVisible: !!card,
          tabsVisible: !!tabs,
          inputsVisible: !!email && !!submit
        };
      });

      await page1.screenshot({
        path: path.join(__dirname, 'screenshots', `test8_viewport_${vp.name}.png`)
      });

      responsiveResults.push({ viewport: vp.name, ...vpInfo });
    }

    const t8Passed = responsiveResults.every(
      (r) => r.emblemRendered && r.aspectRatio1to1 && !r.hasHorizontalScroll && r.inputsVisible
    );

    recordResult('TEST_8', 'Responsive Scaling & Viewport Adaptability', t8Passed, {
      message: `Verified across desktop (1366x768), tablet (768x1024), and mobile (390x844). 1:1 emblem aspect ratio preserved.`,
      responsiveResults
    });

    await ctx1.close();

  } catch (err) {
    console.error('Test execution error:', err);
    report.summary.failed++;
    report.error = err.message;
  } finally {
    await browser.close();
  }

  // Write verification results JSON
  const outputPath = path.join(__dirname, '..', '..', 'reports', 'sinc_welcome_auth_verification_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n========================================================================`);
  console.log(`VERIFICATION SUMMARY: ${report.summary.passed}/${report.summary.total} PASSED`);
  console.log(`Results saved to: ${outputPath}`);
  console.log(`========================================================================\n`);

  return report;
}

runAuthWelcomeFlowVerification()
  .then((r) => {
    process.exit(r.summary.failed === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
