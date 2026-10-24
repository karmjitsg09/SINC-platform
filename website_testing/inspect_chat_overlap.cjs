const { chromium } = require('playwright');
const path = require('path');

async function inspectLayout() {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: 'desktop_1366x768', width: 1366, height: 768 },
    { name: 'desktop_1024x768', width: 1024, height: 768 },
    { name: 'tablet_768x900', width: 768, height: 900 },
    { name: 'mobile_600x800', width: 600, height: 800 },
    { name: 'mobile_400x800', width: 400, height: 800 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    
    // Close sidebar on mobile
    await page.addInitScript(() => {
      localStorage.setItem('sinc_left_sidebar_open', 'false');
    });

    // Login as Account A
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input#email', { timeout: 10000 });
    await page.fill('input#email', 'user.a.test@gmail.com');
    await page.fill('input#password', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to home
    await page.waitForTimeout(2000);

    // Direct navigate to /messages
    await page.goto('http://localhost:3000/messages');
    await page.waitForTimeout(2000);

    // Click first conversation row
    const convRow = page.locator('.conv-row-item').first();
    await convRow.waitFor({ state: 'visible', timeout: 10000 });
    await convRow.click();
    await page.waitForTimeout(1500);

    // Capture screenshot
    const shotPath = path.join(__dirname, `current_layout_${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    // Inspect metrics
    const metrics = await page.evaluate(() => {
      const getBox = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: sel,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          position: style.position,
          zIndex: style.zIndex,
          display: style.display,
          paddingBottom: style.paddingBottom,
          marginBottom: style.marginBottom
        };
      };

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        appShell: getBox('.sinc-app-shell'),
        mainViewport: getBox('.sinc-main-viewport'),
        scrollArea: getBox('.sinc-viewport-scroll-area'),
        msgContainer: getBox('.messaging-desktop-container'),
        chatPanel: getBox('.messaging-chat-panel'),
        chatHeader: getBox('.active-chat-header'),
        chatStream: getBox('.active-chat-stream'),
        chatComposer: getBox('.active-chat-composer'),
        composerInput: getBox('.chat-composer-input'),
        sendBtn: getBox('.chat-send-btn'),
        bottomNavContainer: getBox('.bottom-nav-container'),
        bottomNav: getBox('.bottom-nav')
      };
    });

    console.log(`\n======================================================`);
    console.log(`Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);
    console.log('Composer:', metrics.chatComposer);
    console.log('BottomNavContainer:', metrics.bottomNavContainer);
    console.log('BottomNav:', metrics.bottomNav);

    if (metrics.chatComposer && metrics.bottomNav) {
      const composerBottom = metrics.chatComposer.bottom;
      const composerTop = metrics.chatComposer.top;
      const navTop = metrics.bottomNav.top;
      const navBottom = metrics.bottomNav.bottom;

      // Check overlap in both Y and X
      const overlapY = !(composerBottom <= navTop || composerTop >= navBottom);
      const overlapPixels = overlapY ? Math.min(composerBottom, navBottom) - Math.max(composerTop, navTop) : 0;

      console.log(`>>> OVERLAP DETECTED? ${overlapY} (Overlapping height: ${overlapPixels}px)`);
      console.log(`Composer Y range: [${composerTop}px to ${composerBottom}px]`);
      console.log(`BottomNav Y range: [${navTop}px to ${navBottom}px]`);
      console.log(`Is Send Button covered? Nav sits from ${navTop}px to ${navBottom}px while Send button sits from ${metrics.sendBtn?.top}px to ${metrics.sendBtn?.bottom}px`);
    }

    await page.close();
  }

  await browser.close();
}

inspectLayout().catch(console.error);
