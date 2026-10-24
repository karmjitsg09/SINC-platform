const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGEERROR]', err.message));

  console.log('Logging in as Account A...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Navigating directly to User B profile: 7a8ebb05-9424-44a8-b96b-0beeb7da6c7b');
  await page.goto('http://localhost:3000/profile/7a8ebb05-9424-44a8-b96b-0beeb7da6c7b');
  await page.waitForTimeout(3000);

  console.log('Profile URL:', page.url());
  const msgBtn = page.locator('button:has-text("Message")').first();
  console.log('Message button count:', await msgBtn.count());

  console.log('Clicking Message button on User B profile...');
  await msgBtn.click();
  await page.waitForTimeout(5000);

  console.log('URL after clicking Message:', page.url());
  const activeChat = await page.locator('.active-chat-container').count();
  const composer = await page.locator('.chat-composer-input').count();
  const placeholder = await page.locator('.chat-placeholder-view').count();
  console.log('activeChat:', activeChat, 'composer:', composer, 'placeholder:', placeholder);

  await browser.close();
})();
