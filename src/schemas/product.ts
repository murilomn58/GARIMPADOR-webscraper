import { z } from 'zod';

export const ProdutoSchema = z.object({
  nome: z.string(),
  preco: z.number().nullable(),
  nota: z.number().nullable(),
  avaliacoes: z.number().nullable(),
  imagem: z.string().url().nullable(),
  data: z.string(),
  url: z.string().url(),
  palavra_busca: z.string(),
  pagina_de_busca: z.number(),
  probabilidade: z.number().nullable(),
  passivel: z.boolean().nullable(),
  categoria: z.string().nullable(),
  certificado: z.string().nullable(),
  ean_gtin: z.string().nullable(),
  fabricante: z.string().nullable(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  sch_modelo: z.string().nullable(),
  sch_nome_comercial: z.string().nullable(),
  caracteristicas: z.record(z.union([z.string(), z.number(), z.boolean()])).nullable(),
  descricao: z.string().nullable(),
  sku: z.string().nullable(),
  estado: z.union([z.literal('novo'), z.literal('usado')]).nullable(),
  estoque: z.union([z.string(), z.number()]).nullable(),
  imagens: z.array(z.string().url()).nullable(),
  product_id: z.string().nullable(),
  vendedor: z.string().nullable()
});

export type Produto = z.infer<typeof ProdutoSchema>;

