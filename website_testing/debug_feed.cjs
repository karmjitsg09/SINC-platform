const { chromium } = require('playwright');

async function debugFeed() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));
  page.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input#email');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('URL after login:', page.url());
  const html = await page.content();
  console.log('Has feed-post-card:', html.includes('feed-post-card'));
  console.log('Has feed-empty-state-card:', html.includes('feed-empty-state-card'));
  console.log('Has feed-loading-skeleton:', html.includes('feed-loading-skeleton'));
  console.log('Has main-content:', html.includes('main-content') || html.includes('feed-primary-column'));

  // Look for any errors or elements in body
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Body text sample:\n', bodyText);

  await browser.close();
}

debugFeed();
