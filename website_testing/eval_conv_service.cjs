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

  // Evaluate in page context
  const result = await page.evaluate(async () => {
    try {
      // Import conversationService
      const convModule = await import('/src/messaging/services/conversationService.js');
      const userAId = '7bf86c78-b2f8-430a-9b07-4f95f249324b';
      const userBId = '7a8ebb05-9424-44a8-b96b-0beeb7da6c7b';
      console.log('Directly invoking getOrCreateDirectConversation...');
      const res = await convModule.getOrCreateDirectConversation(userAId, userBId);
      console.log('Result of getOrCreateDirectConversation:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('Evaluation error:', e);
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Node received result:', result);
  await browser.close();
})();
