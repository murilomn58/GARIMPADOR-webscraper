import { Page } from 'playwright';
import { Produto } from '../schemas/product';

export type SearchParams = {
  query: string;
  pages: number;
  products: number;
  sampleRandomPages?: boolean;
  timeouts: { connect: number; load: number };
};

export type Scraper = {
  name: string;
  homeUrl: string;
  selectors: Record<string, string>;
  search: (page: Page, params: SearchParams) => Promise<void>;
  collectListingLinks: (page: Page) => Promise<string[]>;
  goToNextPage: (page: Page, currentPage: number) => Promise<boolean>;
  parseProductPage: (page: Page, url: string, query: string, pageIndex: number) => Promise<Produto | null>;
};

