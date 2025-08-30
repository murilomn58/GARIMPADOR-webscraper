import { Browser, BrowserContext, Page } from 'playwright';
import { openBrowser, humanDelay, tryClosePopups } from '../agent/human';
import { memlog } from '../utils/logger';
import { progressStore } from '../utils/progress';
import { Produto } from '../schemas/product';
import { SCRAPERS } from '../scrapers';

export type RunBody = {
  marketplace: keyof typeof SCRAPERS;
  query: string;
  pages: number;
  products: number;
  sampleRandomPages: boolean;
  clearCookies: boolean;
  timeouts: { connect: number; load: number };
  headless: boolean;
  proxy: string | null;
  debug?: boolean;
};

export class ScrapeManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private stopRequested = false;
  private data: Produto[] = [];
  private runId: string | null = null;
  private screenshotsDir: string | null = null;

  getData() { return this.data; }
  requestStop() { this.stopRequested = true; }
  isRunning() { return progressStore.get().running; }

  async run(body: RunBody) {
    if (this.isRunning()) throw new Error('Job já em execução');
    this.stopRequested = false;
    this.data = [];
    this.runId = new Date().toISOString().replace(/[:.]/g, '-');
    const fs = await import('fs');
    const path = await import('path');
    this.screenshotsDir = path.join(process.cwd(), 'logs', 'screenshots', this.runId!);
    fs.mkdirSync(this.screenshotsDir, { recursive: true });
    progressStore.set({
      running: true, marketplace: body.marketplace, query: body.query,
      pagesTarget: body.pages, productsTarget: body.products,
      pagesVisited: 0, productsCollected: 0, resultsFound: 0, percent: 0, currentItem: null,
      intervencaoNecessaria: false,
      screenshots: [],
      debug: body.debug ?? true,
      runId: this.runId,
    });
    memlog.push('info', `Iniciando job: ${body.marketplace} '${body.query}' p=${body.pages} n=${body.products}`);

    const scraper = SCRAPERS[body.marketplace];
    const { browser, context } = await openBrowser({
      connectTimeoutSec: body.timeouts.connect,
      loadTimeoutSec: body.timeouts.load,
      headless: body.headless ?? false,
      proxy: body.proxy ?? undefined,
    });
    this.browser = browser; this.context = context;
    if (body.clearCookies) {
      try { await context.clearCookies(); } catch {}
    }
    const page = await context.newPage();
    try {
      await scraper.search(page, { query: body.query, pages: body.pages, products: body.products, sampleRandomPages: body.sampleRandomPages, timeouts: body.timeouts });
      let pageIndex = 1;
      let collected = 0;
      let totalResults = 0;
      while (!this.stopRequested && pageIndex <= body.pages && collected < body.products) {
        const links = await scraper.collectListingLinks(page);
        memlog.push('info', `Página ${pageIndex}: ${links.length} links`);
        totalResults += links.length;
        progressStore.set({ resultsFound: totalResults });
        for (const url of links) {
          if (this.stopRequested || collected >= body.products) break;
          const p = await context.newPage();
          try {
            // Retry com backoff exponencial
            let prod: Produto | null = null;
            for (let attempt=1; attempt<=3; attempt++) {
              try {
                // Navega com referer da página de listagem para reduzir bloqueios
                const referer = page.url();
                try {
                  await p.goto(url, { waitUntil: 'domcontentloaded', referer, timeout: body.timeouts.load * 1000 });
                } catch {}
                prod = await scraper.parseProductPage(p, url, body.query, pageIndex);
                // detectar captcha/wall
                const html = await p.content();
                if (/captcha|recaptcha|verify you are a human/i.test(html)) {
                  memlog.push('warn', `Captcha/wall detectado em ${url}`);
                  progressStore.set({ intervencaoNecessaria: true });
                  if (body.debug && this.screenshotsDir) {
                    const file = `${this.screenshotsDir}/captcha-${collected + 1}.png`;
                    await p.screenshot({ path: file, fullPage: true }).catch(()=>{});
                    const fs = await import('fs');
                    fs.writeFileSync(`${this.screenshotsDir}/captcha-${collected + 1}.html`, html);
                    const st = progressStore.get();
                    progressStore.set({ screenshots: [...(st.screenshots||[]), file] });
                  }
                }
                break;
              } catch (e:any) {
                const delay = 500 * Math.pow(2, attempt-1);
                memlog.push('warn', `Retry produto (${attempt}) após erro: ${e?.message || e}. Aguardando ${delay}ms`);
                if (body.debug && this.screenshotsDir) {
                  const file = `${this.screenshotsDir}/error-attempt${attempt}-${collected + 1}.png`;
                  await p.screenshot({ path: file, fullPage: true }).catch(()=>{});
                  const fs = await import('fs');
                  const html = await p.content().catch(()=>null);
                  if (html) fs.writeFileSync(`${this.screenshotsDir}/error-attempt${attempt}-${collected + 1}.html`, html);
                  const st = progressStore.get();
                  progressStore.set({ screenshots: [...(st.screenshots||[]), file] });
                }
                await new Promise(r => setTimeout(r, delay));
              }
            }
            if (!prod) {
              // Fallback: tentar clicar no próprio listing
              try {
                await page.bringToFront();
                const locator = page.locator(`a[href='${url}']`).first();
                const exists = await locator.count().then(c => c > 0).catch(()=>false);
                if (exists) {
                  memlog.push('info', 'Fallback: clicando link no listing');
                  await Promise.all([
                    page.waitForLoadState('domcontentloaded', { timeout: body.timeouts.load * 1000 }).catch(()=>{}),
                    locator.click({ timeout: body.timeouts.load * 1000 }).catch(()=>{}),
                  ]);
                  tryClosePopups(page as any).catch?.(()=>{});
                  await humanDelay();
                  prod = await scraper.parseProductPage(page, page.url(), body.query, pageIndex);
                  // voltar para a listagem
                  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(()=>{});
                }
              } catch (e:any) {
                memlog.push('warn', `Fallback click falhou: ${e?.message || e}`);
              }
            }
            if (prod) {
              this.data.push(prod);
              collected++;
              progressStore.set({ productsCollected: collected, currentItem: prod });
              if (body.debug) {
                console.log(`Coletado: ${prod.nome} (${prod.url})`);
              }
            }
          } catch (e: any) {
            memlog.push('warn', `Erro produto: ${e?.message || e}`);
            if (body.debug && this.screenshotsDir) {
              const file = `${this.screenshotsDir}/fatal-${collected + 1}.png`;
              await p.screenshot({ path: file, fullPage: true }).catch(()=>{});
              const fs = await import('fs');
              const html = await p.content().catch(()=>null);
              if (html) fs.writeFileSync(`${this.screenshotsDir}/fatal-${collected + 1}.html`, html);
              const st = progressStore.get();
              progressStore.set({ screenshots: [...(st.screenshots||[]), file] });
            }
          } finally { await p.close(); }
          progressStore.set({ percent: Math.min(100, Math.floor((collected / body.products) * 100)) });
          await humanDelay();
        }
        progressStore.set({ pagesVisited: pageIndex });
        if (collected >= body.products) break;
        const next = await scraper.goToNextPage(page, pageIndex);
        if (!next) break;
        pageIndex++;
      }
    } catch (e: any) {
      memlog.push('error', `Falha no run: ${e?.message || e}`);
    } finally {
      progressStore.set({ running: false, percent: 100 });
      await page.close().catch(()=>{});
      await context.close().catch(()=>{});
      await browser.close().catch(()=>{});
      this.browser = null; this.context = null;
    }
  }
}

export const manager = new ScrapeManager();
