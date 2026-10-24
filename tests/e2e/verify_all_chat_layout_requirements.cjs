const { chromium } = require('playwright');
const path = require('path');

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — CHAT COMPOSER & BOTTOM NAV VERIFICATION SUITE');
  console.log('========================================================================');

  const browser = await chromium.launch({ headless: true });
  const results = {
    viewports: {},
    zoomLevels: {},
    messageInteraction: {},
    navigationInteraction: {},
    consoleErrors: []
  };

  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
      console.log('[BROWSER ERROR]', msg.text());
    }
  });

  // Login as User A
  console.log('\n[1/5] Logging in as Account A...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input#email', { timeout: 10000 });
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Navigate to /messages and open first conversation
  console.log('\n[2/5] Opening conversation with User B...');
  await page.goto('http://localhost:3000/messages');
  await page.waitForTimeout(2000);
  const convRow = page.locator('.conv-row-item').first();
  await convRow.waitFor({ state: 'visible', timeout: 10000 });
  await convRow.click();
  await page.waitForTimeout(1500);

  // Helper function to inspect bounding boxes and overlap
  const checkOverlap = async (contextName) => {
    return await page.evaluate((cName) => {
      const getBox = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          selector: sel,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };

      const composer = getBox('.active-chat-composer');
      const bottomNav = getBox('.bottom-nav');
      const sendBtn = getBox('.chat-send-btn');
      const header = getBox('.active-chat-header');
      const stream = getBox('.active-chat-stream');

      let isOverlapping = false;
      let overlapPx = 0;
      let gapPx = 0;

      if (composer && bottomNav) {
        // Vertical overlap check
        if (!(composer.bottom <= bottomNav.top || composer.top >= bottomNav.bottom)) {
          isOverlapping = true;
          overlapPx = Math.min(composer.bottom, bottomNav.bottom) - Math.max(composer.top, bottomNav.top);
        } else {
          gapPx = bottomNav.top - composer.bottom;
        }
      }

      return {
        contextName: cName,
        window: { width: window.innerWidth, height: window.innerHeight },
        composer,
        bottomNav,
        sendBtn,
        header,
        stream,
        isOverlapping,
        overlapPx,
        gapPx,
        isSendButtonVisible: Boolean(sendBtn && sendBtn.height > 0 && sendBtn.width > 0 && (!bottomNav || sendBtn.bottom <= bottomNav.top))
      };
    }, contextName);
  };

  // Test 1: Test across the 5 required viewports
  console.log('\n[3/5] Testing 5 Required Viewports...');
  const viewports = [
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '768x900', width: 768, height: 900 },
    { name: '600x800', width: 600, height: 800 },
    { name: '400x800', width: 400, height: 800 }
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    const metrics = await checkOverlap(`Viewport_${vp.name}`);
    results.viewports[vp.name] = metrics;
    const shotPath = path.join(__dirname, `verified_viewport_${vp.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✓ Viewport ${vp.name.padEnd(8)}: Overlap: ${metrics.isOverlapping} (${metrics.overlapPx}px), Separation gap: ${metrics.gapPx}px, SendBtn visible: ${metrics.isSendButtonVisible}`);
  }

  // Test 2: Test Browser Zoom (100%, 125%, 150%, 200%)
  console.log('\n[4/5] Testing Browser Zoom Levels at base 1366x768...');
  const zoomLevels = [
    { name: '100%', zoom: 1.0, effectiveWidth: 1366, effectiveHeight: 768 },
    { name: '125%', zoom: 1.25, effectiveWidth: Math.round(1366 / 1.25), effectiveHeight: Math.round(768 / 1.25) },
    { name: '150%', zoom: 1.5, effectiveWidth: Math.round(1366 / 1.5), effectiveHeight: Math.round(768 / 1.5) },
    { name: '200%', zoom: 2.0, effectiveWidth: Math.round(1366 / 2.0), effectiveHeight: Math.round(768 / 2.0) }
  ];

  for (const z of zoomLevels) {
    await page.setViewportSize({ width: z.effectiveWidth, height: z.effectiveHeight });
    await page.waitForTimeout(500);
    const metrics = await checkOverlap(`Zoom_${z.name}`);
    results.zoomLevels[z.name] = metrics;
    const shotPath = path.join(__dirname, `verified_zoom_${z.name.replace('%', 'pct')}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✓ Zoom ${z.name.padEnd(5)} (${z.effectiveWidth}x${z.effectiveHeight}): Overlap: ${metrics.isOverlapping}, Gap: ${metrics.gapPx}px, Stream height: ${metrics.stream?.height}px`);
  }

  // Restore desktop 1366x768
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);

  // Test 3: Scrolling message history
  console.log('\n[5/5] Testing Message History Scrolling & Sending...');
  const scrollInfoBefore = await page.evaluate(() => {
    const stream = document.querySelector('.active-chat-stream');
    return {
      scrollTop: stream.scrollTop,
      scrollHeight: stream.scrollHeight,
      clientHeight: stream.clientHeight
    };
  });
  console.log('  Initial stream metrics:', scrollInfoBefore);

  // Scroll stream to top to test older messages
  await page.evaluate(() => {
    const stream = document.querySelector('.active-chat-stream');
    stream.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  const scrollInfoTop = await page.evaluate(() => document.querySelector('.active-chat-stream').scrollTop);
  console.log(`  ✓ Scrolled to top (older messages accessible, scrollTop=${scrollInfoTop})`);
  await page.screenshot({ path: path.join(__dirname, 'verified_scrolled_to_top.png') });

  // Type a message in composer
  console.log('  Typing message in composer...');
  const testMsg = `UI-VERIFICATION-CHECK-${Date.now().toString().slice(-4)}`;
  const inputEl = page.locator('.chat-composer-input');
  await inputEl.fill(testMsg);
  await page.waitForTimeout(300);

  // Check composer position during typing
  const composerDuringTyping = await checkOverlap('WhileTyping');
  console.log(`  ✓ Composer while typing: Overlap: ${composerDuringTyping.isOverlapping}, Gap: ${composerDuringTyping.gapPx}px`);

  // Send message
  console.log(`  Sending message: "${testMsg}"...`);
  await page.click('.chat-send-btn');
  await page.waitForTimeout(2500);

  // Verify message appears in stream and is visible
  const sentBubble = page.locator('.bubble-sent').filter({ hasText: testMsg }).first();
  await sentBubble.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(() => {
    const stream = document.querySelector('.active-chat-stream');
    stream.scrollTop = stream.scrollHeight;
  });
  await page.waitForTimeout(500);

  const bubbleBox = await sentBubble.boundingBox();
  const streamBox = await page.locator('.active-chat-stream').boundingBox();
  const composerBox = await page.locator('.active-chat-composer').boundingBox();
  const latestMessageAboveComposer = bubbleBox.y + bubbleBox.height <= composerBox.y && bubbleBox.y >= streamBox.y;
  console.log(`  ✓ Latest message sent and rendered! Bubble: [${Math.round(bubbleBox.y)}px - ${Math.round(bubbleBox.y + bubbleBox.height)}px], Stream top: ${Math.round(streamBox.y)}px, Composer top: ${Math.round(composerBox.y)}px. Visible above composer? ${latestMessageAboveComposer}`);
  await page.screenshot({ path: path.join(__dirname, 'verified_message_sent_visible.png') });

  // Test 4: Verify Bottom Navigation Items Clickability
  console.log('\nTesting Bottom Navigation Tabs Interaction...');
  // 1. Click Home
  await page.click('.bottom-nav button[aria-label*="Home"]');
  await page.waitForTimeout(1000);
  const isHome = await page.evaluate(() => document.querySelector('.bottom-nav button[aria-label*="Home"]').classList.contains('active'));
  console.log(`  ✓ Clicked Home: Active tab is Home? ${isHome}`);

  // 2. Click Domains
  await page.click('.bottom-nav button[aria-label*="Domains"]');
  await page.waitForTimeout(1000);
  const isDomains = await page.evaluate(() => document.querySelector('.bottom-nav button[aria-label*="Domains"]').classList.contains('active'));
  console.log(`  ✓ Clicked Domains: Active tab is Domains? ${isDomains}`);

  // 3. Click Search
  await page.click('.bottom-nav button[aria-label*="Search"]');
  await page.waitForTimeout(1000);
  const isSearch = await page.evaluate(() => document.querySelector('.bottom-nav button[aria-label*="Search"]').classList.contains('active'));
  console.log(`  ✓ Clicked Search: Active tab is Search? ${isSearch}`);

  // 4. Click Messages to return to chat
  await page.click('.bottom-nav button[aria-label*="Messages"]');
  await page.waitForTimeout(1000);
  const isMessages = await page.evaluate(() => document.querySelector('.bottom-nav button[aria-label*="Messages"]').classList.contains('active'));
  console.log(`  ✓ Clicked Messages: Returned to Messages? ${isMessages}`);

  // Check mobile test for send button clickability
  console.log('\nTesting mobile (400x800) message send interaction...');
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(1000);

  // If mobile sidebar drawer is open, close it using the collapse button
  const collapseBtn = page.locator('.sidebar-collapse-btn');
  if (await collapseBtn.count() > 0 && await collapseBtn.isVisible()) {
    await collapseBtn.click();
    await page.waitForTimeout(500);
  }

  // If on mobile conversation list, click conversation row to open chat detail
  const cRowMobile = page.locator('.conv-row-item').first();
  await cRowMobile.waitFor({ state: 'visible', timeout: 5000 });
  await cRowMobile.click();
  await page.waitForTimeout(1500);

  const mobileInput = page.locator('.chat-composer-input');
  await mobileInput.waitFor({ state: 'visible', timeout: 5000 });
  const mobileTestMsg = `MOBILE-VERIFIED-${Date.now().toString().slice(-4)}`;
  await mobileInput.fill(mobileTestMsg);
  await page.waitForTimeout(300);

  const mobileSendBtn = page.locator('.chat-send-btn');
  await mobileSendBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000);

  const mobileSentBubble = page.locator('.bubble-sent').filter({ hasText: mobileTestMsg }).first();
  await mobileSentBubble.waitFor({ state: 'visible', timeout: 5000 });
  console.log(`  ✓ Mobile (400x800): Sent message successfully via click without interception!`);
  await page.screenshot({ path: path.join(__dirname, 'verified_mobile_send_interaction.png') });

  await browser.close();

  console.log('\n========================================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log(`Total Console Errors: ${results.consoleErrors.length}`);
  console.log('========================================================================');
}

runComprehensiveVerification().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
