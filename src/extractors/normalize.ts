export function normalizePriceBRL(text?: string | null): number | null {
  if (!text) return null;
  // Remove currency symbols and spaces, handle thousands dot and decimal comma
  const t = text.replace(/[R$\s]/g, '').replace(/\./g, '').replace(/,(\d{2})$/, '.$1');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function normalizeRating(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\d+[\.,]?\d*/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function extractEAN(text?: string | null): string | null {
  if (!text) return null;
  const m = text.replace(/\D/g, '').match(/\d{8,14}/);
  return m ? m[0] : null;
}

const TELECOM_HINTS = [
  'smartphone','celular','roteador','wi-fi','wifi','bluetooth','smartwatch','tablet','modem','4g','5g','lte','wireless','repetidor','ac','ax','zigbee'
];

export function heuristicaPassivel(nome: string, descricao?: string|null, categoria?: string|null) : boolean {
  const hay = `${nome} ${descricao ?? ''} ${categoria ?? ''}`.toLowerCase();
  return TELECOM_HINTS.some(k => hay.includes(k));
}

export function scoreRelevancia(palavra: string, nome: string, descricao?: string|null): number {
  const q = palavra.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${nome} ${descricao ?? ''}`.toLowerCase();
  if (q.length === 0) return 0;
  const hits = q.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0);
  return Math.min(1, hits / q.length);
}

