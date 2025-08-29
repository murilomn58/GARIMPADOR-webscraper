import { ProdutoSchema } from '../schemas/product';
import { extractEAN, normalizePriceBRL, normalizeRating } from '../extractors/normalize';

function assertEq(a: any, b: any, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Assert fail: ${msg} got=${JSON.stringify(a)} expected=${JSON.stringify(b)}`);
}

async function tests() {
  // Normalize preço
  assertEq(normalizePriceBRL('R$ 1.234,56'), 1234.56, 'preço');
  assertEq(normalizePriceBRL('2.999,00'), 2999.00, 'preço');
  // Rating
  assertEq(normalizeRating('4,7 de 5'), 4.7, 'rating');
  // EAN
  const e = extractEAN('EAN: 7891234567890');
  if (!e || e.length < 8) throw new Error('ean');
  // Schema
  const mock = {
    nome: 'Teste', preco: 199.9, nota: 4.5, avaliacoes: 10, imagem: 'https://x/y.jpg', data: new Date().toISOString(), url: 'https://ex.com/p', palavra_busca: 'smartphone', pagina_de_busca: 1, probabilidade: 0.5, passivel: true, categoria: null, certificado: null, ean_gtin: null, fabricante: null, marca: null, modelo: null, sch_modelo: null, sch_nome_comercial: null, caracteristicas: null, descricao: null, sku: null, estado: null, estoque: null, imagens: null, product_id: null, vendedor: null
  };
  ProdutoSchema.parse(mock);
  console.log('OK');
}

tests().catch(e => { console.error(e); process.exit(1); });

