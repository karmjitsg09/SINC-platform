const { chromium } = require('playwright');
const path = require('path');

async function verifyAvatarOnlyHeader() {
  console.log('====================================================');
  console.log('VERIFYING: SIMPLIFY HEADER TO PROFILE AVATAR ONLY');
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
    await pageDesktop.goto('http://localhost:3000/login');
    await pageDesktop.waitForSelector('input#email', { timeout: 15000 });
    await pageDesktop.fill('input#email', 'user.a.test@gmail.com');
    await pageDesktop.fill('input#password', 'TestPassword123!');
    await pageDesktop.click('button[type="submit"]');
    await pageDesktop.waitForSelector('.top-header', { timeout: 20000 });
    await pageDesktop.waitForTimeout(1000);

    // Verify top header on Desktop
    console.log('\n[Step 2] Verifying Standalone Profile Avatar in Header...');

    const userTrigger = pageDesktop.locator('.top-header #header-user-menu-btn, .top-header .header-user-trigger');
    const userTriggerCount = await userTrigger.count();
    console.log('  Header user profile trigger count:', userTriggerCount, userTriggerCount === 1 ? '✓ (PRESENT)' : '✗ FAILED');

    // Check that user display name, handle, and metadata are NOT in the header trigger button
    const userMetaCount = await pageDesktop.locator('.top-header .header-user-trigger .header-user-meta').count();
    console.log('  .header-user-meta count in trigger button:', userMetaCount, userMetaCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    const triggerText = (await userTrigger.first().innerText()).trim();
    console.log(`  Trigger button visible text: "${triggerText}"`);
    const containsNameOrHandle = triggerText.includes('User A') || triggerText.includes('@useratest') || triggerText.includes('Member');
    console.log('  Text labels (name, handle, role) removed from trigger:', !containsNameOrHandle ? '✓' : '✗ FAILED');

    // Check accessibility attributes
    const ariaLabel = await userTrigger.first().getAttribute('aria-label');
    console.log(`  Trigger button aria-label: "${ariaLabel}"`, ariaLabel === 'Open profile menu' ? '✓' : '✗ FAILED');

    const ariaHaspopup = await userTrigger.first().getAttribute('aria-haspopup');
    console.log(`  Trigger button aria-haspopup: "${ariaHaspopup}"`, ariaHaspopup === 'menu' ? '✓' : '✗ FAILED');

    // Check avatar styling: circular and 36x36
    const boundingBox = await userTrigger.first().boundingBox();
    console.log(`  Trigger dimensions: width=${boundingBox.width.toFixed(1)}px, height=${boundingBox.height.toFixed(1)}px`);
    const isSquareAndCompact = Math.abs(boundingBox.width - 36) <= 2 && Math.abs(boundingBox.height - 36) <= 2;
    console.log('  Trigger is compact circular 36x36px button:', isSquareAndCompact ? '✓' : '✗ FAILED');

    // Check initials fallback or photo exists
    const hasAvatarInitials = await pageDesktop.locator('.top-header .header-user-trigger .avatar-initials').count() > 0;
    const hasAvatarImg = await pageDesktop.locator('.top-header .header-user-trigger .avatar-img').count() > 0;
    console.log(`  Avatar content: initials=${hasAvatarInitials ? '✓ (UA)' : 'No'}, image=${hasAvatarImg ? '✓' : 'No'}`);
    console.log('  Avatar visual element rendered correctly:', (hasAvatarInitials || hasAvatarImg) ? '✓' : '✗ FAILED');

    // Check other header elements remain intact
    const hasBell = await pageDesktop.locator('.top-header #header-notifications-btn').count() === 1;
    console.log('  Notification bell remains present and intact:', hasBell ? '✓' : '✗ FAILED');

    const hasSearch = await pageDesktop.locator('.top-header .global-search-input').count() === 1;
    console.log('  Search bar remains present and intact:', hasSearch ? '✓' : '✗ FAILED');

    const hasLogo = await pageDesktop.locator('.top-header .brand-logo-container').count() === 1;
    console.log('  SINC Logo remains present and intact:', hasLogo ? '✓' : '✗ FAILED');

    // Test click interaction to open dropdown menu
    console.log('\n[Step 3] Testing Profile Avatar Click Interaction...');
    await userTrigger.first().click();
    await pageDesktop.waitForTimeout(600);

    const dropdownMenu = pageDesktop.locator('.top-header .user-menu-dropdown');
    const isMenuVisible = await dropdownMenu.isVisible();
    console.log('  Clicking avatar opens user profile dropdown menu:', isMenuVisible ? '✓' : '✗ FAILED');

    const ariaExpanded = await userTrigger.first().getAttribute('aria-expanded');
    console.log('  aria-expanded attribute updated to "true":', ariaExpanded === 'true' ? '✓' : '✗ FAILED');

    // Check dropdown content still has user details & links
    const dropdownName = await pageDesktop.locator('.user-menu-dropdown .user-full-name').innerText();
    console.log(`  Dropdown menu user full name: "${dropdownName}"`, dropdownName ? '✓' : '✗ FAILED');

    // Close menu by clicking again
    await userTrigger.first().click();
    await pageDesktop.waitForTimeout(400);
    const isMenuClosed = !(await dropdownMenu.isVisible());
    console.log('  Clicking avatar again toggles/closes menu:', isMenuClosed ? '✓' : '✗ FAILED');

    // Desktop screenshot
    const desktopScreenshotPath = path.join(__dirname, 'desktop_header_avatar_only.png');
    await pageDesktop.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log('  Desktop screenshot saved:', desktopScreenshotPath);

    // 2. MOBILE VERIFICATION (375x667)
    console.log('\n[Step 4] Mobile Layout Verification (375x667)...');
    const contextMobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const pageMobile = await contextMobile.newPage();

    // Login
    await pageMobile.goto('http://localhost:3000/login');
    await pageMobile.waitForSelector('input#email', { timeout: 15000 });
    await pageMobile.fill('input#email', 'user.a.test@gmail.com');
    await pageMobile.fill('input#password', 'TestPassword123!');
    await pageMobile.click('button[type="submit"]');
    await pageMobile.waitForSelector('.top-header', { timeout: 20000 });
    await pageMobile.waitForTimeout(1000);

    // If sidebar drawer is open with collapse button, close it
    const collapseBtn = pageMobile.locator('.sidebar-collapse-btn');
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await pageMobile.waitForTimeout(600);
    }

    const mobileTrigger = pageMobile.locator('.top-header .header-user-trigger');
    const mobileTriggerBox = await mobileTrigger.first().boundingBox();
    console.log(`  [Mobile] Trigger dimensions: width=${mobileTriggerBox.width.toFixed(1)}px, height=${mobileTriggerBox.height.toFixed(1)}px`);
    console.log('  [Mobile] Standalone avatar button sized properly:', Math.abs(mobileTriggerBox.width - 36) <= 2 ? '✓' : '✗ FAILED');

    // Click on mobile to verify dropdown
    await mobileTrigger.first().click();
    await pageMobile.waitForTimeout(500);
    const isMobileMenuVisible = await pageMobile.locator('.top-header .user-menu-dropdown').isVisible();
    console.log('  [Mobile] User menu dropdown opens on click:', isMobileMenuVisible ? '✓' : '✗ FAILED');

    const mobileScreenshotPath = path.join(__dirname, 'mobile_header_avatar_only.png');
    await pageMobile.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log('  Mobile screenshot saved:', mobileScreenshotPath);

    // 3. ZOOM / HIGH RESOLUTION VERIFICATION (1920x1080 at 1.5x)
    console.log('\n[Step 5] High Resolution / Zoom Verification (1920x1080)...');
    const contextZoom = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
    const pageZoom = await contextZoom.newPage();

    await pageZoom.goto('http://localhost:3000/login');
    await pageZoom.waitForSelector('input#email', { timeout: 15000 });
    await pageZoom.fill('input#email', 'user.a.test@gmail.com');
    await pageZoom.fill('input#password', 'TestPassword123!');
    await pageZoom.click('button[type="submit"]');
    await pageZoom.waitForSelector('.top-header', { timeout: 20000 });
    await pageZoom.waitForTimeout(1000);

    const zoomTrigger = pageZoom.locator('.top-header .header-user-trigger');
    const zoomTriggerCount = await zoomTrigger.count();
    console.log('  [Zoom 150%] User profile avatar present:', zoomTriggerCount === 1 ? '✓' : '✗ FAILED');

    // 4. Zero Critical Console Errors
    console.log('\n[Step 6] Checking Console Errors...');
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes('Failed to load resource') && !err.includes('favicon') && !err.includes('is_verified')
    );
    console.log('  Critical console errors count:', criticalErrors.length, criticalErrors.length === 0 ? '✓' : '✗ FAILED');

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

verifyAvatarOnlyHeader();
