const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));

  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Navigating to User B profile...');
  await page.goto('http://localhost:3000/profile/7a8ebb05-9424-44a8-b96b-0beeb7da6c7b');
  await page.waitForTimeout(3000);

  console.log('Locating exact profile message button in .profile-actions-toolbar...');
  const profileMsgBtn = page.locator('.profile-actions-toolbar button:has-text("Message")');
  console.log('Profile Message button count:', await profileMsgBtn.count());

  console.log('Clicking the Profile Message button...');
  await profileMsgBtn.click();

  console.log('Waiting 5s...');
  await page.waitForTimeout(5000);

  console.log('URL after clicking Profile Message button:', page.url());
  const activeChat = await page.locator('.active-chat-container').count();
  const composer = await page.locator('.chat-composer-input').count();
  const placeholder = await page.locator('.chat-placeholder-view').count();
  console.log('activeChat:', activeChat, 'composer:', composer, 'placeholder:', placeholder);

  await browser.close();
})();
