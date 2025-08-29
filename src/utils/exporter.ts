import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import dayjs from 'dayjs';
import { Produto } from '../schemas/product';

export function exportJSON(marketplace: string, query: string, data: Produto[]): string {
  const dir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const base = `${dayjs().format('YYYY-MM-DD')}-${marketplace}-${query}`.replace(/\s+/g, '_');
  const file = path.join(dir, `${base}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}

export function exportCSV(marketplace: string, query: string, data: Produto[]): string {
  const dir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const base = `${dayjs().format('YYYY-MM-DD')}-${marketplace}-${query}`.replace(/\s+/g, '_');
  const file = path.join(dir, `${base}.csv`);
  const columns = [
    'data','probabilidade','palavra_busca','imagem','nome','categoria','fabricante','modelo','certificado','ean_gtin','sch_modelo','sch_nome_comercial'
  ];
  const records = data.map(p => [
    p.data, p.probabilidade ?? '', p.palavra_busca, p.imagem ?? '', p.nome, p.categoria ?? '', p.fabricante ?? '', p.modelo ?? '', p.certificado ?? '', p.ean_gtin ?? '', p.sch_modelo ?? '', p.sch_nome_comercial ?? ''
  ]);
  const csv = stringify(records, { header: true, columns });
  fs.writeFileSync(file, csv, 'utf-8');
  return file;
}

