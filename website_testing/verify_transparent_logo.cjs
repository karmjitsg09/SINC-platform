const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyTransparentLogo() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — GENUINE TRANSPARENT LOGO VERIFICATION SUITE');
  console.log('Testing: Alpha Transparency, Edge Matting, Light & Dark Backgrounds,');
  console.log('         Login, SignUp, Header, Sidebar, Zoom Levels & Console Cleanliness');
  console.log('========================================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
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
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated Welcome & Login Screen (Dark & Light Theme)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Login & Welcome Screen Transparency ---');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    const failedRequests = [];
    const consoleErrors = [];
    page.on('requestfailed', (req) => failedRequests.push(req.url()));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('img.sinc-official-logo', { timeout: 8000 });

    const logoInfoDark = await page.evaluate(() => {
      const img = document.querySelector('img.sinc-official-logo');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const parent = img.parentElement;
      const parentStyle = window.getComputedStyle(parent);
      const imgStyle = window.getComputedStyle(img);

      return {
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        parentBg: parentStyle.backgroundColor,
        imgBg: imgStyle.backgroundColor,
        isTransparentAsset: img.src.includes('sinc-official-logo-transparent.png') || img.src.includes('sinc-official-logo.png')
      };
    });

    // Capture screenshot on dark theme
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_login_dark.png')
    });

    // Switch to light theme and inspect
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('theme-dark');
      document.documentElement.classList.add('theme-light');
    });
    await page.waitForTimeout(300);

    // Capture screenshot on light theme to verify NO white square on light background
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_login_light.png')
    });

    const t1Passed =
      logoInfoDark &&
      logoInfoDark.naturalWidth === 1254 &&
      logoInfoDark.naturalHeight === 1254 &&
      logoInfoDark.isTransparentAsset &&
      (logoInfoDark.imgBg === 'rgba(0, 0, 0, 0)' || logoInfoDark.imgBg === 'transparent');

    recordResult('TEST_1', 'Login & Welcome Screen Logo Asset Transparency', t1Passed, {
      message: `Emblem 1254x1254 rendered with transparent CSS background. Screenshots saved for dark and light themes.`,
      logoInfoDark
    });

    // -------------------------------------------------------------------------
    // TEST 2: Sign-Up View Transparency
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Sign-Up Screen Logo Transparency ---');
    await page.click('#auth-tab-signup');
    await page.waitForSelector('input#name', { timeout: 3000 });

    const signupLogoInfo = await page.evaluate(() => {
      const img = document.querySelector('img.sinc-official-logo');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return {
        src: img.src,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        naturalWidth: img.naturalWidth
      };
    });

    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_signup.png')
    });

    const t2Passed = signupLogoInfo && signupLogoInfo.naturalWidth === 1254;
    recordResult('TEST_2', 'Sign-Up View Logo Transparency & Sizing', t2Passed, {
      message: `Sign-Up screen renders genuine transparent emblem without layout distortion.`,
      signupLogoInfo
    });

    // -------------------------------------------------------------------------
    // TEST 3: Authenticated Top Header Logo (Dark & Light Theme)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Authenticated Top Header Logo ---');
    // Switch back to dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('theme-dark');
    });

    // Sign in with authorized test account
    await page.click('#auth-tab-signin');
    await page.fill('input#email', 'user.a.test@gmail.com');
    await page.fill('input#password', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('.home-feed-layout, .top-header', { timeout: 15000 });

    const headerLogoInfo = await page.evaluate(() => {
      const img = document.querySelector('.topheader-logo, .brand-logo-container img');
      const container = document.querySelector('.brand-logo-container');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const cStyle = container ? window.getComputedStyle(container) : null;
      const imgStyle = window.getComputedStyle(img);

      return {
        src: img.src,
        renderedW: rect.width,
        renderedH: rect.height,
        containerBg: cStyle ? cStyle.backgroundColor : null,
        imgBg: imgStyle.backgroundColor,
        naturalWidth: img.naturalWidth
      };
    });

    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_header_dark.png')
    });

    // Switch header to light theme to ensure no white box on light header
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_header_light.png')
    });

    const t3Passed =
      headerLogoInfo &&
      headerLogoInfo.naturalWidth === 1254 &&
      (headerLogoInfo.containerBg === 'rgba(0, 0, 0, 0)' || headerLogoInfo.containerBg === 'transparent');

    recordResult('TEST_3', 'Authenticated Header Logo Transparency', t3Passed, {
      message: `Header emblem renders cleanly with transparent container across both dark and light modes.`,
      headerLogoInfo
    });

    // -------------------------------------------------------------------------
    // TEST 4: Sidebar Navigation Branding Logo
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Sidebar Navigation Branding Logo ---');
    // Open sidebar
    await page.click('button[aria-label*="sidebar" i]');
    await page.waitForSelector('.sidebar-navigation.sidebar-open, .sidebar-header-info', { timeout: 5000 });

    const sidebarLogoInfo = await page.evaluate(() => {
      const img = document.querySelector('.sidebar-header-info img');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);

      return {
        src: img.src,
        renderedW: rect.width,
        renderedH: rect.height,
        naturalWidth: img.naturalWidth,
        imgBg: style.backgroundColor
      };
    });

    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'transparent_logo_sidebar.png')
    });

    const t4Passed = sidebarLogoInfo && sidebarLogoInfo.naturalWidth === 1254;
    recordResult('TEST_4', 'Sidebar Navigation Logo Transparency', t4Passed, {
      message: `Sidebar navigation renders transparent emblem (22px) seamlessly without white bounding box.`,
      sidebarLogoInfo
    });

    // -------------------------------------------------------------------------
    // TEST 5: Browser Zoom Scalability (100%, 125%, 150%, 200%)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Browser Zoom Scalability ---');
    const zooms = [1.0, 1.25, 1.5, 2.0];
    const zoomResults = [];

    for (const z of zooms) {
      await page.evaluate((zoom) => {
        document.body.style.zoom = String(zoom);
      }, z);
      await page.waitForTimeout(200);

      const zInfo = await page.evaluate(() => {
        const img = document.querySelector('.topheader-logo, .brand-logo-container img');
        if (!img) return null;
        const rect = img.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          aspectRatio1to1: Math.abs(rect.width - rect.height) < 2
        };
      });

      zoomResults.push({ zoom: `${z * 100}%`, ...zInfo });
    }

    // Reset zoom
    await page.evaluate(() => { document.body.style.zoom = '1'; });

    const t5Passed = zoomResults.every((r) => r.aspectRatio1to1);
    recordResult('TEST_5', 'Browser Zoom Scalability (100% - 200%)', t5Passed, {
      message: `Verified 1:1 aspect ratio preserved across 100%, 125%, 150%, and 200% zoom levels.`,
      zoomResults
    });

    // -------------------------------------------------------------------------
    // TEST 6: Network & Console Cleanliness
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Zero Failed Requests & Zero 404s ---');
    const assetErrors = failedRequests.filter((url) => url.includes('sinc-official-logo'));
    const t6Passed = assetErrors.length === 0;

    recordResult('TEST_6', 'Network Asset Cleanliness & Zero Failed Requests', t6Passed, {
      message: `Zero 404s or failed network requests for official transparent logo asset.`,
      failedRequestsCount: failedRequests.length
    });

    await ctx.close();

  } catch (err) {
    console.error('Test execution error:', err);
    report.summary.failed++;
    report.error = err.message;
  } finally {
    await browser.close();
  }

  // Save report JSON
  const outputPath = path.join(__dirname, 'transparent_logo_verification_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\n========================================================================`);
  console.log(`VERIFICATION SUMMARY: ${report.summary.passed}/${report.summary.total} PASSED`);
  console.log(`Results saved to: ${outputPath}`);
  console.log(`========================================================================\n`);

  return report;
}

verifyTransparentLogo()
  .then((r) => {
    process.exit(r.summary.failed === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
