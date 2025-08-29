import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';

const SELECTORS = {
  searchInput: [
    'input[name="as_word"]',
    'input[type="text"][aria-label*="Buscar" i]',
    'input[type="search"]'
  ].join(', '),
  productCards: [
    'a.ui-search-link',
    'a[class*="ui-search-link" i]',
    'a[href*="/MLB-"]',
  ].join(', '),
  nextPage: [
    'a[title*="Seguinte" i]',
    'a[aria-label*="Seguinte" i]',
    'a.ui-search-link[rel="next"]',
    'a[rel="next"]'
  ].join(', '),
};

export const MercadoLivreScraper: Scraper = {
  name: 'Mercado Livre',
  homeUrl: 'https://www.mercadolivre.com.br/',
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
      await page.goto(`https://lista.mercadolivre.com.br/${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
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
      memlog.push('warn', `Mercado Livre: não achou botão próxima página`);
    }
    return false;
  },

  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await tryClosePopups(page);
      await scrollIncremental(page, 5);

      // Título
      const nome = (await page.locator('h1.ui-pdp-title, h1[itemprop="name"], h1').first().textContent())?.trim() || 'Produto';

      // Preço: pode estar fragmentado em fração/centavos dentro do mesmo container
      let priceText = await page.locator('[data-testid*="price" i], .ui-pdp-price__second-line, .andes-money-amount').first().innerText().catch(()=>null);
      if (!priceText) priceText = await page.locator('[class*="price" i]').first().innerText().catch(()=>null);
      const preco = normalizePriceBRL(priceText);

      // Nota
      const nota = normalizeRating(
        (await page.locator('.ui-pdp-review__rating, .ui-review-capability__rating, [aria-label*="estrelas" i]').first().textContent())?.trim() || null
      );

      // Imagem principal
      const imagem = await page.locator('.ui-pdp-gallery__figure img, img.ui-pdp-image, img[src^="http" i]').first().getAttribute('src');

      // Descrição
      const descricao = await page.locator('meta[name="description"]').getAttribute('content');

      // Especificações: blocos com dt/dd ou tabelas
      const caracteristicas: Record<string, string> = {};
      const specBlocks = page.locator('section, div, table, dl');
      const n = await specBlocks.count();
      for (let i=0; i<n && i<14; i++) {
        try {
          const html = await specBlocks.nth(i).innerHTML();
          if (!/(ficha|especifica|caracter|técnic|tecnic|spec|informac)/i.test(html)) continue;
          // Tabela key/value
          const kvPairs = await specBlocks.nth(i).locator('tr').evaluateAll((rows:any[]) => rows.map(r=>{
            const th = (r.querySelector('th')||r.querySelector('td'))?.textContent?.trim()||'';
            const td = (r.querySelectorAll('td')[1]||r.querySelector('td'))?.textContent?.trim()||'';
            return [th, td];
          }));
          for (const [k,v] of kvPairs) if (k && v) caracteristicas[k.toLowerCase()] = v;
          // DL dt/dd
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
        for (const k of keys) {
          const found = hay.find(h => h.includes(k));
          if (found) return caracteristicas[found];
        }
        return null;
      };

      const marca = getFromSpecs('marca','brand');
      const modelo = getFromSpecs('modelo','model');
      const fabricante = getFromSpecs('fabricante','manufacturer');
      const ean_gtin = extractEAN(getFromSpecs('ean','gtin','codigo de barras'));
      const certificado = getFromSpecs('anatel','certifica');

      const imagens = await page.locator('img[src^="http" i]').evaluateAll((imgs:any[]) =>
        Array.from(new Set(imgs.map(i => (i as HTMLImageElement).src))).slice(0,8)
      ).catch(()=>null);

      const prod: Produto = {
        nome,
        preco: preco,
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
        certificado: certificado ?? null,
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
      memlog.push('warn', `Mercado Livre parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};

