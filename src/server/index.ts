import express from 'express';
import { manager, RunBody } from './manager';
import { progressStore } from '../utils/progress';
import { memlog } from '../utils/logger';
import { exportCSV, exportJSON } from '../utils/exporter';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/data', (req, res) => {
  res.json({ items: manager.getData() });
});

app.post('/run', async (req, res) => {
  const body = req.body as RunBody;
  try {
    if (manager.isRunning()) return res.status(409).json({ error: 'Job em execução' });
    progressStore.set({ logs: [] });
    memlog.clear();
    // fire and forget
    manager.run(body).catch(err => memlog.push('error', `Run falhou: ${err?.message || err}`));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) });
  }
});

app.get('/status', (req, res) => {
  const state = progressStore.get();
  res.json({ ...state, logs: memlog.list() });
});

app.get('/export', (req, res) => {
  const { format = 'json' } = req.query as any;
  const st = progressStore.get();
  if (!st.marketplace || !st.query) return res.status(400).json({ error: 'Nada para exportar' });
  const data = manager.getData();
  const file = format === 'csv' ? exportCSV(st.marketplace, st.query, data) : exportJSON(st.marketplace, st.query, data);
  res.json({ ok: true, file });
});

app.post('/stop', (req, res) => {
  manager.requestStop();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`API pronta em http://localhost:${PORT}`);
});
