const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runSidebarBottomNavVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — SIDEBAR & BOTTOM NAV MUTUAL EXCLUSIVITY VERIFICATION');
  console.log('========================================================================');

  const browser = await chromium.launch({ headless: true });
  const report = {
    stateA_sidebarOpen: {},
    stateB_sidebarCollapsed: {},
    stateC_toggleTransitions: {},
    stateD_routesAndHistory: {},
    viewports: {},
    zoomLevels: {},
    messagingPreservation: {},
    accessibilityAndMotion: {},
    consoleErrors: []
  };

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text());
      console.log('[BROWSER CONSOLE ERROR]', msg.text());
    }
  });

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Helper function to inspect navigation elements
  const getNavState = async (desc) => {
    return await page.evaluate((description) => {
      const sidebar = document.querySelector('.sidebar-navigation');
      const bottomNav = document.querySelector('.bottom-nav-container');
      const scrollArea = document.querySelector('.sinc-viewport-scroll-area');
      const mainViewport = document.querySelector('.sinc-main-viewport');
      const backdrop = document.querySelector('.sidebar-backdrop');
      const bottomNavButtons = document.querySelectorAll('.bottom-nav button.nav-item');
      const sidebarButtons = document.querySelectorAll('.sidebar-navigation button, .sidebar-navigation [role="button"]');

      const sRect = sidebar ? sidebar.getBoundingClientRect() : null;
      const bRect = bottomNav ? bottomNav.getBoundingClientRect() : null;
      const sStyle = sidebar ? window.getComputedStyle(sidebar) : null;
      const bStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;
      const scrollStyle = scrollArea ? window.getComputedStyle(scrollArea) : null;

      const isSidebarExpanded = Boolean(
        sidebar &&
        !sidebar.classList.contains('sidebar-collapsed') &&
        sRect &&
        sRect.width > 50 &&
        sStyle &&
        sStyle.visibility !== 'hidden'
      );

      const isBottomNavVisible = Boolean(
        bottomNav &&
        !bottomNav.classList.contains('bottom-nav-hidden') &&
        bStyle &&
        bStyle.visibility !== 'hidden' &&
        parseFloat(bStyle.opacity) > 0.5
      );

      return {
        description,
        url: window.location.pathname,
        isSidebarExpanded,
        sidebarWidth: sRect ? Math.round(sRect.width) : 0,
        sidebarVisibility: sStyle ? sStyle.visibility : null,
        sidebarOpacity: sStyle ? sStyle.opacity : null,
        isBottomNavVisible,
        bottomNavVisibility: bStyle ? bStyle.visibility : null,
        bottomNavOpacity: bStyle ? bStyle.opacity : null,
        bottomNavHiddenClass: bottomNav ? bottomNav.classList.contains('bottom-nav-hidden') : false,
        paddingBottom: scrollStyle ? scrollStyle.paddingBottom : null,
        mainViewportClasses: mainViewport ? mainViewport.className : '',
        backdropVisible: backdrop ? window.getComputedStyle(backdrop).visibility === 'visible' && parseFloat(window.getComputedStyle(backdrop).opacity) > 0.5 : false,
        bottomNavButtonsDisabled: Array.from(bottomNavButtons).map(b => b.disabled),
        bottomNavButtonsTabIndex: Array.from(bottomNavButtons).map(b => b.tabIndex)
      };
    }, desc);
  };

  // 1. Login
  console.log('\n[1/7] Logging in with test account A...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input#email', { timeout: 10000 });
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // 2. STATE A — Left Sidebar OPEN on Home Feed
  console.log('\n[2/7] Testing STATE A — Left sidebar OPEN (Desktop)...');
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(500);

  // Ensure sidebar is open on desktop
  const initialNav = await getNavState('Initial Home');
  if (!initialNav.isSidebarExpanded) {
    const toggleBtn = page.locator('.sidebar-toggle-btn');
    await toggleBtn.click();
    await page.waitForTimeout(400);
  }

  const stateA = await getNavState('Home - Sidebar OPEN');
  report.stateA_sidebarOpen = stateA;
  console.log('State A (Sidebar OPEN):', JSON.stringify(stateA, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'master_state_a_sidebar_open.png') });
  console.log('✓ Captured master_state_a_sidebar_open.png');

  // Verify mutually exclusive: sidebar OPEN => bottom nav HIDDEN
  console.log(`Verify: Sidebar expanded=${stateA.isSidebarExpanded}, Bottom nav visible=${stateA.isBottomNavVisible} (Expected: true, false)`);

  // 3. STATE B — Left Sidebar COLLAPSED on Home Feed
  console.log('\n[3/7] Testing STATE B — Left sidebar COLLAPSED / CLOSED (Desktop)...');
  // Click collapse button in header or sidebar
  const collapseBtn = page.locator('.sidebar-collapse-btn');
  if (await collapseBtn.isVisible({ timeout: 1000 })) {
    await collapseBtn.click();
  } else {
    await page.locator('.sidebar-toggle-btn').click();
  }
  await page.waitForTimeout(400);

  const stateB = await getNavState('Home - Sidebar COLLAPSED');
  report.stateB_sidebarCollapsed = stateB;
  console.log('State B (Sidebar COLLAPSED):', JSON.stringify(stateB, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'master_state_b_sidebar_collapsed.png') });
  console.log('✓ Captured master_state_b_sidebar_collapsed.png');

  // Verify mutually exclusive: sidebar COLLAPSED => bottom nav VISIBLE
  console.log(`Verify: Sidebar expanded=${stateB.isSidebarExpanded}, Bottom nav visible=${stateB.isBottomNavVisible} (Expected: false, true)`);

  // 4. STATE C — Toggle Transitions
  console.log('\n[4/7] Testing STATE C — Seamless Transition & Coordination...');
  const tToggleStart = Date.now();
  await page.locator('.sidebar-toggle-btn').click(); // Expand
  await page.waitForTimeout(300);
  const afterExpand = await getNavState('Toggle: Expanded');

  await page.locator('.sidebar-toggle-btn').click(); // Collapse
  await page.waitForTimeout(300);
  const afterCollapse = await getNavState('Toggle: Collapsed');
  const tToggleEnd = Date.now();

  report.stateC_toggleTransitions = {
    afterExpand,
    afterCollapse,
    cycleDurationMs: tToggleEnd - tToggleStart
  };
  console.log('State C Results:', JSON.stringify(report.stateC_toggleTransitions, null, 2));

  // 5. STATE D — Route changes and Browser Navigation
  console.log('\n[5/7] Testing STATE D — Route Navigation & History across non-messaging pages...');
  const routesToTest = [
    { name: 'domains', path: '/domains' },
    { name: 'search', path: '/search' },
    { name: 'saved', path: '/saved' },
    { name: 'profile', path: '/profile' },
    { name: 'settings', path: '/settings' },
    { name: 'home', path: '/' }
  ];

  const routeResults = {};
  for (const r of routesToTest) {
    console.log(`Navigating to ${r.name} (${r.path})...`);
    // Navigate via bottom nav when collapsed
    const tabSelector = `.bottom-nav button.nav-item[aria-label*="${r.name.charAt(0).toUpperCase() + r.name.slice(1)}"]`;
    const tabBtn = page.locator(tabSelector);
    if (await tabBtn.isVisible({ timeout: 1000 })) {
      await tabBtn.click();
    } else {
      await page.goto(`http://localhost:3000${r.path}`);
    }
    await page.waitForTimeout(400);

    // Check with sidebar collapsed
    const collapsedCheck = await getNavState(`${r.name} (Sidebar collapsed)`);

    // Now expand sidebar on this route
    await page.locator('.sidebar-toggle-btn').click();
    await page.waitForTimeout(350);
    const expandedCheck = await getNavState(`${r.name} (Sidebar expanded)`);

    // Collapse sidebar again
    await page.locator('.sidebar-toggle-btn').click();
    await page.waitForTimeout(350);

    routeResults[r.name] = {
      collapsedCheck: {
        bottomNavVisible: collapsedCheck.isBottomNavVisible,
        sidebarExpanded: collapsedCheck.isSidebarExpanded
      },
      expandedCheck: {
        bottomNavVisible: expandedCheck.isBottomNavVisible,
        sidebarExpanded: expandedCheck.isSidebarExpanded
      }
    };
    await page.screenshot({ path: path.join(screenshotsDir, `master_route_${r.name}.png`) });
  }
  report.stateD_routesAndHistory.routes = routeResults;

  // Browser back and forward test
  console.log('Testing browser back and forward navigation...');
  await page.goBack();
  await page.waitForTimeout(400);
  report.stateD_routesAndHistory.historyBack = await getNavState('History Back');

  await page.goForward();
  await page.waitForTimeout(400);
  report.stateD_routesAndHistory.historyForward = await getNavState('History Forward');

  // Direct URL reload
  console.log('Testing direct URL refresh...');
  await page.goto('http://localhost:3000/search');
  await page.reload();
  await page.waitForTimeout(500);
  report.stateD_routesAndHistory.directReload = await getNavState('Direct Reload on Search');

  // 6. Viewports (Desktop, Tablet, Mobile)
  console.log('\n[6/7] Testing Viewports across Desktop, Tablet, and Mobile...');
  const viewports = [
    { width: 1366, height: 768, name: '1366x768' },
    { width: 1024, height: 768, name: '1024x768' },
    { width: 768, height: 900, name: '768x900' },
    { width: 600, height: 800, name: '600x800' },
    { width: 400, height: 800, name: '400x800' }
  ];

  for (const vp of viewports) {
    console.log(`\nTesting Viewport ${vp.name}...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);

    // Initial state in this viewport
    const vpInitial = await getNavState(`${vp.name} initial`);

    // Toggle sidebar
    const toggleBtn = page.locator('.sidebar-toggle-btn').first();
    await toggleBtn.click({ force: true });
    await page.waitForTimeout(400);
    const vpToggled = await getNavState(`${vp.name} toggled`);

    // Reset toggle back
    if (vp.width <= 768) {
      // Mobile drawer close via backdrop or collapse btn
      const backdrop = page.locator('.sidebar-backdrop');
      if (await backdrop.isVisible({ timeout: 500 })) {
        await backdrop.click({ force: true });
      } else {
        await page.locator('.sidebar-collapse-btn').first().click({ force: true });
      }
    } else {
      await toggleBtn.click({ force: true });
    }
    await page.waitForTimeout(400);

    report.viewports[vp.name] = {
      initial: vpInitial,
      toggled: vpToggled
    };
    await page.screenshot({ path: path.join(screenshotsDir, `master_viewport_${vp.name}.png`) });
    console.log(`Viewport ${vp.name} verified.`);
  }

  // 7. Verify Messaging Preservation (Scope Rule)
  console.log('\n[7/7] Verifying Messaging Preservation (Absolute Scope Rule)...');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:3000/messages');
  await page.waitForTimeout(500);

  const convListState = await getNavState('Messages List');

  // Open active direct chat
  const firstConv = page.locator('.conv-row-item').first();
  await firstConv.waitFor({ state: 'visible', timeout: 8000 });
  await firstConv.click();
  await page.waitForSelector('.active-chat-container', { timeout: 8000 });
  await page.waitForTimeout(400);

  const activeChatNavState = await page.evaluate(() => {
    const bottomNav = document.querySelector('.bottom-nav-container');
    const composer = document.querySelector('.active-chat-composer');
    const sendBtn = document.querySelector('.chat-send-btn');
    const input = document.querySelector('.chat-composer-input');

    const bStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;
    const cRect = composer ? composer.getBoundingClientRect() : null;

    return {
      bottomNavHidden: bottomNav ? bottomNav.classList.contains('bottom-nav-hidden') : false,
      bottomNavVisibility: bStyle ? bStyle.visibility : null,
      bottomNavOpacity: bStyle ? bStyle.opacity : null,
      composerVisible: Boolean(cRect && cRect.height > 0),
      sendBtnVisible: Boolean(sendBtn && sendBtn.getBoundingClientRect().width > 0),
      inputSendAligned: Boolean(composer && sendBtn && input && Math.abs(input.getBoundingClientRect().top - sendBtn.getBoundingClientRect().top) < 10)
    };
  });

  report.messagingPreservation = {
    convListState,
    activeChatNavState,
    isMessagingPreserved: activeChatNavState.bottomNavHidden && activeChatNavState.composerVisible && activeChatNavState.sendBtnVisible
  };
  console.log('Messaging Preservation Check:', JSON.stringify(report.messagingPreservation, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'master_messaging_preserved.png') });

  // Close browser and save report
  await browser.close();

  console.log('\n========================================================================');
  console.log('FINAL VERIFICATION REPORT:');
  console.log(JSON.stringify(report, null, 2));
  console.log('========================================================================');

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'reports', 'master_sidebar_bottom_nav_report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('✓ Saved report to reports/master_sidebar_bottom_nav_report.json');
}

runSidebarBottomNavVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
