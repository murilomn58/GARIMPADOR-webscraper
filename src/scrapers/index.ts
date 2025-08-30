import { Scraper } from './types';
import { TemuScraper } from './temu';
import { AliExpressScraper } from './aliexpress';
import { SubmarinoScraper } from './submarino';
import { AmazonScraper } from './amazon';
import { AmericanasScraper } from './americanas';
import { MagaluScraper } from './magalu';
import { ShopeeScraper } from './shopee';
import { MercadoLivreScraper } from './mercado_livre';
import { CarrefourScraper } from './carrefour';
import { CasasBahiaScraper } from './casas_bahia';

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
  Amazon: AmazonScraper,
  Americanas: AmericanasScraper,
  Carrefour: CarrefourScraper,
  'Casas Bahia': CasasBahiaScraper,
  Magalu: MagaluScraper,
  'Mercado Livre': MercadoLivreScraper,
  Shopee: ShopeeScraper,
  Submarino: SubmarinoScraper,
};

export type MarketplaceKey = keyof typeof SCRAPERS;
