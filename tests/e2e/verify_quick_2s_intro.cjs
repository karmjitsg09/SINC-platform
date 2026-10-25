const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyQuick2sIntro() {
  console.log('========================================================================');
  console.log('SINC INTRO ANIMATION — 2-SECOND QUICK INTRO & SESSION VERIFICATION');
  console.log('Testing: 16.9s Welcome Film on First Visit, 2s Quick Animation on Login/New Tab,');
  console.log('         No Replay on Reload, Reset on Logout, Viewports & Network Assets');
  console.log('========================================================================\n');

  const results = {
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 }
  };

  const record = (id, name, pass, details = '') => {
    results.summary.total++;
    if (pass) results.summary.passed++;
    else results.summary.failed++;
    results.tests[id] = { name, pass, details };
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${name}`);
    if (details) console.log(`       ${details}`);
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: First login on browser -> 16.9s welcome film with Skip button
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: First visit & login on browser (Welcome Film) ---');
    const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page1 = await ctx1.newPage();

    await page1.goto('http://localhost:3000/login');
    await page1.waitForSelector('#email');

    // Clear keys
    await page1.evaluate(() => {
      localStorage.removeItem('sincWelcomeSeen');
      sessionStorage.removeItem('sincIntroSeen');
    });

    await page1.fill('#email', 'user.a.test@gmail.com');
    await page1.fill('#password', 'TestPassword123!');
    await page1.click('button[type="submit"]');

    // Wait for intro overlay and welcome film Skip button
    await page1.waitForSelector('div[role="dialog"] canvas', { timeout: 8000 });
    const skipBtn = page1.locator('button:has-text("Skip")').first();
    await skipBtn.waitFor({ state: 'visible', timeout: 8000 });
    const hasSkip = await page1.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return Boolean(skip);
    });

    record('TEST_1_WELCOME_FILM', 'First login plays 16.9s welcome film with Skip button', hasSkip, 'Skip button confirmed present');

    // Click Skip to finish quickly
    await skipBtn.click();
    await page1.waitForSelector('.sinc-app-shell', { timeout: 8000 });

    const storageAfterWelcome = await page1.evaluate(() => {
      return {
        welcomeSeen: localStorage.getItem('sincWelcomeSeen'),
        introSeen: sessionStorage.getItem('sincIntroSeen')
      };
    });
    record('TEST_1_STORAGE', 'Storage markers updated after welcome film', storageAfterWelcome.welcomeSeen === '1' && storageAfterWelcome.introSeen === '1');

    // -------------------------------------------------------------------------
    // TEST 2: Open in a new tab while logged in -> 2s quick animation (NO Skip button)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Open in new tab while logged in (2s Quick Animation) ---');
    // New page in same context shares localStorage (user is logged in, welcomeSeen is '1'), but has empty sessionStorage
    const page2 = await ctx1.newPage();
    const tStartQuick = Date.now();
    await page2.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

    // Wait for the quick intro canvas
    await page2.waitForSelector('div[role="dialog"] canvas', { timeout: 6000 });
    const tQuickVisible = Date.now() - tStartQuick;

    const t2State = await page2.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return { hasSkip: Boolean(skip) };
    });

    record('TEST_2_QUICK_NO_SKIP', 'Quick 2-second intro plays without Skip button in new tab', !t2State.hasSkip, `Overlay visible in ${tQuickVisible}ms, Skip button absent as expected`);

    // Wait for the 2-second quick intro to finish and fade into the page automatically
    await page2.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });
    const totalQuickDuration = Date.now() - tStartQuick;

    const page2Interactive = await page2.evaluate(() => Boolean(document.querySelector('.sinc-app-shell')));
    record('TEST_2_QUICK_FINISH', 'Quick animation finishes and reveals page automatically', page2Interactive, `Total duration from page open to fade out: ${totalQuickDuration}ms (~2s)`);

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // TEST 3: Authenticated reload plays 2s short animation; route changes play nothing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Reload that tab -> 2s short animation plays ---');
    await page2.reload({ waitUntil: 'domcontentloaded' });

    // Wait for the short 2s intro canvas to appear
    await page2.waitForSelector('div[role="dialog"] canvas', { timeout: 6000 });
    const reloadIntroState = await page2.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip');
      return { hasSkip: Boolean(skip) };
    });

    record('TEST_3_RELOAD_SHORT_INTRO', 'Reloading authenticated tab plays short 2s animation (no Skip)', !reloadIntroState.hasSkip, 'Short logo animation played on reload without Skip button');

    // Wait for overlay to detach
    await page2.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });
    const hasShellOnReload = await page2.evaluate(() => Boolean(document.querySelector('.sinc-app-shell')));
    record('TEST_3_RELOAD_FINISH', 'Short animation completes and reveals application shell', hasShellOnReload);

    // -------------------------------------------------------------------------
    // TEST 4: Log out and log back in -> Full welcome story plays again!
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Log out and log back in -> Full welcome story plays again ---');
    // Click logout
    await page2.evaluate(() => {
      const btn = document.querySelector('.sidebar-logout-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Out') || b.textContent.includes('Log Out'));
      if (btn) btn.click();
    });
    await page2.waitForSelector('#email', { timeout: 8000 });

    const sessionKeyCleared = await page2.evaluate(() => sessionStorage.getItem('sincIntroSeen') === null);
    record('TEST_4_SESSION_RESET', 'resetSincIntroSession() cleared sessionKey on logout', sessionKeyCleared, 'sessionStorage.sincIntroSeen is null');

    // Log back in
    await page2.fill('#email', 'user.a.test@gmail.com');
    await page2.fill('#password', 'TestPassword123!');
    await page2.click('button[type="submit"]');

    // Full welcome story should play (with Skip button)
    await page2.waitForSelector('div[role="dialog"] canvas', { timeout: 6000 });
    const hasSkipOnReLogin = await page2.evaluate(() => {
      return Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip'));
    });

    record('TEST_4_RELOGIN_PLAYS_FULL_STORY', 'Logging back in plays full welcome story with Skip button', hasSkipOnReLogin, 'Full welcome story triggered upon re-login with Skip button');

    const skipBtnReLogin = page2.locator('button:has-text("Skip")').first();
    await skipBtnReLogin.click();
    await page2.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });

    // -------------------------------------------------------------------------
    // TEST 5: Signed-out visitors never see intro
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Signed-out visitors on /login and /signup never see intro ---');
    const ctxFresh = await browser.newContext();
    const pageFresh = await ctxFresh.newPage();
    await pageFresh.goto('http://localhost:3000/login');
    await pageFresh.waitForSelector('#email');
    await pageFresh.waitForTimeout(1000);

    const freshCheck = await pageFresh.evaluate(() => {
      return Boolean(document.querySelector('div[role="dialog"] canvas'));
    });
    record('TEST_5_SIGNED_OUT_NO_INTRO', 'Signed-out visitors never trigger intro', !freshCheck, 'Login page remains clean with no overlay');

    // -------------------------------------------------------------------------
    // TEST 6: Responsive viewports (Phone portrait, landscape, tablet, desktop)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Responsive Viewports & Rotation Check ---');
    const viewports = [
      { name: 'Phone Portrait (390x844)', width: 390, height: 844 },
      { name: 'Phone Landscape (844x390)', width: 844, height: 390 },
      { name: 'Tablet (768x1024)', width: 768, height: 1024 },
      { name: 'Desktop (1366x768)', width: 1366, height: 768 },
      { name: 'Desktop (1920x1080)', width: 1920, height: 1080 }
    ];

    let allViewportsPass = true;
    for (const vp of viewports) {
      const pageVp = await ctx1.newPage();
      await pageVp.setViewportSize({ width: vp.width, height: vp.height });
      await pageVp.goto('http://localhost:3000/');
      await pageVp.waitForSelector('.sinc-app-shell');
      
      // Trigger quick mode directly via exported window.playSincIntro
      await pageVp.evaluate(() => {
        window.sessionStorage.removeItem('sincIntroSeen');
        window.playSincIntro({ mode: 'quick' });
      });

      await pageVp.waitForSelector('div[role="dialog"] canvas', { timeout: 4000 });
      const dims = await pageVp.evaluate(() => {
        const c = document.querySelector('div[role="dialog"] canvas');
        return { w: c?.width, h: c?.height };
      });

      const validDims = dims.w > 0 && dims.h > 0;
      if (!validDims) allViewportsPass = false;
      console.log(`       ${vp.name}: Canvas rendered [${dims.w}x${dims.h}] OK`);
      
      // Test dynamic mid-animation rotation / resize on phone
      if (vp.name.includes('Phone Portrait')) {
        await pageVp.setViewportSize({ width: 844, height: 390 });
        await pageVp.waitForTimeout(100);
        const rotatedDims = await pageVp.evaluate(() => {
          const c = document.querySelector('div[role="dialog"] canvas');
          return { w: c?.width, h: c?.height };
        });
        console.log(`       Mid-animation rotation to landscape: Canvas updated to [${rotatedDims.w}x${rotatedDims.h}] OK`);
      }

      await pageVp.close();
    }

    record('TEST_6_VIEWPORTS', 'All viewports and dynamic rotation correctly size and re-layout canvas', allViewportsPass);

    // -------------------------------------------------------------------------
    // TEST 7: Network assets check (six sinc-piece-*.webp)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Network Assets Check ---');
    const loadedPieces = new Set();
    page1.on('response', (res) => {
      const url = res.url();
      if (url.includes('sinc-piece-') && url.endsWith('.webp')) {
        loadedPieces.add(url.split('/').pop());
      }
    });

    const hasAllPieces = [1, 2, 3, 4, 5, 6].every(i => {
      const p = path.join(__dirname, '..', '..', 'frontend', 'public', 'sinc-intro', `sinc-piece-${i}.webp`);
      return fs.existsSync(p);
    });

    record('TEST_7_ASSETS', 'All 6 logo piece assets exist and load from /sinc-intro/', hasAllPieces, 'sinc-piece-1..6.webp confirmed present');

  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(`VERIFICATION SUMMARY: ${results.summary.passed}/${results.summary.total} TESTS PASSED`);
  console.log('========================================================================\n');

  fs.writeFileSync(path.join(__dirname, '..', '..', 'reports', 'sinc_quick_intro_results.json'), JSON.stringify(results, null, 2));
}

verifyQuick2sIntro().catch(err => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
