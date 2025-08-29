import { Produto } from '../schemas/product';

export type Progress = {
  running: boolean;
  marketplace: string | null;
  query: string | null;
  pagesTarget: number;
  productsTarget: number;
  pagesVisited: number;
  productsCollected: number;
  resultsFound: number;
  percent: number; // 0-100
  currentItem: Produto | null;
  logs: { level: 'info'|'warn'|'error'; msg: string; time: string }[];
  intervencaoNecessaria: boolean;
};

export class ProgressStore {
  private state: Progress = {
    running: false,
    marketplace: null,
    query: null,
    pagesTarget: 0,
    productsTarget: 0,
    pagesVisited: 0,
    productsCollected: 0,
    resultsFound: 0,
    percent: 0,
    currentItem: null,
    logs: [],
    intervencaoNecessaria: false,
  };

  get() { return this.state; }
  set(p: Partial<Progress>) { this.state = { ...this.state, ...p }; }
  reset() {
    this.state = {
      running: false, marketplace: null, query: null,
      pagesTarget: 0, productsTarget: 0, pagesVisited: 0, productsCollected: 0, resultsFound: 0,
      percent: 0, currentItem: null, logs: [], intervencaoNecessaria: false
    };
  }
}

export const progressStore = new ProgressStore();
