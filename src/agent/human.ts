import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { pickUserAgent, randomViewport } from '../utils/userAgents';
import { memlog } from '../utils/logger';

export type BrowserParams = {
  connectTimeoutSec: number;
  loadTimeoutSec: number;
  headless: boolean;
  proxy?: string | null;
};

export async function openBrowser(params: BrowserParams): Promise<{ browser: Browser, context: BrowserContext }>{
  const ua = pickUserAgent();
  const viewport = randomViewport();
  const proxy = params.proxy ? { server: params.proxy } : undefined;

  memlog.push('info', `Abrindo navegador headless=${params.headless} viewport=${viewport.width}x${viewport.height}`);
  const browser = await chromium.launch({ headless: params.headless, proxy, timeout: params.connectTimeoutSec * 1000 });
  const context = await browser.newContext({ userAgent: ua, viewport });
  return { browser, context };
}

export async function humanDelay(min = 300, max = 1200) {
  const jitter = Math.random() * 200;
  const ms = Math.floor(min + Math.random() * (max - min) + jitter);
  await new Promise(r => setTimeout(r, ms));
}

export async function scrollIncremental(page: Page, steps = 5) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const delta = Math.max(200, Math.floor(height / steps));
  for (let y = 0; y < height; y += delta) {
    await page.mouse.wheel(0, delta);
    await humanDelay();
  }
}

export async function tryClosePopups(page: Page) {
  const selectors = [
    'button[aria-label="Close"]',
    'button:has-text("Fechar")',
    'button:has-text("Aceitar")',
    '#onetrust-accept-btn-handler',
    'button[aria-label="dismiss"]',
    '.close, .modal-close, .x-close'
  ];
  for (const sel of selectors) {
    try { if (await page.locator(sel).first().isVisible()) await page.locator(sel).first().click({ timeout: 1500 }); } catch {}
  }
}

