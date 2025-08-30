import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';

const SELECTORS = {
  // Shopee muda muito. Vamos direto para a URL de busca.
  productCards: [
    'a[href*="i."]',
    'a[data-sqe="link"]'
  ].join(', '),
  nextPage: [
    'button.shopee-button-no-outline.shopee-mini-page-controller__next-btn',
    'a[aria-label*="Próxima" i]'
  ].join(', ')
};

export const ShopeeScraper: Scraper = {
  name: 'Shopee',
  homeUrl: 'https://shopee.com.br/',
  selectors: SELECTORS,

  async search(page: Page, params) {
    const q = encodeURIComponent(params.query);
    await page.goto(`https://shopee.com.br/search?keyword=${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
    await tryClosePopups(page);
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
      memlog.push('warn', `Shopee: não achou botão próxima página`);
    }
    return false;
  },

  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      if (!page.url().includes('/i.')) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      await tryClosePopups(page);
      await scrollIncremental(page, 5);

      const titleSel = 'h1, [class*="title" i]';
      const priceSel = '[class*="price" i], [data-sqe*="price" i]';
      const ratingSel = '[aria-label*="rating" i], [class*="rating" i]';
      const imageSel = 'img[src^="http" i]';

      const nome = (await page.locator(titleSel).first().textContent())?.trim() || 'Produto';
      const precoText = (await page.locator(priceSel).first().textContent())?.trim() || null;
      const preco = normalizePriceBRL(precoText);
      const notaText = (await page.locator(ratingSel).first().textContent())?.trim() || null;
      const nota = normalizeRating(notaText);
      const imagem = await page.locator(imageSel).first().getAttribute('src');
      const descricao = await page.locator('meta[name="description"]').getAttribute('content');

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
        ean_gtin: null,
        fabricante: null,
        marca: null,
        modelo: null,
        sch_modelo: null,
        sch_nome_comercial: null,
        caracteristicas: null,
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
      memlog.push('warn', `Shopee parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};

