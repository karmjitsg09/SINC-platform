const { chromium } = require('playwright');

async function runE2EDMTest() {
  console.log('====================================================');
  console.log('STARTING SINC DIRECT MESSAGING TWO-ACCOUNT E2E TEST');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });
  const testMessageText = `SINC-DM-TEST-20261020-${Date.now().toString().slice(-4)}`;

  try {
    // 1. Create two isolated browser contexts
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Sign in Account A
    console.log('[Step 1] Signing in Account A (user.a.test@gmail.com)...');
    await pageA.goto('http://localhost:3003/login');
    await pageA.waitForSelector('input#email', { timeout: 15000 });
    await pageA.fill('input#email', 'user.a.test@gmail.com');
    await pageA.fill('input#password', 'TestPassword123!');
    await pageA.click('button[type="submit"]');

    // Wait for redirect to home
    await pageA.waitForTimeout(4000);
    console.log('[Step 1] Account A URL after login:', pageA.url());

    // Sign in Account B
    console.log('[Step 2] Signing in Account B (user.b.test@gmail.com)...');
    await pageB.goto('http://localhost:3003/login');
    await pageB.waitForSelector('input#email', { timeout: 15000 });
    await pageB.fill('input#email', 'user.b.test@gmail.com');
    await pageB.fill('input#password', 'TestPassword123!');
    await pageB.click('button[type="submit"]');

    // Wait for redirect to home
    await pageB.waitForTimeout(4000);
    console.log('[Step 2] Account B URL after login:', pageB.url());

    const convId = 'b2adb69e-c20e-4cf4-a832-9b2991dec912';

    // Step 3: Account A navigates to Direct Message Conversation
    console.log('[Step 3] Account A navigating directly to conversation URL:', convId);
    await pageA.goto(`http://localhost:3003/messages/${convId}`);
    await pageA.waitForTimeout(3000);

    // Verify Chat panel is active on Account A
    console.log('[Step 4] Verifying chat composer is visible for Account A...');
    const composerInputA = pageA.locator('.chat-composer-input');
    await composerInputA.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Step 4] Composer input is ready on Account A.');

    // Step 5: Account B navigates to Direct Message Conversation
    console.log('[Step 5] Navigating Account B to conversation URL to observe incoming message...');
    await pageB.goto(`http://localhost:3003/messages/${convId}`);
    await pageB.waitForTimeout(3000);


    // Step 6: Account A sends the uniquely identifiable message
    console.log(`[Step 6] Account A sending message: "${testMessageText}"...`);
    await composerInputA.fill(testMessageText);
    const sendBtnA = pageA.locator('.chat-send-btn');
    await sendBtnA.click();

    // Verify sender sees the message
    console.log('[Step 7] Checking sender (Account A) sees the sent message...');
    const sentMsgA = pageA.locator('.bubble-sent').filter({ hasText: testMessageText }).first();
    await sentMsgA.waitFor({ state: 'visible', timeout: 8000 });
    console.log('[Step 7] PASS: Sender sees the message bubble.');

    // Step 8: Verify recipient (Account B) receives the message
    console.log('[Step 8] Checking recipient (Account B) receives the message in real-time...');
    // If not clicked yet on B, click conversation with A now
    if (await pageB.locator('.active-chat-container').count() === 0) {
      const convRowOnB = pageB.locator('.conv-row-item').filter({ hasText: 'User A' }).first();
      await convRowOnB.click();
      await pageB.waitForTimeout(2000);
    }

    const receivedMsgB = pageB.locator('.bubble-received').filter({ hasText: testMessageText }).first();
    await receivedMsgB.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Step 8] PASS: Recipient (Account B) received the exact message in the UI!');

    // Step 9: Refresh Account B's page to verify database persistence (not just local state)
    console.log('[Step 9] Refreshing Account B page to verify database persistence...');
    await pageB.reload();
    await pageB.waitForTimeout(3000);

    // After refresh, select conversation or verify message
    const userAConvRowAfterRefresh = pageB.locator('.conv-row-item').filter({ hasText: 'User A' }).first();
    if (await userAConvRowAfterRefresh.count() > 0) {
      await userAConvRowAfterRefresh.click();
      await pageB.waitForTimeout(2000);
    }

    const persistedMsgB = pageB.locator('.chat-bubble').filter({ hasText: testMessageText }).first();
    await persistedMsgB.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Step 9] PASS: Message persisted after refresh on Account B!');

    // Step 10: Refresh Account A and verify conversation and message still exist
    console.log('[Step 10] Refreshing Account A page to verify persistence on sender side...');
    await pageA.reload();
    await pageA.waitForTimeout(3000);

    const userBConvRowAfterRefresh = pageA.locator('.conv-row-item').filter({ hasText: 'User B' }).first();
    if (await userBConvRowAfterRefresh.count() > 0) {
      await userBConvRowAfterRefresh.click();
      await pageA.waitForTimeout(2000);
    }

    const persistedMsgA = pageA.locator('.chat-bubble').filter({ hasText: testMessageText }).first();
    await persistedMsgA.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Step 10] PASS: Message and conversation persisted after refresh on Account A!');

    console.log('====================================================');
    console.log('ALL 10 END-TO-END DIRECT MESSAGING TEST STEPS PASSED!');
    console.log('====================================================');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runE2EDMTest();
