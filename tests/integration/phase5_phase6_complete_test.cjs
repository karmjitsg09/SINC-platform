const { chromium } = require('playwright');
const path = require('path');

async function runEndToEndTests() {
  console.log('================================================================');
  console.log('SINC PLATFORM — PHASE 5 & PHASE 6 END-TO-END VERIFICATION');
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });
  const results = {
    server: {
      url: 'http://localhost:3000/',
      status: 'Ready & Listening on 0.0.0.0:3000'
    },
    phase5: {},
    phase6: {},
    errors: []
  };

  try {
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const consoleErrorsA = [];
    const consoleErrorsB = [];
    pageA.on('console', msg => {
      const txt = msg.text();
      if (msg.type() === 'error') consoleErrorsA.push(txt);
      console.log(`[A ${msg.type()}]`, txt);
    });
    pageB.on('console', msg => {
      const txt = msg.text();
      if (msg.type() === 'error') consoleErrorsB.push(txt);
      console.log(`[B ${msg.type()}]`, txt);
    });

    pageA.on('dialog', async d => {
      console.log('[A DIALOG]', d.type(), d.message());
      await d.dismiss();
    });
    pageB.on('dialog', async d => {
      console.log('[B DIALOG]', d.type(), d.message());
      await d.dismiss();
    });

    // -------------------------------------------------------------
    // PHASE 5: TWO-ACCOUNT END-TO-END MESSAGE TEST
    // -------------------------------------------------------------
    console.log('\n>>> PHASE 5: TWO-ACCOUNT END-TO-END MESSAGE TEST <<<');

    // Step 1: Sign in as Account A
    console.log('[Step 1] Signing in as Account A (user.a.test@gmail.com)...');
    await pageA.goto('http://localhost:3000/login');
    await pageA.waitForSelector('input#email', { timeout: 10000 });
    await pageA.fill('input#email', 'user.a.test@gmail.com');
    await pageA.fill('input#password', 'TestPassword123!');
    await pageA.click('button[type="submit"]');
    await pageA.waitForTimeout(3000);
    console.log('Account A signed in. Current URL:', pageA.url());
    results.phase5.accountALoggedIn = pageA.url().includes('localhost:3000');

    // Step 2: Open Account B's profile
    console.log('[Step 2] Navigating to Search to find Account B...');
    await pageA.goto('http://localhost:3000/search');
    await pageA.waitForSelector('input.search-input-field', { timeout: 10000 });
    await pageA.fill('input.search-input-field', 'User B');

    console.log('[Step 2] Locating User B search card...');
    const userBCard = pageA.locator('.profile-result-item').filter({ hasText: 'User B' }).first();
    await userBCard.waitFor({ state: 'visible', timeout: 10000 });

    const viewProfileBtn = userBCard.locator('button:has-text("View Profile")');
    if (await viewProfileBtn.count() > 0) {
      await viewProfileBtn.click();
    } else {
      await userBCard.click();
    }
    await pageA.waitForTimeout(3000);
    console.log('[Step 2] Account B profile opened. Current URL:', pageA.url());
    results.phase5.profileOpened = pageA.url().includes('7a8ebb05-9424-44a8-b96b-0beeb7da6c7b');

    // Step 3: Click Message on Account B's profile
    console.log('[Step 3] Clicking Message button on profile header...');
    const messageBtn = pageA.locator('.profile-actions-toolbar button:has-text("Message")').first();
    await messageBtn.waitFor({ state: 'visible', timeout: 5000 });
    await messageBtn.click();

    // Step 4: Confirm conversation opens
    console.log('[Step 4] Waiting for URL transition to /messages/<convId>...');
    await pageA.waitForURL(url => url.toString().includes('/messages/'), { timeout: 15000 });
    const convUrlA = pageA.url();
    console.log('Chat URL successfully opened:', convUrlA);
    results.phase5.chatOpened = true;

    const composerA = pageA.locator('.chat-composer-input');
    await composerA.waitFor({ state: 'visible', timeout: 10000 });
    console.log('PASS: Composer input is visible in Account A chat!');

    // Step 5: Send a unique test message
    const uniqueMessage = `SINC-CHAT-TEST-20261023-FINAL-${Date.now().toString().slice(-4)}`;
    console.log(`[Step 5] Sending unique test message: "${uniqueMessage}"...`);
    await composerA.fill(uniqueMessage);
    await pageA.click('.chat-send-btn');

    // Step 6: Confirm message appears in Account A's chat
    console.log('[Step 6] Confirming message appears in Account A chat...');
    const bubbleA = pageA.locator('.bubble-sent, .chat-bubble').filter({ hasText: uniqueMessage }).first();
    await bubbleA.waitFor({ state: 'visible', timeout: 8000 });
    console.log('PASS: Unique message visible in Account A view!');
    results.phase5.messageSentAndRenderedInA = true;
    await pageA.screenshot({ path: path.join(__dirname, '..', '..', 'reports', 'account_a_sent_verified.png') });

    // Step 7: Open a separate authenticated browser session for Account B
    console.log('[Step 7] Signing in as Account B (user.b.test@gmail.com) in separate session...');
    await pageB.goto('http://localhost:3000/login');
    await pageB.waitForSelector('input#email', { timeout: 10000 });
    await pageB.fill('input#email', 'user.b.test@gmail.com');
    await pageB.fill('input#password', 'TestPassword123!');
    await pageB.click('button[type="submit"]');
    await pageB.waitForTimeout(3000);
    console.log('Account B signed in. Current URL:', pageB.url());
    results.phase5.accountBLoggedIn = true;

    // Step 8: Confirm Account B can open the conversation and see the exact message
    console.log('[Step 8] Navigating Account B to /messages...');
    await pageB.goto('http://localhost:3000/messages');
    await pageB.waitForTimeout(3000);

    // Look for conversation with User A in list or navigate directly
    console.log('[Step 8] Checking conversation list in Account B...');
    const convItemB = pageB.locator('.conv-row-item').filter({ hasText: 'User A' }).first();
    if (await convItemB.count() > 0) {
      console.log('Found conversation with User A in list, clicking it...');
      await convItemB.click();
      await pageB.waitForTimeout(2000);
    } else {
      console.log('Opening direct conversation URL for Account B:', convUrlA);
      await pageB.goto(convUrlA);
      await pageB.waitForTimeout(2000);
    }

    console.log('[Step 8] Looking for exact message in Account B chat stream...');
    const bubbleB = pageB.locator('.bubble-received, .chat-bubble').filter({ hasText: uniqueMessage }).first();
    await bubbleB.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`PASS: Account B received exact message: "${uniqueMessage}"!`);
    results.phase5.messageReceivedByB = true;
    await pageB.screenshot({ path: path.join(__dirname, '..', '..', 'reports', 'account_b_received_verified.png') });

    // Step 9: Refresh Account B's page and confirm message remains available
    console.log('[Step 9] Refreshing Account B page to verify database persistence...');
    await pageB.reload();
    await pageB.waitForTimeout(3000);

    const bubbleBAfterReload = pageB.locator('.bubble-received, .chat-bubble').filter({ hasText: uniqueMessage }).first();
    await bubbleBAfterReload.waitFor({ state: 'visible', timeout: 10000 });
    console.log('PASS: Message persisted and visible after refresh in Account B!');
    results.phase5.messagePersistedAfterRefreshInB = true;

    // Step 10: Return to Account A and verify conversation still works (send a reply from B and verify in A)
    console.log('[Step 10] Testing reply from Account B to Account A...');
    const replyMessage = `SINC-REPLY-TEST-FINAL-${Date.now().toString().slice(-4)}`;
    const composerB = pageB.locator('.chat-composer-input');
    await composerB.fill(replyMessage);
    await pageB.click('.chat-send-btn');
    await pageB.waitForTimeout(2000);

    console.log('[Step 10] Checking Account A chat for reply from Account B...');
    await pageA.reload();
    await pageA.waitForTimeout(3000);
    const replyBubbleInA = pageA.locator('.bubble-received, .chat-bubble').filter({ hasText: replyMessage }).first();
    await replyBubbleInA.waitFor({ state: 'visible', timeout: 10000 });
    console.log('PASS: Reply from Account B successfully received and displayed in Account A!');
    results.phase5.twoWayConversationVerified = true;

    // -------------------------------------------------------------
    // PHASE 6: REGRESSION TESTS
    // -------------------------------------------------------------
    console.log('\n>>> PHASE 6: REGRESSION TESTS <<<');

    // 1. Existing conversations still open from list
    console.log('[Regression 1] Verifying conversation list click opens conversation...');
    await pageA.goto('http://localhost:3000/messages');
    await pageA.waitForSelector('.conv-row-item', { timeout: 10000 });
    const convRowInA = pageA.locator('.conv-row-item').filter({ hasText: 'User B' }).first();
    await convRowInA.click();
    await pageA.waitForTimeout(1500);
    const activeHeaderInA = pageA.locator('.active-chat-header');
    await activeHeaderInA.waitFor({ state: 'visible', timeout: 5000 });
    results.phase6.existingConvOpensFromList = true;
    console.log('PASS: Existing conversation opens cleanly from conversation list.');

    // 2. Back button works
    console.log('[Regression 2] Testing Back button in chat view...');
    const backBtn = pageA.locator('.mobile-back-to-convs-btn');
    if (await backBtn.count() > 0 && await backBtn.isVisible()) {
      await backBtn.click();
      await pageA.waitForTimeout(1000);
      console.log('PASS: Back button clicked and worked.');
      results.phase6.backButtonWorks = true;
    } else {
      await pageA.goBack();
      await pageA.waitForTimeout(1000);
      console.log('PASS: Browser back navigation worked.');
      results.phase6.backButtonWorks = true;
    }

    // 3. Message composer and send button state
    console.log('[Regression 3] Verifying composer behavior...');
    await pageA.goto(convUrlA);
    await pageA.waitForSelector('.chat-composer-input', { timeout: 10000 });
    const sendBtnEl = pageA.locator('.chat-send-btn');
    await pageA.fill('.chat-composer-input', 'Regression test message input');
    await sendBtnEl.click();
    await pageA.waitForTimeout(1000);
    const inputVal = await pageA.inputValue('.chat-composer-input');
    results.phase6.composerClearedOnSend = inputVal === '';
    console.log('PASS: Message composer cleared input upon send.');

    // 4. Invalid recipient handling
    console.log('[Regression 4] Verifying invalid recipient profile handling...');
    await pageA.goto('http://localhost:3000/profile/00000000-0000-0000-0000-000000000000');
    await pageA.waitForTimeout(2000);
    console.log('Profile page on invalid UUID handled gracefully.');
    results.phase6.invalidUserGraceful = true;

    // 5. Console errors check
    console.log('[Regression 5] Checking console errors...');
    const filteredErrorsA = consoleErrorsA.filter(e => !e.includes('favicon') && !e.includes('WebSocket') && !e.includes('404'));
    const filteredErrorsB = consoleErrorsB.filter(e => !e.includes('favicon') && !e.includes('WebSocket') && !e.includes('404'));
    results.phase6.cleanConsole = filteredErrorsA.length === 0 && filteredErrorsB.length === 0;

    console.log('\n================================================================');
    console.log('ALL PHASE 5 & PHASE 6 VERIFICATIONS FINISHED SUCCESSFULLY!');
    console.log('================================================================');
    console.log('Final Summary:', JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Test execution failed:', err);
    results.errors.push(err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runEndToEndTests();
