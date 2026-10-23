const { chromium } = require('playwright');

async function testSubscribe() {
  const vapidPublicKey = 'BKd8ugnmQaYtu0mReGLVHEqLvyEBG9EOPWsV2bh8QctlG1GTfN4IkOl0NVTBKUtzWZsi36BIoYfCFQiGdslZ6FQ';
  
  // Launch with background networking enabled so FCM connection can establish
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    ignoreDefaultArgs: ['--disable-background-networking', '--disable-component-update'],
    args: ['--enable-features=PushMessaging']
  });
  
  const context = await browser.newContext();
  await context.grantPermissions(['notifications'], { origin: 'http://localhost:3003' });

  const page = await context.newPage();
  await page.goto('http://localhost:3003/');

  // Wait a second for SW registration and FCM client initialization
  const subResult = await page.evaluate(async (publicKey) => {
    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Allow background network to settle
      await new Promise(r => setTimeout(r, 1000));

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const p256dhKey = sub.getKey('p256dh');
      const authKey = sub.getKey('auth');

      return {
        success: true,
        endpoint: sub.endpoint,
        p256dh: p256dhKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(p256dhKey))) : null,
        auth: authKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(authKey))) : null
      };
    } catch (err) {
      return { success: false, error: err.name + ': ' + err.message };
    }
  }, vapidPublicKey);

  console.log('Subscribe result with background networking:', subResult);
  await browser.close();
}

testSubscribe().catch(console.error);
