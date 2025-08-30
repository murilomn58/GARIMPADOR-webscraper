import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';

const SELECTORS = {
  searchInput: 'input[type="search"], input[name*="search" i], input#search-input',
  productCards: [
    'a[href*="/produto/"]',
    'a[href*="/p/" i]',
    'a[class*="product" i]'
  ].join(', '),
  nextPage: [
    'a[rel="next"]',
    'a[aria-label*="Próxima" i]',
    'button[aria-label*="Próxima" i]'
  ].join(', ')
};

export const CarrefourScraper: Scraper = {
  name: 'Carrefour',
  homeUrl: 'https://www.carrefour.com.br/',
  selectors: SELECTORS,

  async search(page: Page, params) {
    await page.goto(this.homeUrl, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
    await tryClosePopups(page);
    const input = page.locator(SELECTORS.searchInput).first();
    try {
      await input.waitFor({ timeout: params.timeouts.load * 1000 });
      await input.click();
      await input.fill(params.query);
      await humanDelay(200, 600);
      await page.keyboard.press('Enter');
      await page.waitForLoadState('domcontentloaded', { timeout: params.timeouts.load * 1000 });
    } catch {
      const q = encodeURIComponent(params.query);
      await page.goto(`https://www.carrefour.com.br/busca/${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
    }
    await page.locator(SELECTORS.productCards).first().waitFor({ timeout: params.timeouts.load * 1000 }).catch(()=>{});
  },

  async collectListingLinks(page: Page) {
    await scrollIncremental(page, 6);
    const links = await page.locator(SELECTORS.productCards).evaluateAll((as: any[]) =>
      as.map(a => (a as HTMLAnchorElement).href).filter(Boolean)
    );
    return Array.from(new Set(links));
  },

  async goToNextPage(page: Page) {
    try {
      const next = page.locator(SELECTORS.nextPage).first();
      if (await next.isVisible()) {
        await next.click();
        await page.waitForLoadState('domcontentloaded');
        await page.locator(SELECTORS.productCards).first().waitFor({ timeout: 3000 }).catch(()=>{});
        return true;
      }
    } catch (e) {
      memlog.push('warn', `Carrefour: não achou botão próxima página`);
    }
    return false;
  },

  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      if (!/\/(p|produto)\//.test(page.url())) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      await tryClosePopups(page);
      await scrollIncremental(page, 5);

      const titleSel = 'h1, [data-testid*="title" i], [itemprop="name"]';
      const priceSel = '[data-testid*="price" i], [class*="price" i], [itemprop="price"]';
      const ratingSel = '[data-testid*="rating" i], [class*="rating" i]';
      const imageSel = 'img[src^="http" i]';

      const nome = (await page.locator(titleSel).first().textContent())?.trim() || 'Produto';
      let precoText = (await page.locator(priceSel).first().textContent())?.trim() || null;
      if (!precoText) precoText = await page.locator('[itemprop="price"]').first().getAttribute('content').catch(()=>null);
      const preco = normalizePriceBRL(precoText);
      const notaText = (await page.locator(ratingSel).first().textContent())?.trim() || null;
      const nota = normalizeRating(notaText);
      const imagem = await page.locator(imageSel).first().getAttribute('src');
      const descricao = await page.locator('meta[name="description"]').getAttribute('content');

      const caracteristicas: Record<string, string> = {};
      const specBlocks = page.locator('section, div, table, dl');
      const n = await specBlocks.count();
      for (let i=0; i<n && i<12; i++) {
        try {
          const html = await specBlocks.nth(i).innerHTML();
          if (!/(ficha|especifica|caracter|técnic|tecnic|spec)/i.test(html)) continue;
          const kvPairs = await specBlocks.nth(i).locator('tr').evaluateAll((rows:any[]) => rows.map(r=>{
            const th = (r.querySelector('th')||r.querySelector('td'))?.textContent?.trim()||'';
            const td = (r.querySelectorAll('td')[1]||r.querySelector('td'))?.textContent?.trim()||'';
            return [th, td];
          }));
          for (const [k,v] of kvPairs) if (k && v) caracteristicas[k.toLowerCase()] = v;
          const dts = await specBlocks.nth(i).locator('dt').allTextContents().catch(()=>[]);
          const dds = await specBlocks.nth(i).locator('dd').allTextContents().catch(()=>[]);
          for (let j=0; j<Math.min(dts.length, dds.length); j++) {
            const k = dts[j].trim(); const v = dds[j].trim();
            if (k && v) caracteristicas[k.toLowerCase()] = v;
          }
        } catch {}
      }

      const getFromSpecs = (...keys: string[]) => {
        const hay = Object.keys(caracteristicas);
        for (const k of keys) { const found = hay.find(h => h.includes(k)); if (found) return caracteristicas[found]; }
        return null;
      };

      const marca = getFromSpecs('marca','brand');
      const modelo = getFromSpecs('modelo','model');
      const fabricante = getFromSpecs('fabricante','manufacturer');
      const ean_gtin = extractEAN(getFromSpecs('ean','gtin','codigo de barras'));

      const imagens = await page.locator('img[src^="http" i]').evaluateAll((imgs:any[]) =>
        Array.from(new Set(imgs.map(i => (i as HTMLImageElement).src))).slice(0,8)
      ).catch(()=>null);

      const prod: Produto = {
        nome,
        preco,
        nota,
        avaliacoes: null,
        imagem: imagem ?? null,
        data: dayjs().toISOString(),
        url,
        palavra_busca: query,
        pagina_de_busca: pageIndex,
        probabilidade: scoreRelevancia(query, nome, descricao ?? undefined),
        passivel: heuristicaPassivel(nome, descricao ?? undefined, null),
        categoria: null,
        certificado: null,
        ean_gtin: ean_gtin ?? null,
        fabricante: fabricante ?? null,
        marca: marca ?? null,
        modelo: modelo ?? null,
        sch_modelo: null,
        sch_nome_comercial: null,
        caracteristicas: Object.keys(caracteristicas).length ? caracteristicas : null,
        descricao: descricao ?? null,
        sku: null,
        estado: null,
        estoque: null,
        imagens: imagens,
        product_id: null,
        vendedor: null,
      };
      return prod;
    } catch (e:any) {
      memlog.push('warn', `Carrefour parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};

