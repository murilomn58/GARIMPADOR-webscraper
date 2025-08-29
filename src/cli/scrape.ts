#!/usr/bin/env ts-node
import { manager, RunBody } from '../server/manager';
import { exportCSV, exportJSON } from '../utils/exporter';

function parseArgs(argv: string[]) {
  const out: any = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = true; }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const body: RunBody = {
    marketplace: (args.marketplace || 'Temu') as any,
    query: args.query || 'smartphone',
    pages: Number(args.pages || 3),
    products: Number(args.products || 10),
    sampleRandomPages: Boolean(args.sampleRandomPages || false),
    clearCookies: Boolean(args.clearCookies || false),
    timeouts: { connect: Number(args.connect || 7), load: Number(args.load || 3) },
    headless: Boolean(args.headless ?? true),
    debug: Boolean(args.debug || false),
    proxy: args.proxy || null,
  };
  console.log(`Rodando CLI:`, body);
  await manager.run(body);
  const data = (manager as any).getData();
  if (args.export === 'csv') console.log('CSV:', exportCSV(body.marketplace, body.query, data));
  else console.log('JSON:', exportJSON(body.marketplace, body.query, data));
}

main().catch(e => { console.error(e); process.exit(1); });
