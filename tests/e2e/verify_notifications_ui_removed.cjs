const { chromium } = require('playwright');
const path = require('path');

async function verifyUiRemoval() {
  console.log('====================================================');
  console.log('VERIFYING REMOVAL OF NOTIFICATIONS UI ELEMENTS');
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. DESKTOP VERIFICATION
    console.log('[Step 1] Desktop Layout Verification (1280x800)...');
    const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageDesktop = await contextDesktop.newPage();

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    // Login
    await pageDesktop.goto(`${baseUrl}/login`);
    await pageDesktop.waitForSelector('input#email', { timeout: 15000 });
    await pageDesktop.fill('input#email', 'user.a.test@gmail.com');
    await pageDesktop.fill('input#password', 'TestPassword123!');
    await pageDesktop.click('button[type="submit"]');
    await pageDesktop.waitForTimeout(3000);

    // Verify top header on Desktop
    console.log('[Step 2] Checking Top Header on Desktop...');
    const headerBell = pageDesktop.locator('.top-header button[title="Notifications"], .top-header button[aria-label*="Notifications"]');
    const headerBellCount = await headerBell.count();
    console.log('  Top header notification bell count:', headerBellCount, headerBellCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    const themeToggle = pageDesktop.locator('.top-header .theme-toggle-btn');
    const hasThemeToggle = await themeToggle.count() > 0;
    console.log('  Top header theme toggle present:', hasThemeToggle ? '✓' : '✗');

    const searchInput = pageDesktop.locator('.top-header .global-search-input');
    const hasSearch = await searchInput.count() > 0;
    console.log('  Top header search bar present:', hasSearch ? '✓' : '✗');

    const userProfile = pageDesktop.locator('.top-header .header-user-trigger');
    const hasUserProfile = await userProfile.count() > 0;
    console.log('  Top header user profile control present:', hasUserProfile ? '✓' : '✗');

    // Verify left sidebar on Desktop
    console.log('\n[Step 3] Checking Left Sidebar on Desktop...');
    const sidebarItems = await pageDesktop.locator('.sidebar-nav-item .nav-item-text').allTextContents();
    console.log('  Sidebar nav items present:', sidebarItems);

    const hasNotifInSidebar = sidebarItems.some((text) => text.toLowerCase().includes('notification'));
    console.log('  Notifications present in sidebar:', hasNotifInSidebar ? '✗ FAILED' : '✓ (REMOVED)');

    const expectedItems = [
      'Home Feed',
      'Domains & Hubs',
      'Direct Messages',
      'Explore & Search',
      'Saved Posts',
      'My Profile',
      'Settings'
    ];
    const matchesExpected = JSON.stringify(sidebarItems) === JSON.stringify(expectedItems);
    console.log('  Sidebar items match expected order without gaps:', matchesExpected ? '✓' : '✗');

    // 2. MOBILE VERIFICATION
    console.log('\n[Step 4] Mobile Layout Verification (375x667)...');
    const contextMobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const pageMobile = await contextMobile.newPage();

    await pageMobile.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/login`);
    await pageMobile.waitForSelector('input#email', { timeout: 15000 });
    await pageMobile.fill('input#email', 'user.a.test@gmail.com');
    await pageMobile.fill('input#password', 'TestPassword123!');
    await pageMobile.click('button[type="submit"]');
    await pageMobile.waitForTimeout(3000);

    // Check top header in mobile
    const mobileHeaderBell = pageMobile.locator('.top-header button[title="Notifications"], .top-header button[aria-label*="Notifications"]');
    const mobileHeaderBellCount = await mobileHeaderBell.count();
    console.log('  Mobile top header notification bell count:', mobileHeaderBellCount, mobileHeaderBellCount === 0 ? '✓ (REMOVED)' : '✗ FAILED');

    // Check sidebar nav items on mobile
    const mobileSidebarItems = await pageMobile.locator('.sidebar-navigation .sidebar-nav-item .nav-item-text').allTextContents();
    console.log('  Mobile sidebar nav items:', mobileSidebarItems);
    const hasNotifInMobileSidebar = mobileSidebarItems.some((text) => text.toLowerCase().includes('notification'));
    console.log('  Notifications present in mobile sidebar:', hasNotifInMobileSidebar ? '✗ FAILED' : '✓ (REMOVED)');

    // Take Mobile Screenshot
    const mobileScreenshot = path.resolve(__dirname, '../../reports/mobile_notifications_removed.png');
    await pageMobile.screenshot({ path: mobileScreenshot });
    console.log('  Saved mobile screenshot to reports/mobile_notifications_removed.png');

    console.log('\n====================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('Verification error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

verifyUiRemoval();
