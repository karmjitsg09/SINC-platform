const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));

  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/search');
  await page.waitForTimeout(2000);

  const input = page.locator('input.search-input-field');
  await input.fill('User B');
  await page.waitForTimeout(3000);

  const results = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.profile-result-item')).map(el => ({
      text: el.innerText.replace(/\n/g, ' | '),
      html: el.outerHTML
    }));
  });

  console.log('Profile search results found:', results.length);
  results.forEach((r, idx) => console.log(`  [${idx}] ${r.text}`));

  await browser.close();
})();
