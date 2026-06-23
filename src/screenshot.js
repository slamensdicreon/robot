import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let chromiumPromise = null;
// Serverless functions can't run Chromium, so don't even load Playwright there.
let browserUnavailable = Boolean(process.env.VERCEL);

/**
 * Lazily launch a shared headless Chromium. Returns null (once) if Playwright
 * or its browser binary is not installed, so the pipeline can degrade to
 * HTML-only scoring instead of crashing.
 */
async function getBrowser() {
  if (browserUnavailable) return null;
  if (!chromiumPromise) {
    chromiumPromise = (async () => {
      try {
        const { chromium } = await import('playwright');
        return await chromium.launch({ args: ['--no-sandbox'] });
      } catch (err) {
        browserUnavailable = true;
        console.warn(
          `[screenshot] Headless Chromium unavailable, skipping captures: ${err.message}`
        );
        return null;
      }
    })();
  }
  return chromiumPromise;
}

export function screenshotsEnabled() {
  return !browserUnavailable;
}

function ensureDir(p) {
  if (p.startsWith('s3://')) return; // S3 driver is a future phase
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Capture desktop + mobile screenshots for a URL.
 * Returns { desktopPath, mobilePath, hasViewportMeta, hasMobileMenu, mobileResponsive }.
 * Any field may be null when capture is unavailable.
 */
export async function captureScreenshots(url, accountId) {
  const browser = await getBrowser();
  if (!browser) {
    return {
      desktopPath: null,
      mobilePath: null,
      desktopBase64: null,
      mobileResponsive: null,
    };
  }

  const storeDir = config.screenshotStoragePath;
  ensureDir(storeDir);

  const result = {
    desktopPath: null,
    mobilePath: null,
    desktopBase64: null,
    mobileResponsive: null,
  };

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: config.desktopViewport,
  });

  try {
    const page = await context.newPage();
    await gotoIdle(page, url);

    const desktopFile = path.join(storeDir, `${accountId}-desktop.jpg`);
    const desktopBuffer = await page.screenshot({
      type: 'jpeg',
      quality: config.screenshotQuality,
    });
    const scaledDesktop = await scaleJpeg(page, desktopBuffer);
    if (!storeDir.startsWith('s3://')) fs.writeFileSync(desktopFile, scaledDesktop);
    result.desktopPath = desktopFile;
    result.desktopBase64 = scaledDesktop.toString('base64');

    // Mobile viewport capture (PRD 4.3.4).
    await page.setViewportSize(config.mobileViewport);
    await page.waitForTimeout(500);
    const mobileBuffer = await page.screenshot({
      type: 'jpeg',
      quality: config.screenshotQuality,
    });
    const mobileFile = path.join(storeDir, `${accountId}-mobile.jpg`);
    if (!storeDir.startsWith('s3://')) fs.writeFileSync(mobileFile, mobileBuffer);
    result.mobilePath = mobileFile;

    // Crude responsiveness heuristic: identical byte length => no adaptation.
    result.mobileResponsive = Math.abs(mobileBuffer.length - desktopBuffer.length) > 1024;
  } catch (err) {
    console.warn(`[screenshot] capture failed for ${url}: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }

  return result;
}

async function gotoIdle(page, url) {
  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: config.screenshotMaxWaitMs,
    });
  } catch {
    // networkidle may never settle within budget; capture whatever rendered.
  }
}

// Scale to storeWidth using the page's canvas. Falls back to original buffer.
async function scaleJpeg(page, buffer) {
  try {
    const base64 = buffer.toString('base64');
    const scaled = await page.evaluate(
      async ({ dataUrl, targetWidth, quality }) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = dataUrl;
        });
        const ratio = targetWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      },
      {
        dataUrl: `data:image/jpeg;base64,${base64}`,
        targetWidth: config.screenshotStoreWidth,
        quality: config.screenshotQuality / 100,
      }
    );
    return Buffer.from(scaled.split(',')[1], 'base64');
  } catch {
    return buffer;
  }
}

export async function closeBrowser() {
  if (chromiumPromise) {
    const browser = await chromiumPromise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
  }
}
