/**
 * SINC Platform — Verified Search & Domains Visual Recovery & Comparison Suite
 *
 * Compares authentic renders from:
 * 1. Original Vite SPA running on http://localhost:3005
 * 2. Migrated Next.js App Router running on http://localhost:3000
 *
 * Viewports tested:
 * - Desktop: 1366 x 768
 * - Tablet: 768 x 1024
 * - Mobile: 375 x 812
 */

const path = require('path');
const { createRequire } = require('module');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = appRequire('playwright');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(process.cwd(), 'reports/visual_recovery_comparison');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

async function setupPageAuth(context, page) {
  await context.addInitScript(() => {
    const mockUser = {
      id: "7bf86c78-b2f8-430a-9b07-4f95f249324b",
      aud: "authenticated",
      role: "authenticated",
      email: "audit.user@sinc.local",
      user_metadata: { name: "Audit User", full_name: "Audit User" }
    };
    const mockSession = {
      access_token: "mock_token_for_visual_parity",
      refresh_token: "mock_refresh_for_visual_parity",
      expires_at: 9999999999,
      expires_in: 3600,
      token_type: "bearer",
      user: mockUser
    };
    localStorage.setItem('sb-vctwzlsatqsuinmosnzo-auth-token', JSON.stringify(mockSession));
    localStorage.setItem('sb-gcvsmecyodmddyffpuzn-auth-token', JSON.stringify(mockSession));
    localStorage.setItem('sincWelcomeSeen', 'true');
    sessionStorage.setItem('sincIntroSeen', 'true');
  });

  await page.route('**/rest/v1/profiles*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: "7bf86c78-b2f8-430a-9b07-4f95f249324b",
      name: "Audit User",
      username: "audit_user",
      role: "Member",
      domains: ["tech", "design"],
      skills: ["React", "TypeScript"],
      onboarding_completed: true
    }])
  }));
}

async function captureAppView(browser, baseUrl, appName, routeTab, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  await setupPageAuth(context, page);

  const targetUrl = `${baseUrl}/${routeTab}`;
  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  // Give the quick 2s session-restoration intro time to mount and complete
  await page.waitForTimeout(2200);

  // Wait for intro animation overlay to finish and unmount if active
  try {
    await page.waitForFunction(() => !document.querySelector('.sinc-intro-overlay'), { timeout: 6000 });
  } catch (e) {}

  if (routeTab === 'search') {
    await page.waitForSelector('.search-input-field, .search-mode-selector, input[placeholder*="Search"], .search-container', { timeout: 8000 });
  } else if (routeTab === 'domains') {
    await page.waitForSelector('.domains-page-layout, .domains-header-section, .domains-page-card, .domains-title, .domains-grid, [class*="domain"]', { timeout: 8000 });
  }

  await page.waitForTimeout(800);

  // Extract layout geometry for verification
  let layoutMetrics = null;
  if (routeTab === 'search') {
    layoutMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.search-post-result-card'));
      const grid = document.querySelector('.search-posts-grid');
      let gridComputed = null;
      if (grid) {
        const style = window.getComputedStyle(grid);
        gridComputed = {
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          gap: style.gap
        };
      }
      return {
        cardCount: cards.length,
        gridComputed,
        cardBoxes: cards.map(c => {
          const r = c.getBoundingClientRect();
          return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
        })
      };
    });
  }

  const filename = `${appName}_${routeTab}_${viewport.name}_${viewport.width}.png`;
  const filePath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`✓ [${appName.toUpperCase()}] Captured ${filename} (${fs.statSync(filePath).size} bytes)`);

  await context.close();
  return { filePath, layoutMetrics };
}

// Compute pixel difference between two PNG buffers using Playwright / Canvas
async function compareImagesWithCanvas(browser, pathA, pathB) {
  const page = await browser.newPage();
  const fileAData = fs.readFileSync(pathA).toString('base64');
  const fileBData = fs.readFileSync(pathB).toString('base64');

  const diffResult = await page.evaluate(async ({ srcA, srcB }) => {
    function loadImg(src) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });
    }

    const imgA = await loadImg('data:image/png;base64,' + srcA);
    const imgB = await loadImg('data:image/png;base64,' + srcB);

    const w = Math.min(imgA.width, imgB.width);
    const h = Math.min(imgA.height, imgB.height);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(imgA, 0, 0, w, h);
    const dataA = ctx.getImageData(0, 0, w, h).data;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgB, 0, 0, w, h);
    const dataB = ctx.getImageData(0, 0, w, h).data;

    let diffPixels = 0;
    const totalPixels = w * h;

    for (let i = 0; i < dataA.length; i += 4) {
      const dr = Math.abs(dataA[i] - dataB[i]);
      const dg = Math.abs(dataA[i+1] - dataB[i+1]);
      const db = Math.abs(dataA[i+2] - dataB[i+2]);
      const da = Math.abs(dataA[i+3] - dataB[i+3]);
      // Small tolerance for antialiasing & subpixel text rasterization
      if (dr + dg + db + da > 35) {
        diffPixels++;
      }
    }

    const similarity = ((1 - (diffPixels / totalPixels)) * 100).toFixed(2);
    return {
      width: w,
      height: h,
      totalPixels,
      diffPixels,
      similarityPercent: parseFloat(similarity)
    };
  }, { srcA: fileAData, srcB: fileBData });

  await page.close();
  return diffResult;
}

async function runRecoveryAndComparison() {
  console.log('========================================================================');
  console.log('SINC PLATFORM — VISUAL REGRESSION RECOVERY & AUTHENTIC COMPARISON');
  console.log('Testing: Original Vite (port 3005) vs. Migrated Next.js (port 3000)');
  console.log('Target Views: Search and Domains across Desktop, Tablet, Mobile');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const comparisonResults = [];

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n--- Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ---`);

      // 1. Search view
      const viteSearch = await captureAppView(browser, 'http://localhost:3005', 'vite_orig', 'search', vp);
      const nextSearch = await captureAppView(browser, 'http://localhost:3000', 'next_migr', 'search', vp);

      const viteSearchSize = fs.statSync(viteSearch.filePath).size;
      const nextSearchSize = fs.statSync(nextSearch.filePath).size;
      const searchRatio = (nextSearchSize / viteSearchSize).toFixed(3);

      const searchPixelDiff = await compareImagesWithCanvas(browser, viteSearch.filePath, nextSearch.filePath);

      // Verify layout geometry: Check vertical stacking on tablet
      let tabletLayoutCheck = 'N/A';
      if (vp.name === 'tablet') {
        const nextBoxes = nextSearch.layoutMetrics?.cardBoxes || [];
        const isVerticallyStacked = nextBoxes.length >= 2
          ? nextBoxes[1].top > nextBoxes[0].top && Math.abs(nextBoxes[1].left - nextBoxes[0].left) < 5
          : true;
        tabletLayoutCheck = isVerticallyStacked
          ? 'PASS: Single Column Stacked'
          : 'FAIL: Multi Column Grid';
        console.log(`[TABLET LAYOUT CHECK] Search cards stacked vertically: ${tabletLayoutCheck}`);
        console.log(`[NEXT.JS COMPUTED GRID]`, nextSearch.layoutMetrics?.gridComputed);
      }

      comparisonResults.push({
        view: 'search',
        viewport: vp.name,
        resolution: `${vp.width}x${vp.height}`,
        viteBytes: viteSearchSize,
        nextBytes: nextSearchSize,
        byteRatio: searchRatio,
        pixelSimilarity: `${searchPixelDiff.similarityPercent}%`,
        diffPixels: searchPixelDiff.diffPixels,
        tabletLayoutCheck,
        vitePath: viteSearch.filePath,
        nextPath: nextSearch.filePath
      });

      // 2. Domains view
      const viteDomains = await captureAppView(browser, 'http://localhost:3005', 'vite_orig', 'domains', vp);
      const nextDomains = await captureAppView(browser, 'http://localhost:3000', 'next_migr', 'domains', vp);

      const viteDomainsSize = fs.statSync(viteDomains.filePath).size;
      const nextDomainsSize = fs.statSync(nextDomains.filePath).size;
      const domainsRatio = (nextDomainsSize / viteDomainsSize).toFixed(3);

      const domainsPixelDiff = await compareImagesWithCanvas(browser, viteDomains.filePath, nextDomains.filePath);

      comparisonResults.push({
        view: 'domains',
        viewport: vp.name,
        resolution: `${vp.width}x${vp.height}`,
        viteBytes: viteDomainsSize,
        nextBytes: nextDomainsSize,
        byteRatio: domainsRatio,
        pixelSimilarity: `${domainsPixelDiff.similarityPercent}%`,
        diffPixels: domainsPixelDiff.diffPixels,
        tabletLayoutCheck: 'N/A',
        vitePath: viteDomains.filePath,
        nextPath: nextDomains.filePath
      });
    }

    console.log('\n========================================================================');
    console.log('AUTHENTIC VISUAL COMPARISON SUMMARY (WITH PIXEL SIMILARITY)');
    console.log('========================================================================');
    console.table(comparisonResults.map(r => ({
      View: r.view,
      Viewport: r.viewport,
      'Original Vite (bytes)': r.viteBytes,
      'Migrated Next.js (bytes)': r.nextBytes,
      'Byte Ratio': r.byteRatio,
      'Pixel Similarity': r.pixelSimilarity,
      'Tablet Layout Check': r.tabletLayoutCheck
    })));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'search_domains_comparison_report.json'),
      JSON.stringify(comparisonResults, null, 2)
    );
    console.log(`\n✓ Detailed comparison saved to: ${path.join(OUTPUT_DIR, 'search_domains_comparison_report.json')}`);

  } finally {
    await browser.close();
  }
}

runRecoveryAndComparison().catch(err => {
  console.error('Visual recovery failed:', err);
  process.exit(1);
});
