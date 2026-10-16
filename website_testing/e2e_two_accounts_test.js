const { chromium } = require('playwright');

async function runTwoAccountE2ETest() {
  console.log('====================================================');
  console.log('STARTING SINC DOMAIN CHAT TWO-ACCOUNT E2E TEST');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Create two isolated browser contexts
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    console.log('[Step 1] Signing in Account A (user.a.test@gmail.com)...');
    await pageA.goto('http://localhost:3001/login');
    await pageA.waitForSelector('input#email', { timeout: 10000 });
    await pageA.fill('input#email', 'user.a.test@gmail.com');
    await pageA.fill('input#password', 'TestPassword123!');
    await pageA.click('button[type="submit"]');

    // Wait for login redirect
    await pageA.waitForTimeout(3000);
    console.log('[Step 1] Account A signed in. Current URL:', pageA.url());

    console.log('[Step 2] Signing in Account B (user.b.test@gmail.com)...');
    await pageB.goto('http://localhost:3001/login');
    await pageB.waitForSelector('input#email', { timeout: 10000 });
    await pageB.fill('input#email', 'user.b.test@gmail.com');
    await pageB.fill('input#password', 'TestPassword123!');
    await pageB.click('button[type="submit"]');

    // Wait for login redirect
    await pageB.waitForTimeout(3000);
    console.log('[Step 2] Account B signed in. Current URL:', pageB.url());

    // Navigate Account A to Tech / General
    console.log('[Step 3] Navigating Account A to Domains -> Tech -> General...');
    await pageA.goto('http://localhost:3001/domains');
    await pageA.waitForTimeout(2000);

    // Look for Tech domain card
    const techCardA = pageA.locator('.domain-card-v2').filter({ hasText: 'Tech' }).first();
    if (await techCardA.count() > 0) {
      await techCardA.click();
    } else {
      await pageA.click('text=Tech');
    }
    await pageA.waitForTimeout(1500);

    // Click # General channel
    const generalChannelA = pageA.locator('.channel-card-item').filter({ hasText: 'General' }).first();
    if (await generalChannelA.count() > 0) {
      await generalChannelA.click();
    } else {
      await pageA.click('text=General');
    }
    await pageA.waitForSelector('.chat-input-field', { timeout: 8000 });
    console.log('[Step 3] Account A is now viewing Tech / General.');

    // Navigate Account B to Tech / General
    console.log('[Step 4] Navigating Account B to Domains -> Tech -> General...');
    await pageB.goto('http://localhost:3001/domains');
    await pageB.waitForTimeout(2000);

    const techCardB = pageB.locator('.domain-card-v2').filter({ hasText: 'Tech' }).first();
    if (await techCardB.count() > 0) {
      await techCardB.click();
    } else {
      await pageB.click('text=Tech');
    }
    await pageB.waitForTimeout(1500);

    const generalChannelB = pageB.locator('.channel-card-item').filter({ hasText: 'General' }).first();
    if (await generalChannelB.count() > 0) {
      await generalChannelB.click();
    } else {
      await pageB.click('text=General');
    }
    await pageB.waitForSelector('.chat-input-field', { timeout: 8000 });
    console.log('[Step 4] Account B is now viewing Tech / General.');

    // Wait 2 seconds for WebSocket channel subscriptions to be established on both contexts
    console.log('Waiting for Realtime WebSocket subscriptions to establish...');
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    // Step 5: Account A sends message SINC_TEST_A_001
    const testMsgA = `SINC_TEST_A_001_${Date.now()}`;
    console.log(`[Step 5] Account A sending message: "${testMsgA}"...`);
    await pageA.fill('.chat-input-field', testMsgA);
    await pageA.click('button.chat-send-btn');
    await pageA.waitForTimeout(1000);

    // Step 6: Verify message appears on Account A's screen
    const msgOnA = await pageA.locator('.message-bubble').filter({ hasText: testMsgA }).count();
    console.log(`[Step 6] Message appears in Account A view: ${msgOnA > 0 ? 'YES' : 'NO'}`);

    // Step 7: Verify message arrives on Account B's screen WITHOUT refreshing
    console.log('[Step 7] Checking if Account B received message in real-time (without refresh)...');
    let msgOnB = 0;
    for (let i = 0; i < 40; i++) {
      msgOnB = await pageB.locator('.message-bubble').filter({ hasText: testMsgA }).count();
      if (msgOnB > 0) break;
      await pageB.waitForTimeout(250);
    }
    console.log(`[Step 7] Message arrived in Account B view WITHOUT refresh: ${msgOnB > 0 ? 'YES (SUCCESS)' : 'NO (FAILED)'}`);

    // Step 8: Refresh Account B's page and verify message persists
    console.log('[Step 8] Refreshing Account B page...');
    await pageB.reload();
    await pageB.waitForTimeout(2000);
    // Re-enter Tech -> General if needed
    if (pageB.url().includes('/domains')) {
      const tc = pageB.locator('.domain-card-v2').filter({ hasText: 'Tech' }).first();
      if (await tc.count() > 0) await tc.click();
      await pageB.waitForTimeout(1000);
      const gc = pageB.locator('.channel-card-item').filter({ hasText: 'General' }).first();
      if (await gc.count() > 0) await gc.click();
      await pageB.waitForSelector('.chat-input-field', { timeout: 8000 });
    }
    const msgOnBAfterRefresh = await pageB.locator('.message-bubble').filter({ hasText: testMsgA }).count();
    console.log(`[Step 8] Message visible in Account B after refresh: ${msgOnBAfterRefresh > 0 ? 'YES (SUCCESS)' : 'NO (FAILED)'}`);

    // Step 9: Account B sends a reply
    const testMsgB = `SINC_TEST_B_001_${Date.now()}`;
    console.log(`[Step 9] Account B sending reply: "${testMsgB}"...`);
    await pageB.fill('.chat-input-field', testMsgB);
    await pageB.click('button.chat-send-btn');
    await pageB.waitForTimeout(1000);

    // Step 10: Verify Account A receives reply in real-time without refreshing
    console.log('[Step 10] Checking if Account A received reply in real-time (without refresh)...');
    let replyOnA = 0;
    for (let i = 0; i < 40; i++) {
      replyOnA = await pageA.locator('.message-bubble').filter({ hasText: testMsgB }).count();
      if (replyOnA > 0) break;
      await pageA.waitForTimeout(250);
    }
    console.log(`[Step 10] Reply arrived in Account A view WITHOUT refresh: ${replyOnA > 0 ? 'YES (SUCCESS)' : 'NO (FAILED)'}`);

    console.log('====================================================');
    console.log('ALL E2E REALTIME & PERSISTENCE CHECKS COMPLETED!');
    console.log('====================================================');

    await contextA.close();
    await contextB.close();
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

runTwoAccountE2ETest();
