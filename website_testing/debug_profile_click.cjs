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

  // Inspect DOM and what button exists
  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText,
      className: b.className,
      id: b.id,
      html: b.outerHTML
    }));
    return {
      pathname: window.location.pathname,
      buttons
    };
  });

  console.log('Page info:', JSON.stringify(info, null, 2));

  // Let's click the Message button and log window.location every 200ms
  const btn = page.locator('button:has-text("Message")').first();
  console.log('Clicking Message button...');
  await btn.click();

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const currUrl = page.url();
    console.log(`t=${(i+1)*200}ms URL:`, currUrl);
    if (currUrl.includes('/messages')) break;
  }

  await page.waitForTimeout(2000);
  console.log('Final URL:', page.url());
  await browser.close();
})();
