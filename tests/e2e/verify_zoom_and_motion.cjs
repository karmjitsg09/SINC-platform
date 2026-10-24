const { chromium } = require('playwright');

async function testZoom() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:3000/login');
  await page.fill('input#email', 'user.a.test@gmail.com');
  await page.fill('input#password', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  console.log('Testing Zoom Levels...');
  for (const z of [1.0, 1.25, 1.5, 2.0]) {
    await page.evaluate(zf => { document.body.style.zoom = String(zf); }, z);
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav-container');
      const side = document.querySelector('.sidebar-navigation');
      return {
        sideVisible: Boolean(side && side.getBoundingClientRect().width > 0),
        navHidden: Boolean(nav && nav.classList.contains('bottom-nav-hidden')),
        scrollPadding: document.querySelector('.sinc-viewport-scroll-area')?.style.paddingBottom
      };
    });
    console.log(`Zoom ${z * 100}%: sideVisible=${res.sideVisible}, navHidden=${res.navHidden}, padding=${res.scrollPadding}`);
  }

  // Toggle collapse at 150% zoom
  console.log('\nToggling sidebar at 150% zoom...');
  await page.evaluate(() => { document.body.style.zoom = '1.5'; });
  await page.locator('.sidebar-toggle-btn').click();
  await page.waitForTimeout(400);

  const toggledRes = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-container');
    const side = document.querySelector('.sidebar-navigation');
    return {
      sideVisible: Boolean(side && !side.classList.contains('sidebar-collapsed')),
      navHidden: Boolean(nav && nav.classList.contains('bottom-nav-hidden')),
      navVisible: Boolean(nav && window.getComputedStyle(nav).visibility === 'visible'),
      scrollPadding: document.querySelector('.sinc-viewport-scroll-area')?.style.paddingBottom
    };
  });
  console.log(`At 150% zoom collapsed: sideVisible=${toggledRes.sideVisible}, navHidden=${toggledRes.navHidden}, navVisible=${toggledRes.navVisible}, padding=${toggledRes.scrollPadding}`);

  await browser.close();
  console.log('✓ Zoom testing complete.');
}

testZoom().catch(e => { console.error(e); process.exit(1); });
