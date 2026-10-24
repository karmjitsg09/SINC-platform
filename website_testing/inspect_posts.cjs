const { chromium } = require('playwright');

async function testPostElements() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');

  // Wait for feed container
  await page.waitForSelector('.feed-posts-stream', { timeout: 10000 });
  await page.waitForTimeout(3000);

  const postsInfo = await page.evaluate(() => {
    const cards = document.querySelectorAll('.feed-post-card');
    const skeleton = document.querySelector('.feed-loading-skeleton');
    const empty = document.querySelector('.feed-empty-state-card');
    const res = [];
    cards.forEach((c, idx) => {
      const author = c.querySelector('.author-display-name')?.innerText;
      const title = c.querySelector('.post-card-title')?.innerText;
      const body = c.querySelector('.post-caption-text')?.innerText;
      const likes = c.querySelector('button')?.innerText;
      res.push({ idx, author, title, bodySnippet: body?.substring(0, 30) });
    });
    return {
      cardCount: cards.length,
      hasSkeleton: !!skeleton,
      hasEmpty: !!empty,
      posts: res
    };
  });

  console.log('Posts Info:', JSON.stringify(postsInfo, null, 2));

  await browser.close();
}

testPostElements();
