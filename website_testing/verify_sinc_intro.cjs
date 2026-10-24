const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifySincIntro() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — INTRO ANIMATION VERIFICATION SUITE');
  console.log('Testing pure code canvas animation, responsiveness, and login flows');
  console.log('========================================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    checklist: {},
    summary: { passed: 0, failed: 0 }
  };

  const recordCheck = (id, name, passed, details) => {
    report.checklist[id] = { name, passed, details };
    if (passed) {
      report.summary.passed++;
      console.log(`[PASS] ${id}: ${name}\n       Details: ${details}\n`);
    } else {
      report.summary.failed++;
      console.log(`[FAIL] ${id}: ${name}\n       Details: ${details}\n`);
    }
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const overlaySelector = 'div[role="dialog"][aria-label*="Society for Innovation"]';

    // -------------------------------------------------------------------------
    // TEST 1: FIRST LOGIN WELCOME FILM (16.9s)
    // -------------------------------------------------------------------------
    console.log('--- Test 1: First login on browser (Welcome Film 16.9s) ---');
    const context1 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page1 = await context1.newPage();

    const loadedImages = [];
    const consoleErrors = [];
    page1.on('requestfinished', (req) => {
      const url = req.url();
      if (url.includes('/sinc-intro/sinc-piece-') && url.endsWith('.webp')) {
        loadedImages.push(url);
      }
    });
    page1.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page1.goto('http://localhost:3000/login');
    await page1.evaluate(() => {
      localStorage.removeItem('sincWelcomeSeen');
      sessionStorage.removeItem('sincIntroSeen');
    });

    await page1.fill('input#email', 'user.a.test@gmail.com');
    await page1.fill('input#password', 'TestPassword123!');
    await page1.click('button[type="submit"]');

    // Overlay should mount immediately with role="dialog"
    await page1.waitForSelector(overlaySelector, { timeout: 10000 });

    const overlayInfo = await page1.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const canvas = el.querySelector('canvas');
      const skipBtn = el.querySelector('button');
      return {
        hasCanvas: !!canvas,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        hasSkipBtn: !!skipBtn,
        skipBtnText: skipBtn ? skipBtn.textContent.trim() : null,
        zIndex: window.getComputedStyle(el).zIndex,
        overflow: document.documentElement.style.overflow
      };
    }, overlaySelector);

    const hasAll6Images = [1, 2, 3, 4, 5, 6].every((num) =>
      loadedImages.some((u) => u.includes(`sinc-piece-${num}.webp`))
    );

    const test1Passed =
      overlayInfo &&
      overlayInfo.hasCanvas &&
      overlayInfo.hasSkipBtn &&
      overlayInfo.skipBtnText === 'Skip' &&
      overlayInfo.zIndex === '9999' &&
      overlayInfo.overflow === 'hidden' &&
      hasAll6Images;

    recordCheck(
      'CHECK-1',
      'First login plays 16.9s welcome film with canvas, skip button, and 6 logo assets',
      test1Passed,
      `Canvas: ${overlayInfo?.canvasW}x${overlayInfo?.canvasH}, Skip button: "${overlayInfo?.skipBtnText}", Z-index: ${overlayInfo?.zIndex}, Images: ${loadedImages.length}/6 loaded`
    );

    // -------------------------------------------------------------------------
    // TEST 3: SKIP BUTTON / ESC / TAP ANYWHERE
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Skip button & scroll restoration ---');
    // 3A: Click the Skip button
    await page1.click('div[role="dialog"] button');
    await page1.waitForSelector(overlaySelector, { state: 'detached', timeout: 5000 });

    const postSkipState = await page1.evaluate(() => ({
      welcomeSeen: localStorage.getItem('sincWelcomeSeen'),
      introSeen: sessionStorage.getItem('sincIntroSeen'),
      overflow: document.documentElement.style.overflow
    }));

    const test3aPassed =
      postSkipState.welcomeSeen === '1' &&
      postSkipState.introSeen === '1' &&
      postSkipState.overflow !== 'hidden';

    recordCheck(
      'CHECK-3A',
      'Skip button closes overlay smoothly and restores page scrolling',
      test3aPassed,
      `LocalStorage: ${postSkipState.welcomeSeen}, SessionStorage: ${postSkipState.introSeen}, HTML overflow: "${postSkipState.overflow}"`
    );

    // 3B: Esc key closes intro
    await page1.evaluate(() => { window.playSincIntro({ mode: 'welcome' }); });
    await page1.waitForSelector(overlaySelector, { timeout: 8000 });
    await page1.keyboard.press('Escape');
    await page1.waitForSelector(overlaySelector, { state: 'detached', timeout: 5000 });
    const overflowAfterEsc = await page1.evaluate(() => document.documentElement.style.overflow);
    recordCheck(
      'CHECK-3B',
      'Escape key closes intro immediately and restores scroll',
      overflowAfterEsc !== 'hidden',
      `HTML overflow after Escape: "${overflowAfterEsc}"`
    );

    // 3C: Click anywhere closes intro
    await page1.evaluate(() => { window.playSincIntro({ mode: 'welcome' }); });
    await page1.waitForSelector(overlaySelector, { timeout: 8000 });
    await page1.mouse.click(200, 200);
    await page1.waitForSelector(overlaySelector, { state: 'detached', timeout: 5000 });
    const overflowAfterClick = await page1.evaluate(() => document.documentElement.style.overflow);
    recordCheck(
      'CHECK-3C',
      'Click anywhere closes intro immediately and restores scroll',
      overflowAfterClick !== 'hidden',
      `HTML overflow after Click: "${overflowAfterClick}"`
    );

    // -------------------------------------------------------------------------
    // TEST 2: RELOAD SAME TAB (NOTHING PLAYS) & NEW SESSION (SHORT 5.2s INTRO)
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Reload same tab & new window session ---');
    // Reload the same tab where welcomeKey and sessionKey are set
    await page1.reload();
    await page1.waitForTimeout(1500);

    const overlayOnReload = await page1.$(overlaySelector);
    recordCheck(
      'CHECK-2A',
      'Reloading the same tab does not replay the intro',
      overlayOnReload === null,
      overlayOnReload ? 'Overlay wrongly appeared' : 'Overlay correctly absent'
    );

    await context1.close();

    // New browser context simulating a new tab/session:
    // Has localStorage.sincWelcomeSeen = "1", but clean sessionStorage
    const context2 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page2 = await context2.newPage();
    await page2.goto('http://localhost:3000/login');
    // Set localStorage as seen, but leave sessionStorage empty
    await page2.evaluate(() => {
      localStorage.setItem('sincWelcomeSeen', '1');
      sessionStorage.removeItem('sincIntroSeen');
    });

    await page2.fill('input#email', 'user.a.test@gmail.com');
    await page2.fill('input#password', 'TestPassword123!');
    await page2.click('button[type="submit"]');

    await page2.waitForSelector(overlaySelector, { timeout: 8000 });

    const shortIntroInfo = await page2.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const skipBtn = el.querySelector('button');
      return {
        hasCanvas: !!el.querySelector('canvas'),
        hasSkipBtn: !!skipBtn,
        introSeen: sessionStorage.getItem('sincIntroSeen')
      };
    }, overlaySelector);

    const test2bPassed =
      shortIntroInfo &&
      shortIntroInfo.hasCanvas &&
      !shortIntroInfo.hasSkipBtn && // Short intro does not have a skip button
      shortIntroInfo.introSeen === '1';

    recordCheck(
      'CHECK-2B',
      'Later login in new session plays short 5.2s intro (no Skip button needed)',
      test2bPassed,
      `Has canvas: ${shortIntroInfo?.hasCanvas}, Skip button absent: ${!shortIntroInfo?.hasSkipBtn}, SessionStorage marked: ${shortIntroInfo?.introSeen}`
    );

    // Cleanly dismiss short intro
    await page2.keyboard.press('Escape');
    await page2.waitForSelector(overlaySelector, { state: 'detached', timeout: 3000 });

    // -------------------------------------------------------------------------
    // TEST 4: RESPONSIVE BEHAVIOUR ACROSS DEVICE VIEWPORTS
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Responsive behaviour across 7 screen sizes ---');
    const viewports = [
      { name: 'Phone Portrait', width: 390, height: 844 },
      { name: 'Phone Landscape', width: 844, height: 390 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Desktop 1024x768', width: 1024, height: 768 },
      { name: 'Laptop 1366x768', width: 1366, height: 768 },
      { name: 'FHD Desktop 1920x1080', width: 1920, height: 1080 },
      { name: 'Vertical Display 1080x1920', width: 1080, height: 1920 }
    ];

    let allViewportsPassed = true;
    const viewportLogs = [];

    for (const vp of viewports) {
      await page2.setViewportSize({ width: vp.width, height: vp.height });
      await page2.evaluate(() => { window.playSincIntro({ mode: 'welcome' }); });
      await page2.waitForSelector(overlaySelector, { timeout: 8000 });

      const metrics = await page2.evaluate((sel) => {
        const el = document.querySelector(sel);
        const canvas = el.querySelector('canvas');
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasScrollbar: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          canvasW: canvas.width,
          canvasH: canvas.height
        };
      }, overlaySelector);

      if (metrics.hasScrollbar) allViewportsPassed = false;
      viewportLogs.push(`${vp.name} (${vp.width}x${vp.height}): Canvas ${metrics.canvasW}x${metrics.canvasH}, No scrollbars: ${!metrics.hasScrollbar}`);

      await page2.keyboard.press('Escape');
      await page2.waitForSelector(overlaySelector, { state: 'detached', timeout: 3000 });
    }

    // Live resize mid-animation test: 390x844 -> 844x390
    await page2.setViewportSize({ width: 390, height: 844 });
    await page2.evaluate(() => { window.playSincIntro({ mode: 'welcome' }); });
    await page2.waitForSelector(overlaySelector, { timeout: 8000 });

    const cBefore = await page2.evaluate((sel) => {
      const c = document.querySelector(sel + ' canvas');
      return { w: c.width, h: c.height };
    }, overlaySelector);

    await page2.setViewportSize({ width: 844, height: 390 });
    await page2.waitForTimeout(200);

    const cAfter = await page2.evaluate((sel) => {
      const c = document.querySelector(sel + ' canvas');
      return { w: c.width, h: c.height };
    }, overlaySelector);

    const liveResizePassed = cBefore.w !== cAfter.w && cBefore.h !== cAfter.h;

    await page2.keyboard.press('Escape');
    await page2.waitForSelector(overlaySelector, { state: 'detached', timeout: 3000 });

    recordCheck(
      'CHECK-4',
      'Adapts to 7 viewport dimensions without overflow & re-lays out live on rotation',
      allViewportsPassed && liveResizePassed,
      `All 7 viewports verified. Rotation re-laid out from ${cBefore.w}x${cBefore.h} to ${cAfter.w}x${cAfter.h}`
    );

    await context2.close();

    // -------------------------------------------------------------------------
    // TEST 5: PREFERS-REDUCED-MOTION OS SETTING
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Reduced motion preference ---');
    const contextReduced = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: 'reduce'
    });
    const pageReduced = await contextReduced.newPage();
    await pageReduced.goto('http://localhost:3000/login');

    const reducedResult = await pageReduced.evaluate(async () => {
      return await window.playSincIntro({ mode: 'auto' });
    });

    const overlayOnReduced = await pageReduced.$(overlaySelector);
    const test5Passed = reducedResult === 'not-needed' && overlayOnReduced === null;

    recordCheck(
      'CHECK-5',
      'With prefers-reduced-motion: reduce enabled, intro does not play',
      test5Passed,
      `Resolved value: "${reducedResult}", Overlay present: ${overlayOnReduced !== null}`
    );

    await contextReduced.close();

    // -------------------------------------------------------------------------
    // TEST 6: MISSING ASSETS SILENT FALLBACK (NEVER BLOCKS APP)
    // -------------------------------------------------------------------------
    console.log('--- Test 6: Missing assets resilience ---');
    const contextFallback = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const pageFallback = await contextFallback.newPage();
    await pageFallback.goto('http://localhost:3000/login');

    const fallbackResult = await pageFallback.evaluate(async () => {
      return await window.playSincIntro({
        assetsBase: '/non-existent-intro-path/',
        mode: 'welcome'
      });
    });

    const overlayOnMissing = await pageFallback.$(overlaySelector);
    const test6Passed = fallbackResult === 'skipped' && overlayOnMissing === null;

    recordCheck(
      'CHECK-6',
      'Missing assets silently skip without throwing error or blocking the app',
      test6Passed,
      `Returned status: "${fallbackResult}", Overlay left on screen: ${overlayOnMissing !== null}`
    );

    await contextFallback.close();

    // -------------------------------------------------------------------------
    // TEST 7: SETTINGS & PROFILE UI REPLAY TRIGGERS
    // -------------------------------------------------------------------------
    console.log('--- Test 7: UI "Watch Intro" triggers in ProfileMenu and Settings ---');
    const contextUI = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const pageUI = await contextUI.newPage();
    await pageUI.goto('http://localhost:3000/login');
    await pageUI.fill('input#email', 'user.a.test@gmail.com');
    await pageUI.fill('input#password', 'TestPassword123!');
    await pageUI.click('button[type="submit"]');

    // Dismiss first-time intro if it appears
    try {
      await pageUI.waitForSelector(overlaySelector, { timeout: 8000 });
      await pageUI.keyboard.press('Escape');
      await pageUI.waitForSelector(overlaySelector, { state: 'detached', timeout: 3000 });
    } catch (_) {}

    // Navigate to Settings
    await pageUI.goto('http://localhost:3000/settings');
    await pageUI.waitForSelector('#settings-play-intro-btn', { timeout: 8000 });
    await pageUI.click('#settings-play-intro-btn');
    await pageUI.waitForSelector(overlaySelector, { timeout: 8000 });
    const settingsTriggerWorks = (await pageUI.$(overlaySelector)) !== null;
    await pageUI.keyboard.press('Escape');
    await pageUI.waitForSelector(overlaySelector, { state: 'detached', timeout: 3000 });

    recordCheck(
      'CHECK-7',
      'Settings Brand Experience "Play Intro" button successfully triggers welcome film',
      settingsTriggerWorks,
      `Button clicked and overlay appeared: ${settingsTriggerWorks}`
    );

    await contextUI.close();

  } catch (err) {
    console.error('[TEST RUNNER ERROR]:', err);
    report.summary.fatalError = err.message;
  } finally {
    await browser.close();
  }

  // Save report to file
  const reportPath = path.join(__dirname, 'sinc_intro_verification_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nResults written to: ${reportPath}`);
  console.log(`Summary: ${report.summary.passed} Passed, ${report.summary.failed} Failed`);
}

verifySincIntro();
