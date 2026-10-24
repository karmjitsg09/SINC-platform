const { chromium } = require('playwright');
const path = require('path');

async function testUserAToBJourney() {
  console.log('=== STARTING ACCOUNT A -> ACCOUNT B DIRECT MESSAGING USER JOURNEY ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));

  const testMessage = `SINC-CHAT-TEST-20261023-01-${Date.now().toString().slice(-4)}`;

  try {
    // 1. Sign in as Account A
    console.log('[Step 1] Signing in as Account A...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input#email', 'user.a.test@gmail.com');
    await page.fill('input#password', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('Signed in. Current URL:', page.url());

    // 2. Navigate to Search
    console.log('[Step 2] Navigating to Search...');
    await page.goto('http://localhost:3000/search');
    await page.waitForTimeout(1500);

    // 3. Search for User B
    console.log('[Step 3] Searching for "User B"...');
    const searchInput = page.locator('input.search-input-field');
    await searchInput.fill('User B');

    // 4. Wait for User B search card
    console.log('[Step 4] Waiting for User B profile result card...');
    const userBCard = page.locator('.profile-result-item').filter({ hasText: 'User B' }).first();
    await userBCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('User B card text:', (await userBCard.innerText()).replace(/\n/g, ' '));

    // 5. Open User B Profile
    console.log('[Step 5] Clicking View Profile on User B card...');
    const viewProfileBtn = userBCard.locator('button:has-text("View Profile")');
    if (await viewProfileBtn.count() > 0) {
      await viewProfileBtn.click();
    } else {
      await userBCard.click();
    }

    await page.waitForTimeout(2000);
    console.log('Current URL on Profile:', page.url());
    if (!page.url().includes('7a8ebb05-9424-44a8-b96b-0beeb7da6c7b')) {
      throw new Error(`Unexpected profile URL: ${page.url()}`);
    }

    // 6. Click Message button on User B profile
    console.log('[Step 6] Clicking Message button on profile header...');
    const messageBtn = page.locator('.profile-actions-toolbar button:has-text("Message")').first();
    await messageBtn.waitFor({ state: 'visible', timeout: 5000 });
    await messageBtn.click();

    // 7. Verify chat opens
    console.log('[Step 7] Verifying direct messaging panel opens...');
    await page.waitForTimeout(3000);
    console.log('URL after clicking Message:', page.url());
    if (!page.url().includes('/messages/')) {
      throw new Error(`Expected /messages/<convId>, got: ${page.url()}`);
    }

    const composer = page.locator('.chat-composer-input');
    await composer.waitFor({ state: 'visible', timeout: 10000 });
    console.log('PASS: Composer input is visible!');

    // 8. Send test message
    console.log(`[Step 8] Sending test message: "${testMessage}"...`);
    await composer.fill(testMessage);
    const sendBtn = page.locator('.chat-send-btn');
    await sendBtn.click();

    // 9. Verify message appears in Account A's chat
    console.log('[Step 9] Verifying message appears in sender view...');
    const sentBubble = page.locator('.bubble-sent, .chat-bubble').filter({ hasText: testMessage }).first();
    await sentBubble.waitFor({ state: 'visible', timeout: 8000 });
    console.log('PASS: Sent message appears in Account A view!');

    console.log('=== ACCOUNT A JOURNEY COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Account A journey failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

testUserAToBJourney();
