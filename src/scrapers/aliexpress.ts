import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';

const SELECTORS = {
  searchInput: 'input#search-words, input[name="SearchText"], input[type="search"], input[placeholder*="search" i]'
    ,
  productCards: 'a[href*="/item/"], a[href*="/i/"], a[ae_object_type], a._item'
    ,
  nextPage: 'a[aria-label*="Next" i], button:has-text("Next"), button:has-text("Próxima")'
};

export const AliExpressScraper: Scraper = {
  name: 'AliExpress',
  homeUrl: 'https://www.aliexpress.com/',
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
      // Fallback: busca direta
      const q = encodeURIComponent(params.query);
      await page.goto(`https://www.aliexpress.com/wholesale?SearchText=${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
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
      memlog.push('warn', `AliExpress: não achou botão próxima página`);
    }
    return false;
  },
  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await tryClosePopups(page);
      await scrollIncremental(page, 5);
      const nome = (await page.locator('h1, .product-title-text').first().textContent())?.trim() || 'Produto';
      const price = normalizePriceBRL((await page.locator('.product-price-value, .price').first().textContent())?.trim() || null);
      const nota = normalizeRating((await page.locator('.overview-rating-average, .rating').first().textContent())?.trim() || null);
      const imagem = await page.locator('img[src*="https" i]').first().getAttribute('src');
      const descricao = await page.locator('meta[name="description"]').getAttribute('content');

      // tentativa de extrair specs por labels comuns
      let modelo: string|null = null, marca: string|null = null, fabricante: string|null = null, ean_gtin: string|null = null;
      const blocks = page.locator('table, dl, ul');
      const count = await blocks.count();
      for (let i=0; i<count; i++) {
        const text = (await blocks.nth(i).innerText()).toLowerCase();
        if (!modelo && /modelo|model/.test(text)) modelo = (text.match(/model[o]?:?\s*([^\n]+)/)?.[1] ?? null);
        if (!marca && /marca|brand/.test(text)) marca = (text.match(/marca|brand:?\s*([^\n]+)/)?.[1] ?? null);
        if (!fabricante && /fabricante|manufacturer/.test(text)) fabricante = (text.match(/fabricante|manufacturer:?\s*([^\n]+)/)?.[1] ?? null);
        if (!ean_gtin && /ean|gtin/.test(text)) ean_gtin = ean_gtin ?? extractEAN(text);
      }

      const prod: Produto = {
        nome,
        preco: price,
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
        caracteristicas: null,
        descricao: descricao ?? null,
        sku: null,
        estado: null,
        estoque: null,
        imagens: imagem ? [imagem] : null,
        product_id: null,
        vendedor: null,
      };
      return prod;
    } catch (e: any) {
      memlog.push('warn', `AliExpress parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};
