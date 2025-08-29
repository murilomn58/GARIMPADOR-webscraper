import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';

// Nota: seletores podem variar conforme região/experimentos A/B. Ajuste conforme necessário.
const SELECTORS = {
  searchInput: 'input[type="search"], input[placeholder*="buscar" i], input[placeholder*="search" i], input[aria-label*="search" i], input[name*="search" i]'
    ,
  productCards: 'a[href*="/goods.html"], a[href*="/goods/"], a[data-goods-id]'
    ,
  nextPage: 'a[aria-label="Next"], button[aria-label="Próxima"], button:has-text("Próxima")'
};

export const TemuScraper: Scraper = {
  name: 'Temu',
  homeUrl: 'https://www.temu.com/br',
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
      // Fallback: navega direto para resultados de busca
      const q = encodeURIComponent(params.query);
      await page.goto(`https://www.temu.com/search_result.html?search_key=${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
    }
    // Aguarda que haja cards de produto
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
      memlog.push('warn', `Temu: não achou botão próxima página`);
    }
    return false;
  },

  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await tryClosePopups(page);
      await scrollIncremental(page, 5);

      const titleSel = 'h1, [data-testid="title"], .product-title';
      const priceSel = '.price, [data-testid="price"], [class*="price"]';
      const ratingSel = '[aria-label*="rating" i], .rating, [class*="rating"]';
      const imageSel = 'img[src*="https" i]';
      const specsSel = 'table, dl, ul';

      const nome = (await page.locator(titleSel).first().textContent())?.trim() || 'Produto';
      const precoText = (await page.locator(priceSel).first().textContent())?.trim() || null;
      const price = normalizePriceBRL(precoText);
      const notaText = (await page.locator(ratingSel).first().textContent())?.trim() || null;
      const nota = normalizeRating(notaText);
      const imagem = await page.locator(imageSel).first().getAttribute('src');

      // spec table scan for ANATEL fields
      const pageText = (await page.content()).toLowerCase();
      const certificado = /anatel|homologa[çc][aã]o/.test(pageText)
        ? ((await page.locator(':text("ANATEL")').first().textContent())?.trim() ?? null)
        : null;

      // fallback parse by common labels
      const labels = ['modelo', 'model', 'modelo do produto', 'brand', 'marca', 'fabricante', 'ean', 'gtin'];
      let modelo: string|null = null, marca: string|null = null, fabricante: string|null = null, ean_gtin: string|null = null;
      for (const label of labels) {
        const el = page.locator(`xpath=//*/text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${label}')]/parent::*`).first();
        try {
          if (await el.isVisible()) {
            const block = (await el.textContent())?.toLowerCase() ?? '';
            if (block.includes('modelo') || block.includes('model')) modelo = modelo ?? el.textContent().then(t=>t||null) as any;
            if (block.includes('marca') || block.includes('brand')) marca = marca ?? el.textContent().then(t=>t||null) as any;
            if (block.includes('fabricante')) fabricante = fabricante ?? el.textContent().then(t=>t||null) as any;
            if (block.includes('ean') || block.includes('gtin')) ean_gtin = ean_gtin ?? extractEAN(await el.textContent());
          }
        } catch {}
      }

      const descricao = await page.locator('meta[name="description"]').getAttribute('content');

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
        certificado: certificado,
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
      memlog.push('warn', `Temu parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};
