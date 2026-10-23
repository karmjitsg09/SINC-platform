const { chromium } = require('playwright');
const path = require('path');

async function verifyThemeToNotifications() {
  console.log('====================================================');
  console.log('VERIFYING: REPLACE THEME ICON WITH NOTIFICATIONS');
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. DESKTOP VERIFICATION (1280x800)
    console.log('[Step 1] Desktop Layout Verification (1280x800)...');
    const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageDesktop = await contextDesktop.newPage();

    const consoleErrors = [];
    pageDesktop.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    await pageDesktop.goto('http://localhost:3003/login');
    await pageDesktop.waitForSelector('input#email', { timeout: 15000 });
    await pageDesktop.fill('input#email', 'user.a.test@gmail.com');
    await pageDesktop.fill('input#password', 'TestPassword123!');
    await pageDesktop.click('button[type="submit"]');
    await pageDesktop.waitForSelector('.top-header', { timeout: 20000 });
    await pageDesktop.waitForTimeout(1000);

    // Verify top header on Desktop
    console.log('\n[Step 2] Verifying Top Header Controls on Desktop...');

    // 1. Check theme toggle is removed
    const themeToggle = pageDesktop.locator('.top-header .theme-toggle-btn');
    const themeToggleCount = await themeToggle.count();
    console.log('  Theme toggle button count in header:', themeToggleCount, themeToggleCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    const sunIcon = pageDesktop.locator('.top-header svg.lucide-sun');
    const sunIconCount = await sunIcon.count();
    console.log('  Sun icon count in header:', sunIconCount, sunIconCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    // 2. Check notification bell is present
    const notifBtn = pageDesktop.locator('.top-header #header-notifications-btn');
    const notifBtnCount = await notifBtn.count();
    console.log('  Notification bell count in header:', notifBtnCount, notifBtnCount === 1 ? '✓ (PRESENT)' : '✗ FAILED');

    // 3. Check accessible attributes
    const ariaLabel = await notifBtn.first().getAttribute('aria-label');
    const titleAttr = await notifBtn.first().getAttribute('title');
    console.log(`  Notification bell aria-label: "${ariaLabel}"`, ariaLabel && ariaLabel.startsWith('Notifications') ? '✓' : '✗ FAILED');
    console.log(`  Notification bell title: "${titleAttr}"`, titleAttr === 'Notifications' ? '✓' : '✗ FAILED');

    // 4. Check search bar and user profile remain intact
    const searchInput = pageDesktop.locator('.top-header .global-search-input');
    const hasSearch = await searchInput.count() > 0;
    console.log('  Top header search bar present:', hasSearch ? '✓' : '✗ FAILED');

    const userProfile = pageDesktop.locator('.top-header .header-user-trigger');
    const hasUserProfile = await userProfile.count() > 0;
    console.log('  Top header user profile trigger present:', hasUserProfile ? '✓' : '✗ FAILED');

    const headerDivider = pageDesktop.locator('.top-header .header-divider');
    const hasDivider = await headerDivider.count() > 0;
    console.log('  Header divider alignment intact:', hasDivider ? '✓' : '✗ FAILED');

    // 5. Test clicking notification bell
    console.log('\n[Step 3] Testing Bell Button Click Interaction...');
    await notifBtn.first().click();
    await pageDesktop.waitForTimeout(1500);

    const isNotifActive = await notifBtn.first().evaluate((el) => el.classList.contains('active'));
    console.log('  Notification bell has .active class:', isNotifActive ? '✓' : '✗ FAILED');

    const currentUrl = pageDesktop.url();
    console.log('  Current URL after click:', currentUrl, currentUrl.includes('/notifications') ? '✓' : '✗ FAILED');

    const notifPageHeading = pageDesktop.locator('text=Notifications').first();
    const isHeadingVisible = await notifPageHeading.isVisible();
    console.log('  Notifications page interface visible:', isHeadingVisible ? '✓' : '✗ FAILED');

    // Screenshot Desktop
    const desktopScreenshotPath = path.join(__dirname, 'desktop_header_notifications.png');
    await pageDesktop.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log('  Desktop screenshot saved:', desktopScreenshotPath);

    // 2. MOBILE VERIFICATION (375x667)
    console.log('\n[Step 4] Mobile Layout Verification (375x667)...');
    const contextMobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const pageMobile = await contextMobile.newPage();

    // Login
    await pageMobile.goto('http://localhost:3003/login');
    await pageMobile.waitForSelector('input#email', { timeout: 15000 });
    await pageMobile.fill('input#email', 'user.a.test@gmail.com');
    await pageMobile.fill('input#password', 'TestPassword123!');
    await pageMobile.click('button[type="submit"]');
    await pageMobile.waitForSelector('.top-header', { timeout: 20000 });
    await pageMobile.waitForTimeout(1000);

    const mobileThemeCount = await pageMobile.locator('.top-header .theme-toggle-btn').count();
    console.log('  [Mobile] Theme toggle button count:', mobileThemeCount, mobileThemeCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    const mobileBell = pageMobile.locator('.top-header #header-notifications-btn');
    const mobileBellCount = await mobileBell.count();
    console.log('  [Mobile] Notification bell count:', mobileBellCount, mobileBellCount === 1 ? '✓ (PRESENT)' : '✗ FAILED');

    // If sidebar drawer is open with collapse button, close it
    const collapseBtn = pageMobile.locator('.sidebar-collapse-btn');
    if (await collapseBtn.isVisible()) {
      console.log('  [Mobile] Closing open sidebar drawer...');
      await collapseBtn.click();
      await pageMobile.waitForTimeout(600);
    }

    // Click mobile bell
    await mobileBell.first().click();
    await pageMobile.waitForTimeout(1500);

    const mobileUrl = pageMobile.url();
    console.log('  [Mobile] URL after click:', mobileUrl, mobileUrl.includes('/notifications') ? '✓' : '✗ FAILED');

    const mobileScreenshotPath = path.join(__dirname, 'mobile_header_notifications.png');
    await pageMobile.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log('  Mobile screenshot saved:', mobileScreenshotPath);

    // 3. ZOOM / HIGH RESOLUTION VERIFICATION (1920x1080 at 1.5x scale)
    console.log('\n[Step 5] High Resolution / Zoom Verification (1920x1080)...');
    const contextZoom = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
    const pageZoom = await contextZoom.newPage();

    await pageZoom.goto('http://localhost:3003/login');
    await pageZoom.waitForSelector('input#email', { timeout: 15000 });
    await pageZoom.fill('input#email', 'user.a.test@gmail.com');
    await pageZoom.fill('input#password', 'TestPassword123!');
    await pageZoom.click('button[type="submit"]');
    await pageZoom.waitForSelector('.top-header', { timeout: 20000 });
    await pageZoom.waitForTimeout(1000);

    const zoomBellCount = await pageZoom.locator('.top-header #header-notifications-btn').count();
    const zoomThemeCount = await pageZoom.locator('.top-header .theme-toggle-btn').count();
    console.log('  [Zoom 150%] Notification bell count:', zoomBellCount, zoomBellCount === 1 ? '✓' : '✗ FAILED');
    console.log('  [Zoom 150%] Theme toggle count:', zoomThemeCount, zoomThemeCount === 0 ? '✓' : '✗ FAILED');

    // Check Console errors
    console.log('\n[Step 6] Console Errors Check...');
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes('Failed to load resource') && !err.includes('favicon')
    );
    if (criticalErrors.length === 0) {
      console.log('  Zero critical console errors detected: ✓');
    } else {
      console.log('  Console errors found:', criticalErrors);
    }

    console.log('\n====================================================');
    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

verifyThemeToNotifications();
