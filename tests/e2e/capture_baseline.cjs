const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureBaseline() {
  const outDir = path.resolve(__dirname, '../../reports/visual_baseline');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  console.log('[BASELINE] Capturing pre-migration baseline screenshots from http://localhost:3000...');

  // 1. Desktop Context
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const dPage = await desktop.newPage();

  // Login
  await dPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await dPage.waitForSelector('#email');
  await dPage.screenshot({ path: path.join(outDir, '01_login_desktop_1366.png') });
  console.log('✓ Captured 01_login_desktop_1366.png');

  // Sign Up
  const signUpLink = dPage.locator('button:has-text("Sign Up")').first();
  if (await signUpLink.isVisible()) {
    await signUpLink.click();
    await dPage.waitForTimeout(300);
    await dPage.screenshot({ path: path.join(outDir, '02_signup_desktop_1366.png') });
    console.log('✓ Captured 02_signup_desktop_1366.png');
  }

  // Tablet Context (Login)
  const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tPage = await tablet.newPage();
  await tPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await tPage.waitForSelector('#email');
  await tPage.screenshot({ path: path.join(outDir, '03_login_tablet_768.png') });
  console.log('✓ Captured 03_login_tablet_768.png');

  // Mobile Context (Login)
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mPage = await mobile.newPage();
  await mPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await mPage.waitForSelector('#email');
  await mPage.screenshot({ path: path.join(outDir, '04_login_mobile_375.png') });
  console.log('✓ Captured 04_login_mobile_375.png');

  // Login Desktop and capture authenticated views
  await dPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await dPage.fill('#email', 'user.a.test@gmail.com');
  await dPage.fill('#password', 'TestPassword123!');
  await dPage.click('button[type="submit"]');

  // Wait for Skip button or app shell
  try {
    const skipBtn = dPage.locator('button:has-text("Skip")').first();
    await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipBtn.click();
  } catch (_) {}

  await dPage.waitForSelector('.sinc-app-shell', { timeout: 10000 });
  await dPage.waitForTimeout(1000);
  await dPage.screenshot({ path: path.join(outDir, '05_feed_desktop_1366.png') });
  console.log('✓ Captured 05_feed_desktop_1366.png');

  // Search
  await dPage.evaluate(() => { window.location.hash = '#search'; });
  await dPage.waitForTimeout(800);
  await dPage.screenshot({ path: path.join(outDir, '06_search_desktop_1366.png') });
  console.log('✓ Captured 06_search_desktop_1366.png');

  // Domains
  await dPage.evaluate(() => { window.location.hash = '#domains'; });
  await dPage.waitForTimeout(800);
  await dPage.screenshot({ path: path.join(outDir, '07_domains_desktop_1366.png') });
  console.log('✓ Captured 07_domains_desktop_1366.png');

  // Messages
  await dPage.evaluate(() => { window.location.hash = '#messages'; });
  await dPage.waitForTimeout(800);
  await dPage.screenshot({ path: path.join(outDir, '08_messages_desktop_1366.png') });
  console.log('✓ Captured 08_messages_desktop_1366.png');

  // Profile
  await dPage.evaluate(() => { window.location.hash = '#profile'; });
  await dPage.waitForTimeout(800);
  await dPage.screenshot({ path: path.join(outDir, '09_profile_desktop_1366.png') });
  console.log('✓ Captured 09_profile_desktop_1366.png');

  // Settings
  await dPage.evaluate(() => { window.location.hash = '#settings'; });
  await dPage.waitForTimeout(800);
  await dPage.screenshot({ path: path.join(outDir, '10_settings_desktop_1366.png') });
  console.log('✓ Captured 10_settings_desktop_1366.png');

  await browser.close();
  console.log('[BASELINE] All baseline screenshots saved to reports/visual_baseline/');
}

captureBaseline().catch((err) => {
  console.error('[BASELINE ERROR]', err);
  process.exit(1);
});
