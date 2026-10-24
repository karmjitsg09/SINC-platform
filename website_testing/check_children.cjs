const { chromium } = require('playwright');

async function checkChildren() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  const inner = await page.evaluate(() => {
    const stream = document.querySelector('.feed-posts-stream');
    return {
      innerHTML: stream ? stream.innerHTML : null,
      childrenCount: stream ? stream.children.length : 0,
      postCards: document.querySelectorAll('.feed-post-card').length,
      emptyState: !!document.querySelector('.feed-empty-state-card'),
      skeleton: !!document.querySelector('.feed-loading-skeleton')
    };
  });

  console.log('Stream Inner Content:', JSON.stringify(inner, null, 2));
  await browser.close();
}

checkChildren();
