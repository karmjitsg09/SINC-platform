const { chromium } = require('playwright');

async function debugMessageClick() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));
  page.on('dialog', async d => {
    console.log('[DIALOG]', d.type(), d.message());
    await d.dismiss();
  });
  page.on('requestfailed', req => {
    console.error('[REQUEST FAILED]', req.method(), req.url(), req.failure()?.errorText);
  });

  try {
    console.log('1. Logging in as Account A...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input#email', 'user.a.test@gmail.com');
    await page.fill('input#password', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('Logged in. Current URL:', page.url());

    console.log('2. Navigating to User B Profile...');
    await page.goto('http://localhost:3000/profile/7a8ebb05-9424-44a8-b96b-0beeb7da6c7b');
    await page.waitForTimeout(3000);
    console.log('On profile. Current URL:', page.url());

    // Check message buttons available
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        className: b.className,
        disabled: b.disabled,
        parent: b.parentElement ? b.parentElement.className : null
      }));
    });
    console.log('Buttons on profile page:', JSON.stringify(buttons.filter(b => b.text.includes('Message') || b.text.includes('Chat')), null, 2));

    const messageBtn = page.locator('.profile-actions-toolbar button:has-text("Message")').first();
    console.log('Message button count in toolbar:', await messageBtn.count());
    if (await messageBtn.count() > 0) {
      console.log('Clicking toolbar Message button...');
      await messageBtn.click();
      console.log('Waiting 5s to see what happens...');
      await page.waitForTimeout(5000);
      console.log('URL after click:', page.url());
    } else {
      console.log('Toolbar button not found! Checking fallback button...');
      const fallbackBtn = page.locator('button:has-text("Message")').first();
      console.log('Fallback button text:', await fallbackBtn.innerText());
      await fallbackBtn.click();
      await page.waitForTimeout(5000);
      console.log('URL after fallback click:', page.url());
    }

    // Capture screenshot
    await page.screenshot({ path: 'website_testing/debug_click_result.png' });
    console.log('Screenshot saved to website_testing/debug_click_result.png');
  } catch (err) {
    console.error('Debug script error:', err);
  } finally {
    await browser.close();
  }
}

debugMessageClick();
