const { chromium } = require('playwright');

async function checkVisibility() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const visibilityReport = await page.evaluate(() => {
    const stream = document.querySelector('.feed-posts-stream');
    if (!stream) return { error: 'stream not found' };

    const rect = stream.getBoundingClientRect();
    const style = window.getComputedStyle(stream);

    // Check ancestors
    const ancestors = [];
    let curr = stream;
    while (curr) {
      const cStyle = window.getComputedStyle(curr);
      const cRect = curr.getBoundingClientRect();
      ancestors.push({
        tag: curr.tagName,
        id: curr.id,
        className: curr.className,
        display: cStyle.display,
        visibility: cStyle.visibility,
        opacity: cStyle.opacity,
        rect: { width: Math.round(cRect.width), height: Math.round(cRect.height), top: Math.round(cRect.top) }
      });
      curr = curr.parentElement;
    }

    return {
      streamRect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      streamStyle: { display: style.display, visibility: style.visibility, opacity: style.opacity },
      ancestors
    };
  });

  console.log('Visibility Report:\n', JSON.stringify(visibilityReport, null, 2));
  await browser.close();
}

checkVisibility();
