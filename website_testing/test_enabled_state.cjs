const { chromium } = require('playwright');
const path = require('path');

async function testEnabledStateUI() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Mock getRegistration before loading
  await page.addInitScript(() => {
    window.Notification = {
      permission: 'granted',
      requestPermission: async () => 'granted'
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration = async () => ({
        scope: 'http://localhost:3003/',
        pushManager: {
          getSubscription: async () => ({
            endpoint: 'https://fcm.googleapis.com/fcm/send/active-device-token',
            getKey: () => new Uint8Array([1, 2, 3]),
            unsubscribe: async () => true
          })
        }
      });
    }
  });

  // Sign in
  await page.goto('http://localhost:3003/login');
  await page.waitForSelector('input#email', { timeout: 15000 });
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to settings
  await page.goto('http://localhost:3003/settings');
  await page.waitForTimeout(2000);

  // Click Notifications tab
  const notifTab = page.locator('.settings-nav-item').filter({ hasText: 'Notifications & Web Push' }).first();
  await notifTab.click();
  await page.waitForTimeout(1500);

  // Take screenshot of settings enabled view
  const ss = path.resolve(__dirname, 'web_push_settings_enabled.png');
  await page.screenshot({ path: ss });
  console.log('Saved enabled screenshot to website_testing/web_push_settings_enabled.png');

  await browser.close();
}

testEnabledStateUI().catch(console.error);
