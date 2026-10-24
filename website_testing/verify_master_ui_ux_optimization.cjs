const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — MASTER UI/UX, REAL-TIME & ANIMATION OPTIMIZATION TEST');
  console.log('========================================================================');

  const browser = await chromium.launch({ headless: true });
  const report = {
    stateA_conversationList: {},
    stateB_directChatOpen: {},
    stateC_conversationClosed: {},
    stateD_navigationAndHistory: {},
    messageFlow: {},
    viewports: {},
    zoomLevels: {},
    accessibilityAndMotion: {},
    performanceMetrics: {},
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

  // 1. Initial Login
  console.log('\n[1/8] Logging in with test account A...');
  const tStartLoad = Date.now();
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input#email', { timeout: 10000 });
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  report.performanceMetrics.initialAppLoadMs = Date.now() - tStartLoad;
  console.log(`✓ Logged in. Initial App Load: ${report.performanceMetrics.initialAppLoadMs}ms`);

  // Ensure sidebar drawer is dismissed if open on smaller screens
  const dismissMobileDrawerIfNeeded = async () => {
    try {
      const backdrop = page.locator('.sidebar-backdrop');
      if (await backdrop.isVisible({ timeout: 500 })) {
        await backdrop.click({ force: true });
        await page.waitForTimeout(300);
      }
    } catch (e) {}
  };

  // 2. STATE A: Conversation list with no active chat
  console.log('\n[2/8] Testing STATE A — Messaging landing / conversation list (No conversation open)...');
  const tNavStart = Date.now();
  await page.goto('http://localhost:3000/messages');
  await page.waitForSelector('.messaging-desktop-container', { timeout: 10000 });
  report.performanceMetrics.routeTransitionToMessagesMs = Date.now() - tNavStart;

  const stateAData = await page.evaluate(() => {
    const navContainer = document.querySelector('.bottom-nav-container');
    const scrollArea = document.querySelector('.sinc-viewport-scroll-area');
    const navButtons = document.querySelectorAll('.bottom-nav button.nav-item');
    const activeChat = document.querySelector('.active-chat-container');

    const navStyle = navContainer ? window.getComputedStyle(navContainer) : null;
    const scrollStyle = scrollArea ? window.getComputedStyle(scrollArea) : null;

    return {
      hasBottomNavContainer: Boolean(navContainer),
      isHiddenClassPresent: navContainer ? navContainer.classList.contains('bottom-nav-hidden') : null,
      opacity: navStyle ? navStyle.opacity : null,
      visibility: navStyle ? navStyle.visibility : null,
      pointerEvents: navStyle ? navStyle.pointerEvents : null,
      paddingBottom: scrollStyle ? scrollStyle.paddingBottom : null,
      buttonsCount: navButtons.length,
      buttonsDisabled: Array.from(navButtons).map(b => b.disabled),
      buttonsTabIndex: Array.from(navButtons).map(b => b.tabIndex),
      isChatOpen: Boolean(activeChat)
    };
  });

  report.stateA_conversationList = stateAData;
  console.log('State A Results:', JSON.stringify(stateAData, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'state_a_conversation_list.png') });
  console.log('✓ Captured state_a_conversation_list.png');

  // Find first conversation ID
  const convRow = page.locator('.conv-row-item').first();
  await convRow.waitFor({ state: 'visible', timeout: 8000 });
  const convName = await convRow.locator('.conv-participant-name').innerText().catch(() => 'User');

  // 3. STATE B: Direct conversation is open
  console.log(`\n[3/8] Testing STATE B — Selecting conversation with ${convName}...`);
  const tChatOpenStart = Date.now();
  await convRow.click();
  await page.waitForSelector('.active-chat-container', { timeout: 8000 });
  report.performanceMetrics.chatUsableTimeMs = Date.now() - tChatOpenStart;

  // Allow transition to settle (0.22s)
  await page.waitForTimeout(300);

  const stateBData = await page.evaluate(() => {
    const navContainer = document.querySelector('.bottom-nav-container');
    const scrollArea = document.querySelector('.sinc-viewport-scroll-area');
    const mainViewport = document.querySelector('.sinc-main-viewport');
    const composer = document.querySelector('.active-chat-composer');
    const sendBtn = document.querySelector('.chat-send-btn');
    const input = document.querySelector('.chat-composer-input');
    const navButtons = document.querySelectorAll('.bottom-nav button.nav-item');

    const navStyle = navContainer ? window.getComputedStyle(navContainer) : null;
    const scrollStyle = scrollArea ? window.getComputedStyle(scrollArea) : null;
    const composerRect = composer ? composer.getBoundingClientRect() : null;
    const windowH = window.innerHeight;

    return {
      hasBottomNavContainer: Boolean(navContainer),
      isHiddenClassPresent: navContainer ? navContainer.classList.contains('bottom-nav-hidden') : false,
      opacity: navStyle ? navStyle.opacity : null,
      visibility: navStyle ? navStyle.visibility : null,
      pointerEvents: navStyle ? navStyle.pointerEvents : null,
      paddingBottom: scrollStyle ? scrollStyle.paddingBottom : null,
      mainViewportClasses: mainViewport ? mainViewport.className : '',
      buttonsDisabled: Array.from(navButtons).map(b => b.disabled),
      buttonsTabIndex: Array.from(navButtons).map(b => b.tabIndex),
      composerVisible: Boolean(composer && composerRect && composerRect.height > 0),
      composerBottomDistFromViewportBottom: composerRect ? Math.round(windowH - composerRect.bottom) : null,
      sendButtonAccessible: Boolean(sendBtn && sendBtn.getBoundingClientRect().width > 0),
      inputWidth: input ? Math.round(input.getBoundingClientRect().width) : 0,
      composerRowAligned: Boolean(composer && sendBtn && input && Math.abs(input.getBoundingClientRect().top - sendBtn.getBoundingClientRect().top) < 10)
    };
  });

  report.stateB_directChatOpen = stateBData;
  console.log('State B Results:', JSON.stringify(stateBData, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'state_b_direct_chat_open.png') });
  console.log('✓ Captured state_b_direct_chat_open.png');

  // 4. Send Message & Verify Realtime stream
  console.log('\n[4/8] Testing message flow and delivery...');
  const testMessageText = `Verified UI Optimization Test Message [${Date.now().toString().slice(-4)}]`;
  await page.fill('.chat-composer-input', testMessageText);

  const tSendStart = Date.now();
  await page.click('.chat-send-btn');

  // Wait for message to appear in stream
  await page.waitForFunction((text) => {
    const bubbles = Array.from(document.querySelectorAll('.bubble-text'));
    return bubbles.some(b => b.textContent && b.textContent.includes(text));
  }, testMessageText, { timeout: 8000 });

  report.performanceMetrics.messageSendToRenderMs = Date.now() - tSendStart;
  console.log(`✓ Message sent and rendered. Latency: ${report.performanceMetrics.messageSendToRenderMs}ms`);

  // Check duplicate messages
  const messageOccurrences = await page.evaluate((text) => {
    const bubbles = Array.from(document.querySelectorAll('.bubble-text'));
    return bubbles.filter(b => b.textContent && b.textContent.includes(text)).length;
  }, testMessageText);

  report.messageFlow = {
    testMessageText,
    latencyMs: report.performanceMetrics.messageSendToRenderMs,
    occurrencesCount: messageOccurrences,
    hasDuplicates: messageOccurrences > 1
  };
  console.log(`Duplicate check: ${messageOccurrences} occurrence(s) (hasDuplicates: ${messageOccurrences > 1})`);
  await page.screenshot({ path: path.join(screenshotsDir, 'verified_message_sent_live.png') });

  // 5. STATE C: Closing Conversation
  console.log('\n[5/8] Testing STATE C — Closing conversation via back/close button...');
  const backBtn = page.locator('.mobile-back-to-convs-btn');
  await backBtn.waitFor({ state: 'visible', timeout: 5000 });
  await backBtn.click();
  await page.waitForTimeout(300);

  const stateCData = await page.evaluate(() => {
    const navContainer = document.querySelector('.bottom-nav-container');
    const scrollArea = document.querySelector('.sinc-viewport-scroll-area');
    const navButtons = document.querySelectorAll('.bottom-nav button.nav-item');

    const navStyle = navContainer ? window.getComputedStyle(navContainer) : null;
    const scrollStyle = scrollArea ? window.getComputedStyle(scrollArea) : null;

    return {
      isHiddenClassPresent: navContainer ? navContainer.classList.contains('bottom-nav-hidden') : null,
      opacity: navStyle ? navStyle.opacity : null,
      visibility: navStyle ? navStyle.visibility : null,
      paddingBottom: scrollStyle ? scrollStyle.paddingBottom : null,
      buttonsDisabled: Array.from(navButtons).map(b => b.disabled),
      currentUrl: window.location.pathname
    };
  });

  report.stateC_conversationClosed = stateCData;
  console.log('State C Results:', JSON.stringify(stateCData, null, 2));
  await page.screenshot({ path: path.join(screenshotsDir, 'state_c_conversation_closed.png') });
  console.log('✓ Captured state_c_conversation_closed.png');

  // 6. STATE D: Navigation across routes and Browser Back/Forward
  console.log('\n[6/8] Testing STATE D — Route navigation and browser history...');
  const routesToTest = ['home', 'domains', 'search', 'profile'];
  const routeNavResults = {};

  for (const r of routesToTest) {
    const tabBtn = page.locator(`.bottom-nav button.nav-item[aria-label*="${r.charAt(0).toUpperCase() + r.slice(1)}"]`);
    await tabBtn.click();
    await page.waitForTimeout(300);
    const navState = await page.evaluate(() => {
      const navContainer = document.querySelector('.bottom-nav-container');
      const navStyle = navContainer ? window.getComputedStyle(navContainer) : null;
      return {
        url: window.location.pathname,
        navVisible: navStyle ? navStyle.visibility === 'visible' && parseFloat(navStyle.opacity) > 0.8 : false
      };
    });
    routeNavResults[r] = navState;
  }
  report.stateD_navigationAndHistory.routes = routeNavResults;

  // Direct URL navigation to conversation
  console.log('Testing direct conversation URL reload and browser back/forward...');
  await page.goto('http://localhost:3000/messages');
  await page.waitForTimeout(500);
  const firstConv = page.locator('.conv-row-item').first();
  await firstConv.click();
  await page.waitForTimeout(400);

  const directConvUrl = page.url();
  console.log('Direct conversation URL:', directConvUrl);

  // Reload on direct conversation URL
  await page.reload();
  await page.waitForTimeout(800);
  const directReloadState = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-container');
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    return {
      url: window.location.pathname,
      navHidden: nav ? nav.classList.contains('bottom-nav-hidden') : false,
      visibility: navStyle ? navStyle.visibility : null,
      opacity: navStyle ? navStyle.opacity : null
    };
  });
  report.stateD_navigationAndHistory.directReload = directReloadState;

  // Browser back
  await page.goBack();
  await page.waitForTimeout(400);
  const backState = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-container');
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    return {
      url: window.location.pathname,
      navHidden: nav ? nav.classList.contains('bottom-nav-hidden') : false,
      visibility: navStyle ? navStyle.visibility : null
    };
  });
  report.stateD_navigationAndHistory.historyBack = backState;

  // Browser forward
  await page.goForward();
  await page.waitForTimeout(400);
  const forwardState = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-container');
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    return {
      url: window.location.pathname,
      navHidden: nav ? nav.classList.contains('bottom-nav-hidden') : false,
      visibility: navStyle ? navStyle.visibility : null
    };
  });
  report.stateD_navigationAndHistory.historyForward = forwardState;
  console.log('State D Results:', JSON.stringify(report.stateD_navigationAndHistory, null, 2));

  // 7. Testing 5 Required Viewports
  console.log('\n[7/8] Testing across 5 Required Viewports...');
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
    await page.waitForTimeout(300);
    await dismissMobileDrawerIfNeeded();

    // In direct chat
    const inChatData = await page.evaluate(() => {
      const composer = document.querySelector('.active-chat-composer');
      const sendBtn = document.querySelector('.chat-send-btn');
      const input = document.querySelector('.chat-composer-input');
      const navContainer = document.querySelector('.bottom-nav-container');
      const navStyle = navContainer ? window.getComputedStyle(navContainer) : null;

      const cRect = composer ? composer.getBoundingClientRect() : null;
      const sRect = sendBtn ? sendBtn.getBoundingClientRect() : null;

      return {
        bottomNavHidden: navContainer ? navContainer.classList.contains('bottom-nav-hidden') : false,
        bottomNavVisibility: navStyle ? navStyle.visibility : null,
        bottomNavOpacity: navStyle ? navStyle.opacity : null,
        composerVisible: Boolean(cRect && cRect.height > 0),
        composerBottom: cRect ? Math.round(cRect.bottom) : null,
        viewportHeight: window.innerHeight,
        sendBtnVisible: Boolean(sRect && sRect.width > 0),
        inputSendSingleRow: Boolean(cRect && sRect && input && Math.abs(input.getBoundingClientRect().top - sRect.top) < 10)
      };
    });

    report.viewports[vp.name] = inChatData;
    await page.screenshot({ path: path.join(screenshotsDir, `viewport_${vp.name}_direct_chat.png`) });
    console.log(`Viewport ${vp.name} verified: navHidden=${inChatData.bottomNavHidden}, composerVisible=${inChatData.composerVisible}, singleRow=${inChatData.inputSendSingleRow}`);
  }

  // 8. Testing Browser Zoom Levels (100%, 125%, 150%, 200%)
  console.log('\n[8/8] Testing Zoom Levels and Accessibility...');
  await page.setViewportSize({ width: 1366, height: 768 });
  const zoomFactors = [
    { factor: 1.0, label: '100pct' },
    { factor: 1.25, label: '125pct' },
    { factor: 1.5, label: '150pct' },
    { factor: 2.0, label: '200pct' }
  ];

  for (const z of zoomFactors) {
    await page.evaluate((zf) => {
      document.body.style.zoom = String(zf);
    }, z.factor);
    await page.waitForTimeout(300);

    const zoomData = await page.evaluate(() => {
      const composer = document.querySelector('.active-chat-composer');
      const sendBtn = document.querySelector('.chat-send-btn');
      const navContainer = document.querySelector('.bottom-nav-container');

      return {
        composerVisible: Boolean(composer && composer.getBoundingClientRect().height > 0),
        sendBtnVisible: Boolean(sendBtn && sendBtn.getBoundingClientRect().width > 0),
        navHidden: navContainer ? navContainer.classList.contains('bottom-nav-hidden') : false
      };
    });

    report.zoomLevels[z.label] = zoomData;
    await page.screenshot({ path: path.join(screenshotsDir, `zoom_${z.label}.png`) });
    console.log(`Zoom ${z.label} verified: composerVisible=${zoomData.composerVisible}, sendBtnVisible=${zoomData.sendBtnVisible}`);
  }

  // Reset zoom
  await page.evaluate(() => { document.body.style.zoom = '1'; });

  // Test Prefers-Reduced-Motion
  console.log('Testing prefers-reduced-motion media query...');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);

  const reducedMotionData = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-container');
    const comp = document.querySelector('.active-chat-composer');
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    const compStyle = comp ? window.getComputedStyle(comp) : null;

    return {
      navTransitionDuration: navStyle ? navStyle.transitionDuration : null,
      compTransitionDuration: compStyle ? compStyle.transitionDuration : null
    };
  });
  report.accessibilityAndMotion = reducedMotionData;
  console.log('Reduced motion verified:', reducedMotionData);

  // Close browser and print summary
  await browser.close();

  console.log('\n========================================================================');
  console.log('VERIFICATION SUMMARY REPORT:');
  console.log(JSON.stringify(report, null, 2));
  console.log('========================================================================');

  fs.writeFileSync(
    path.join(__dirname, 'master_ui_ux_verification_report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('✓ Saved report to website_testing/master_ui_ux_verification_report.json');
}

runMasterVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
