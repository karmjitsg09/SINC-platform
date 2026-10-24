const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function reproduce() {
  console.log('=== STARTING REPRODUCTION SCRIPT ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    const entry = `[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(entry);
    console.log(entry);
  });

  page.on('pageerror', (err) => {
    const entry = `[PAGE ERROR] ${err.message}\n${err.stack}`;
    consoleLogs.push(entry);
    console.error(entry);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      const entry = `[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`;
      networkErrors.push(entry);
      console.warn(entry);
    }
  });

  const outputDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('Navigating to http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    
    console.log('Filling login form for Account A...');
    await page.fill('input#email', 'user.a.test@gmail.com');
    await page.fill('input#password', 'TestPassword123!');
    await page.click('button[type="submit"]');

    console.log('Waiting for login redirect...');
    await page.waitForTimeout(4000);
    console.log('Current URL after login:', page.url());

    console.log('Navigating to Search page...');
    await page.goto('http://localhost:3000/search', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Searching for User B...');
    const searchInput = page.locator('input.search-input-field, input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('User B');
      await page.waitForTimeout(2000);
    }

    console.log('Looking for User B search result...');
    const userBCard = page.locator('.profile-result-item, .search-card-item').filter({ hasText: 'User B' }).first();
    if (await userBCard.count() > 0) {
      console.log('Found User B card! Clicking View Profile...');
      const viewBtn = userBCard.locator('button:has-text("View Profile")');
      if (await viewBtn.count() > 0) {
        await viewBtn.click();
      } else {
        await userBCard.click();
      }
    } else {
      console.log('User B card not found by text, checking any profile result...');
      const firstCard = page.locator('.profile-result-item').first();
      await firstCard.click();
    }

    await page.waitForTimeout(3000);
    console.log('Current URL on Profile:', page.url());
    await page.screenshot({ path: path.join(outputDir, 'step1_profile_before_message.png') });

    console.log('Finding Message button on profile header...');
    const messageBtn = page.locator('.profile-actions-toolbar button:has-text("Message")').first();
    const btnCount = await messageBtn.count();
    console.log('Message button found count:', btnCount);

    if (btnCount > 0) {
      const isVisible = await messageBtn.isVisible();
      const isEnabled = await messageBtn.isEnabled();
      console.log('Message button visible:', isVisible, 'enabled:', isEnabled);

      console.log('Clicking Message button...');
      await messageBtn.click();
      
      console.log('Waiting 5 seconds to observe behavior...');
      await page.waitForTimeout(5000);

      console.log('Current URL after clicking Message:', page.url());
      await page.screenshot({ path: path.join(outputDir, 'step2_after_click_message.png') });

      // Check what UI elements are present
      const chatPanel = await page.locator('.messaging-chat-panel, .active-chat-container, .chat-placeholder-view').count();
      const composer = await page.locator('.chat-composer-input, input[placeholder*="message"]').count();
      const profileHeader = await page.locator('.profile-header-card-v2').count();

      console.log('DOM State after Message click:');
      console.log('  Chat panel count:', chatPanel);
      console.log('  Composer count:', composer);
      console.log('  Profile header count:', profileHeader);
    } else {
      console.error('ERROR: Message button could not be found on the profile!');
    }

    // Now test navigating directly to /messages and clicking the conversation
    console.log('\n--- Testing Messaging Page Directly ---');
    await page.goto('http://localhost:3000/messages', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('Current URL on /messages:', page.url());
    await page.screenshot({ path: path.join(outputDir, 'step3_messages_page.png') });

    const convRows = page.locator('.conv-row-item');
    const convRowCount = await convRows.count();
    console.log('Number of conversation rows in list:', convRowCount);

    if (convRowCount > 0) {
      for (let i = 0; i < convRowCount; i++) {
        const text = await convRows.nth(i).innerText();
        console.log(`  Row ${i}: ${text.replace(/\n/g, ' ')}`);
      }
      console.log('Clicking first conversation row...');
      await convRows.first().click();
      await page.waitForTimeout(3000);
      console.log('Current URL after clicking conversation row:', page.url());
      await page.screenshot({ path: path.join(outputDir, 'step4_after_clicking_conv_row.png') });

      const activeChat = await page.locator('.active-chat-container').count();
      const placeholder = await page.locator('.chat-placeholder-view').count();
      console.log('  active-chat-container count:', activeChat);
      console.log('  chat-placeholder-view count:', placeholder);
    }

  } catch (err) {
    console.error('Reproduction script exception:', err);
  } finally {
    console.log('\n=== SUMMARY OF CONSOLE LOGS ===');
    consoleLogs.forEach((l) => console.log(l));
    console.log('\n=== SUMMARY OF NETWORK ERRORS ===');
    networkErrors.forEach((e) => console.log(e));

    await browser.close();
    console.log('=== END OF REPRODUCTION SCRIPT ===');
  }
}

reproduce();
