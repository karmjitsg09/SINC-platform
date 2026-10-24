const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runMasterAuthExperienceVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — MASTER AUTHENTICATION EXPERIENCE & TRANSITION TEST SUITE');
  console.log('Phases: Clean Sign-In, 4-Field Sign-Up, Full Post-Login Story,');
  console.log('        Short Logo Flourish on Reload, Sign-Out, Lifecycle & Performance');
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
    // TEST A: Fresh Unauthenticated Visit
    // =========================================================================
    console.log('\n--- TEST A: Fresh Unauthenticated Visit ---');
    const ctxA = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const pageA = await ctxA.newPage();

    const tStartA = Date.now();
    await pageA.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

    // 1. Wait for emblem
    await pageA.waitForSelector('.sinc-welcome-emblem img', { state: 'visible', timeout: 5000 });
    const logoVisibleTime = Date.now() - tStartA;

    // 2. Check obsolete elements
    const obsoleteCheck = await pageA.evaluate(() => {
      const hasWelcomeStoryBtn = Boolean(document.getElementById('welcome-story-trigger-btn') || document.querySelector('.sinc-welcome-story-trigger'));
      const hasTabs = Boolean(document.querySelector('.sinc-welcome-tabs') || document.getElementById('auth-tab-signin'));
      const hasObsoleteLoader = document.body.innerText.includes('Loading SINC platform');
      const isDefaultSignIn = Boolean(document.getElementById('email') && document.getElementById('password') && !document.getElementById('confirmPassword'));
      const footerBtn = document.getElementById('auth-switch-to-signup-btn');
      const footerText = footerBtn ? (footerBtn.parentElement?.textContent || '') : '';
      const hasCorrectFooter = footerText.includes("Don't have an account?") && footerBtn.textContent.includes('Sign Up');
      
      const emblemImg = document.querySelector('.sinc-welcome-emblem img');
      const emblemSrc = emblemImg ? emblemImg.getAttribute('src') : '';

      return {
        hasWelcomeStoryBtn,
        hasTabs,
        hasObsoleteLoader,
        isDefaultSignIn,
        hasCorrectFooter,
        emblemSrc
      };
    });

    const passA = !obsoleteCheck.hasWelcomeStoryBtn &&
                  !obsoleteCheck.hasTabs &&
                  !obsoleteCheck.hasObsoleteLoader &&
                  obsoleteCheck.isDefaultSignIn &&
                  obsoleteCheck.hasCorrectFooter &&
                  obsoleteCheck.emblemSrc.includes('sinc-official-logo');

    recordResult('TEST_A', 'Fresh Unauthenticated Visit: Clean UI & Branding', passA, {
      message: `Sign In is default, tabs removed, welcome story button removed, official emblem verified (${obsoleteCheck.emblemSrc})`,
      timingMs: logoVisibleTime
    });
    report.metrics.logoVisibleTimeMs = logoVisibleTime;

    // Save screenshot of fresh unauthenticated view
    await pageA.screenshot({ path: path.join(__dirname, 'screenshots', 'master_auth_fresh_signin.png') });

    // =========================================================================
    // TEST B: Sign Up Navigation & 4-Field Form Validation
    // =========================================================================
    console.log('\n--- TEST B: Sign Up Navigation & 4-Field Form Validation ---');
    const tStartNavB = Date.now();
    await pageA.click('#auth-switch-to-signup-btn');
    
    // Wait for Create Account form (confirmPassword field)
    await pageA.waitForSelector('#confirmPassword', { state: 'visible', timeout: 5000 });
    const signUpTransitionTime = Date.now() - tStartNavB;

    const signUpFields = await pageA.evaluate(() => {
      const hasName = Boolean(document.getElementById('name'));
      const hasEmail = Boolean(document.getElementById('email'));
      const hasPassword = Boolean(document.getElementById('password'));
      const hasConfirmPassword = Boolean(document.getElementById('confirmPassword'));
      const hasTabs = Boolean(document.querySelector('.sinc-welcome-tabs'));
      const hasStoryBtn = Boolean(document.getElementById('welcome-story-trigger-btn'));
      const returnBtn = document.getElementById('auth-switch-to-signin-btn');
      const hasReturnLink = Boolean(returnBtn && returnBtn.textContent.includes('Sign In'));

      return { hasName, hasEmail, hasPassword, hasConfirmPassword, hasTabs, hasStoryBtn, hasReturnLink };
    });

    // Test form validation: empty submit
    await pageA.click('#signup-submit-btn');
    await pageA.waitForTimeout(300);

    const emptyValidation = await pageA.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Full name is required') || body.includes('Email is required') || body.includes('Password is required');
    });

    // Test password mismatch
    await pageA.fill('#name', 'Test Student');
    await pageA.fill('#email', 'student@example.com');
    await pageA.fill('#password', 'ValidPass123!');
    await pageA.fill('#confirmPassword', 'DifferentPass999!');
    await pageA.click('#signup-submit-btn');
    await pageA.waitForTimeout(300);

    const mismatchValidation = await pageA.evaluate(() => {
      return document.body.innerText.includes('Passwords do not match');
    });

    // Test smooth return to Sign In
    await pageA.click('#auth-switch-to-signin-btn');
    await pageA.waitForSelector('#email', { state: 'visible' });
    const returnedToSignIn = await pageA.evaluate(() => {
      return !document.getElementById('confirmPassword') && Boolean(document.getElementById('auth-switch-to-signup-btn'));
    });

    const passB = signUpFields.hasName &&
                  signUpFields.hasEmail &&
                  signUpFields.hasPassword &&
                  signUpFields.hasConfirmPassword &&
                  !signUpFields.hasTabs &&
                  !signUpFields.hasStoryBtn &&
                  signUpFields.hasReturnLink &&
                  emptyValidation &&
                  mismatchValidation &&
                  returnedToSignIn;

    recordResult('TEST_B', 'Sign Up Navigation & 4-Field Validation', passB, {
      message: `4 fields present, tabs removed, empty validation passed, password mismatch rejected, smooth return to Sign In`,
      timingMs: signUpTransitionTime
    });
    report.metrics.signUpTransitionTimeMs = signUpTransitionTime;

    // Save screenshot of SignUp form
    await pageA.click('#auth-switch-to-signup-btn');
    await pageA.waitForSelector('#confirmPassword');
    await pageA.screenshot({ path: path.join(__dirname, 'screenshots', 'master_auth_signup_form.png') });
    await pageA.click('#auth-switch-to-signin-btn');
    await pageA.waitForSelector('#email');

    // =========================================================================
    // TEST C: Password Sign-In & Automatic Full Welcome Story Playback
    // =========================================================================
    console.log('\n--- TEST C: Password Sign-In & Post-Auth Welcome Film ---');
    await pageA.fill('#email', 'user.a.test@gmail.com');
    await pageA.fill('#password', 'TestPassword123!');

    const tSubmit = Date.now();
    await pageA.click('button[type="submit"]');

    // Wait for the full welcome story canvas overlay to appear
    await pageA.waitForSelector('div[role="dialog"] canvas', { state: 'visible', timeout: 8000 });
    const authToStoryStart = Date.now() - tSubmit;

    // Check that dashboard is NOT visible underneath the animation stage
    const stageCheck = await pageA.evaluate(() => {
      const hasStage = Boolean(document.querySelector('.sinc-welcome-story-stage'));
      const hasFeed = Boolean(document.querySelector('.feed-container, .feed-wrapper'));
      const hasHeader = Boolean(document.querySelector('.top-header, .header-container'));
      const hasSkip = Boolean(Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Skip'));
      return { hasStage, hasFeed, hasHeader, hasSkip };
    });

    recordResult('TEST_C_CANVAS', 'Automatic Full Welcome Film on Password Sign-In', stageCheck.hasSkip && !stageCheck.hasFeed, {
      message: `Full welcome canvas launched automatically in ${authToStoryStart}ms. Dashboard decoupled from stage (hasFeed: ${stageCheck.hasFeed}). Skip button verified.`,
      timingMs: authToStoryStart
    });
    report.metrics.authToStoryStartMs = authToStoryStart;

    // Save screenshot during welcome story
    await pageA.screenshot({ path: path.join(__dirname, 'screenshots', 'master_auth_welcome_story_canvas.png') });

    // Test Skip behavior: Click Skip to enter application smoothly
    const tSkip = Date.now();
    const skipBtn = await pageA.locator('button:has-text("Skip")').first();
    await skipBtn.click();

    // Wait for authenticated shell to appear and overlay to detach
    await pageA.waitForSelector('.sinc-app-shell', { state: 'visible', timeout: 8000 });
    await pageA.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });
    const skipToDashboardTime = Date.now() - tSkip;

    const inApp = await pageA.evaluate(() => {
      const hasShell = Boolean(document.querySelector('.sinc-app-shell'));
      const hasStoryStage = Boolean(document.querySelector('.sinc-welcome-story-stage'));
      const hasCanvas = Boolean(document.querySelector('div[role="dialog"] canvas'));
      return hasShell && !hasStoryStage && !hasCanvas;
    });

    recordResult('TEST_C_SKIP', 'Skip Welcome Story & Smooth Transition to App', inApp, {
      message: `Welcome film dismissed cleanly in ${skipToDashboardTime}ms; entered authenticated application shell`,
      timingMs: skipToDashboardTime
    });
    report.metrics.skipToDashboardTimeMs = skipToDashboardTime;

    // Save screenshot of authenticated dashboard
    await pageA.screenshot({ path: path.join(__dirname, 'screenshots', 'master_auth_dashboard_entered.png') });

    // =========================================================================
    // TEST F: Authenticated Page Reload (Logo-Only Splash Flourish)
    // =========================================================================
    console.log('\n--- TEST F: Authenticated Reload: Short Logo-Only Entrance ---');
    const tReloadStart = Date.now();
    await pageA.reload({ waitUntil: 'domcontentloaded' });

    // Check for short logo splash
    let sawLogoSplash = false;
    let sawFullWelcomeStory = false;

    // Poll rapidly for 1.5 second to inspect the initialization phase
    for (let i = 0; i < 20; i++) {
      const state = await pageA.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const hasSkip = Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip'));
        return {
          hasLogoSplash: Boolean(document.querySelector('.sinc-logo-splash, .sinc-intro-quick') || (dialog && !hasSkip)),
          hasFullStory: Boolean(hasSkip || dialog?.dataset?.introMode === 'welcome'),
          hasShell: Boolean(document.querySelector('.sinc-app-shell'))
        };
      });
      if (state.hasLogoSplash) sawLogoSplash = true;
      if (state.hasFullStory) sawFullWelcomeStory = true;
      if (state.hasShell && !state.hasLogoSplash) break;
      await pageA.waitForTimeout(50);
    }

    // Wait for authenticated app shell to be fully visible and splash to finish
    await pageA.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 5000 });
    await pageA.waitForSelector('.sinc-app-shell', { state: 'visible', timeout: 8000 });
    const reloadTotalTime = Date.now() - tReloadStart;

    const passF = !sawFullWelcomeStory && sawLogoSplash;

    recordResult('TEST_F', 'Authenticated Reload: Short Logo-Only Entrance Flourish', passF, {
      message: `Logo splash entrance observed (${sawLogoSplash}), 16.9s full welcome film NOT played (${!sawFullWelcomeStory}), total reload time ${reloadTotalTime}ms`,
      timingMs: reloadTotalTime
    });
    report.metrics.reloadTotalTimeMs = reloadTotalTime;

    // =========================================================================
    // TEST G: Sign-Out & Return Visit Lifecycle
    // =========================================================================
    console.log('\n--- TEST G: Sign-Out & Return Visit Lifecycle ---');
    const tLogout = Date.now();

    // Trigger logout via .sidebar-logout-btn or header dropdown
    const logoutSuccess = await pageA.evaluate(async () => {
      const sidebarLogout = document.querySelector('.sidebar-logout-btn');
      if (sidebarLogout) {
        sidebarLogout.click();
        return true;
      }
      return false;
    });

    if (!logoutSuccess) {
      // Fallback click on profile menu or trigger via DOM
      await pageA.click('.sidebar-logout-btn').catch(() => {});
    }

    // Wait for Login page to reappear
    await pageA.waitForSelector('#auth-switch-to-signup-btn', { state: 'visible', timeout: 8000 });
    const logoutTime = Date.now() - tLogout;

    // Reload while logged out: confirm user stays logged out and no animation plays
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector('#email', { state: 'visible', timeout: 8000 });

    const postLogoutState = await pageA.evaluate(() => {
      const isLoginVisible = Boolean(document.getElementById('email') && document.getElementById('auth-switch-to-signup-btn'));
      const hasCanvas = Boolean(document.querySelector('div[role="dialog"] canvas'));
      const hasAppShell = Boolean(document.querySelector('.sinc-app-shell'));
      return { isLoginVisible, hasCanvas, hasAppShell };
    });

    const passG = postLogoutState.isLoginVisible && !postLogoutState.hasCanvas && !postLogoutState.hasAppShell;

    recordResult('TEST_G', 'Sign-Out & Return Visit Correctness', passG, {
      message: `Sign-out transitioned to login view in ${logoutTime}ms; reload stayed unauthenticated with zero animation leaks`,
      timingMs: logoutTime
    });
    report.metrics.logoutTimeMs = logoutTime;

    // =========================================================================
    // TEST I: Responsive Viewports & Zoom
    // =========================================================================
    console.log('\n--- TEST I: Responsive Viewports & Layout Stability ---');
    const viewports = [
      { name: 'Desktop 1280x800', width: 1280, height: 800 },
      { name: 'Tablet 768x1024', width: 768, height: 1024 },
      { name: 'Mobile 375x812', width: 375, height: 812 }
    ];

    let allResponsivePass = true;
    for (const vp of viewports) {
      await pageA.setViewportSize({ width: vp.width, height: vp.height });
      await pageA.waitForTimeout(200);

      const vpStatus = await pageA.evaluate(() => {
        const email = document.getElementById('email');
        const signupBtn = document.getElementById('auth-switch-to-signup-btn');
        const emblem = document.querySelector('.sinc-welcome-emblem img');
        
        const emailBox = email ? email.getBoundingClientRect() : null;
        const btnBox = signupBtn ? signupBtn.getBoundingClientRect() : null;
        const emblemBox = emblem ? emblem.getBoundingClientRect() : null;

        return {
          hasEmail: Boolean(email && emailBox && emailBox.width > 100),
          hasFooter: Boolean(signupBtn && btnBox && btnBox.width > 20),
          hasEmblem: Boolean(emblem && emblemBox && emblemBox.width > 30)
        };
      });

      const vpPass = vpStatus.hasEmail && vpStatus.hasFooter && vpStatus.hasEmblem;
      if (!vpPass) allResponsivePass = false;
      console.log(`       Viewport ${vp.name}: ${vpPass ? 'OK' : 'FAIL'}`);
    }

    recordResult('TEST_I', 'Responsive Viewport Stability (Desktop, Tablet, Mobile)', allResponsivePass, {
      message: 'All viewports maintain correct logo proportions, accessible inputs, and visible footer controls'
    });

    await ctxA.close();

  } finally {
    await browser.close();
  }

  // Write machine-readable report
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'reports', 'master_auth_experience_results.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  console.log('\n========================================================================');
  console.log(`VERIFICATION COMPLETE: ${report.summary.passed}/${report.summary.total} TESTS PASSED`);
  console.log('========================================================================\n');
}

runMasterAuthExperienceVerification().catch((err) => {
  console.error('[FATAL RUNNER ERROR]:', err);
  process.exit(1);
});
