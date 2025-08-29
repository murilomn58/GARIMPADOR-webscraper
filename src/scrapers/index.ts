import { Scraper } from './types';
import { TemuScraper } from './temu';
import { AliExpressScraper } from './aliexpress';
import { SubmarinoScraper } from './submarino';
import { MercadoLivreScraper } from './mercado_livre';

// Stubs a serem implementados depois
const stub = (name: string, homeUrl: string): Scraper => ({
  name, homeUrl,
  selectors: {},
  async search(){ throw new Error(`${name}: search não implementado`); },
  async collectListingLinks(){ return []; },
  async goToNextPage(){ return false; },
  async parseProductPage(){ return null; },
});

export const SCRAPERS: Record<string, Scraper> = {
  Temu: TemuScraper,
  AliExpress: AliExpressScraper,
  Amazon: stub('Amazon', 'https://www.amazon.com.br'),
  Americanas: stub('Americanas', 'https://www.americanas.com.br'),
  Carrefour: stub('Carrefour', 'https://www.carrefour.com.br'),
  'Casas Bahia': stub('Casas Bahia', 'https://www.casasbahia.com.br'),
  Magalu: stub('Magalu', 'https://www.magazineluiza.com.br'),
  'Mercado Livre': MercadoLivreScraper,
  Shopee: stub('Shopee', 'https://shopee.com.br'),
  Submarino: SubmarinoScraper,
};

export type MarketplaceKey = keyof typeof SCRAPERS;
