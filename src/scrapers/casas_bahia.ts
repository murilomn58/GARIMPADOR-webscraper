import { Page } from 'playwright';
import dayjs from 'dayjs';
import { Scraper } from './types';
import { Produto } from '../schemas/product';
import { humanDelay, scrollIncremental, tryClosePopups } from '../agent/human';
import { extractEAN, heuristicaPassivel, normalizePriceBRL, normalizeRating, scoreRelevancia } from '../extractors/normalize';
import { memlog } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const SELECTORS = {
  searchInput: 'input[type="search"], input[name*="search" i], input#h_search-input',
  productCards: [
    'a[href*="/produto/"]',
    'a[href*="/produtos/"]',
    'a[href*="/p/" i]',
    'a[class*="product" i]'
  ].join(', '),
  nextPage: [
    'a[rel="next"]',
    'a[aria-label*="Próxima" i]'
  ].join(', ')
};

export const CasasBahiaScraper: Scraper = {
  name: 'Casas Bahia',
  homeUrl: 'https://www.casasbahia.com.br/',
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
      await page.goto(`https://www.casasbahia.com.br/busca/${q}`, { waitUntil: 'domcontentloaded', timeout: params.timeouts.load * 1000 });
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
      memlog.push('warn', `Casas Bahia: não achou botão próxima página`);
    }
    return false;
  },

  async parseProductPage(page: Page, url: string, query: string, pageIndex: number): Promise<Produto | null> {
    try {
      if (!/(\/p|produto)\//.test(page.url())) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      await tryClosePopups(page);
      await scrollIncremental(page, 5);

      // Helpers
      const getProductJsonLD = async () => {
        const texts = await page.locator('script[type="application/ld+json"]').allTextContents().catch(()=>[] as string[]);
        for (const t of texts) {
          try {
            const j = JSON.parse(t);
            const arr = Array.isArray(j) ? j : [j];
            for (const node of arr) {
              const graph = node['@graph'];
              const nodes = Array.isArray(graph) ? graph : [node];
              for (const n of nodes) {
                if (n && (n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product')))) return n as any;
              }
            }
          } catch {}
        }
        return null;
      };
      const parseBRL = (s: any): number | null => {
        if (typeof s === 'number') return s;
        if (!s) return null;
        return normalizePriceBRL(String(s));
      };
      const clampNota = (n: any): number | null => {
        const v = typeof n === 'number' ? n : (normalizeRating(String(n)) ?? null);
        if (v == null || isNaN(v)) return null;
        return Math.max(0, Math.min(5, v));
      };

      const titleSel = 'h1, [data-testid="product-title"], [itemprop="name"]';
      const priceSel = '[itemprop="price"], [data-testid*="price" i], [class*="price" i]';

      const ld = await getProductJsonLD();
      let nome: string | null = ld?.name ?? null;
      let preco: number | null = null;
      let nota: number | null = null;
      let avaliacoes: number | null = null;
      let sku: string | null = ld?.sku ?? null;
      let marca: string | null = ld?.brand?.name ?? ld?.brand ?? null as any;
      let ean_gtin: string | null = ld?.gtin13 ?? ld?.gtin ?? null;
      let categoria: string | null = ld?.category ?? null;
      let product_id: string | null = ld?.productID ?? null;
      let vendedor: string | null = ld?.seller?.name ?? null;
      const descricaoLD: string | null = ld?.description ?? null;

      if (ld?.offers) {
        const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        if (offers?.price) { preco = parseBRL(offers.price); console.warn('Usando JSON-LD para preço'); }
      }
      if (ld?.aggregateRating) {
        nota = clampNota(ld.aggregateRating.ratingValue);
        avaliacoes = typeof ld.aggregateRating.reviewCount === 'number' ? ld.aggregateRating.reviewCount : parseInt(ld.aggregateRating.reviewCount || '0', 10) || null;
      }

      if (!nome) {
        console.warn('Fallback em seletor de título');
        nome = (await page.locator(titleSel).first().textContent())?.trim() || null;
      }
      if (!preco) {
        console.warn('Fallback em seletor de preço');
        try { await page.locator(priceSel).first().waitFor({ timeout: 10_000 }); } catch {}
        const ptext = (await page.locator(priceSel).first().textContent())?.trim()
          || await page.locator('[itemprop="price"]').first().getAttribute('content').catch(()=>null);
        preco = parseBRL(ptext);
      }

      // Imagens — apenas galeria; excluir vlibras; domínio CasasBahia VTEX
      const galSel = '[data-testid*="image" i] img, .vtex-store-components-3-x-imageElement img, .vtex-store-components-3-x-imageElement';
      const imagensArr = await page.locator(galSel).evaluateAll((imgs:any[]) =>
        Array.from(new Set(imgs.map(i => {
          const el = i as HTMLImageElement;
          // @ts-ignore
          return (el && el.src) ? el.src : null;
        }).filter(Boolean)))
      ).catch(()=>[] as string[]);
      const imagens = imagensArr
        .filter(u => !/vlibras\.gov\.br/i.test(u))
        .filter(u => /casasbahia\.vtexassets\.com.*arquivos.*ids/i.test(u))
        .slice(0, 8);
      for (const u of imagensArr) {
        if (/vlibras\.gov\.br/i.test(u)) console.warn('Imagem inválida descartada: VLibras');
        else if (!/casasbahia\.vtexassets\.com.*arquivos.*ids/i.test(u)) console.warn('Imagem inválida descartada: fora da galeria');
      }
      const imagem = imagens.length ? imagens[0] : null;

      const descricaoMeta = await page.locator('meta[name="description"]').getAttribute('content');
      const descricao = descricaoLD ?? descricaoMeta ?? null;

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

      if (!nome || !preco) {
        try {
          const outDir = path.join(process.cwd(), 'logs');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const out = path.join(outDir, 'outdebug_ld.json');
          fs.writeFileSync(out, JSON.stringify(ld, null, 2), 'utf-8');
        } catch {}
      }

      const prod: Produto = {
        nome: nome ?? 'Produto',
        preco: preco ?? null,
        nota,
        avaliacoes,
        imagem: imagem ?? null,
        data: dayjs().toISOString(),
        url,
        palavra_busca: query,
        pagina_de_busca: pageIndex,
        probabilidade: scoreRelevancia(query, nome ?? undefined, descricao ?? undefined),
        passivel: heuristicaPassivel(nome ?? undefined, descricao ?? undefined, null),
        categoria: categoria ?? null,
        certificado: null,
        ean_gtin: ean_gtin ?? extractEAN(JSON.stringify(caracteristicas) || ''),
        fabricante: null,
        marca: marca ?? null,
        modelo: null,
        sch_modelo: null,
        sch_nome_comercial: null,
        caracteristicas: Object.keys(caracteristicas).length ? caracteristicas : null,
        descricao: descricao ?? null,
        sku: sku ?? null,
        estado: null,
        estoque: null,
        imagens: imagens.length ? imagens : null,
        product_id: product_id ?? null,
        vendedor: vendedor ?? null,
      };
      return prod;
    } catch (e:any) {
      memlog.push('warn', `Casas Bahia parseProductPage erro: ${e?.message || e}`);
      return null;
    }
  }
};

