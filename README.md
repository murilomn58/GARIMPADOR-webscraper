GARIMPADOR — Web Scraper com Navegação Humana (TypeScript + Playwright + Streamlit)

Visão geral
- Backend: Node.js + TypeScript usando Express e Playwright (headless configurável)
- UI: Streamlit (Python), comunicando via HTTP com o backend em `http://localhost:8000`
- Objetivo: Buscar por palavra‑chave em marketplaces (Temu, AliExpress, etc.), simular navegação humana, coletar dados (incl. campos ANATEL), exibir em UI e exportar CSV/JSON.

Como rodar
1) Backend (Node/TS)
   - Requisitos: Node 18+, pnpm 8+
   - Instalar deps: `pnpm install`
   - (opcional) Instalar browsers Playwright: `pnpm exec playwright install chromium`
- Rodar dev: `pnpm dev` (porta 8000)
- Rodar CLI (exemplo):
  `pnpm scrape --marketplace Temu --query "smartphone" --pages 3 --products 5 --headless`
  - Ativar debug (screenshots em erros + logs no console): adicionar `--debug` (CLI) ou marcar "Debug" na UI. Artifacts em `logs/screenshots/<runId>/`.

2) UI (Streamlit)
   - Requisitos: Python 3.10+
   - Instalar deps mínimas: `pip install streamlit requests pandas`
   - Rodar: `streamlit run src/ui/app.py` (acessa em `http://localhost:8501`)
   - A UI chama o backend em `http://localhost:8000`.

Estrutura de pastas
- `src/agent/`     Agente de navegação (delays, anti-bot, viewport, retries)
- `src/scrapers/`  Um arquivo por marketplace (Temu, AliExpress, stubs outros)
- `src/extractors/` Normalizadores e regex helpers (preço, rating, EAN, heurísticas)
- `src/schemas/`   Zod schemas (Produto)
- `src/server/`    API Express (`/run`, `/status`, `/export`, `/stop`)
- `src/ui/`        Streamlit app
- `src/utils/`     Logger, progress store, exporters, user-agents, misc

Endpoints
- `POST /run` Inicia scraping
- `GET /status` Retorna progresso, contadores, item atual e logs recentes
- `GET /export?format=csv|json` Baixa export
- `POST /stop` Solicita parada do job atual

Notas
- Seletores de DOM de Temu/AliExpress estão em constantes nos módulos e possuem fallbacks; ajuste conforme necessário caso haja mudanças no site.
- Proxy (HTTP/SOCKS) suportado via flag `--proxy` e pelo corpo do `/run`.
- Em caso de captcha/wall, o status retorna `intervencaoNecessaria = true`.
 - Modo Debug: captura screenshots em erros e salva em `logs/screenshots/<runId>/`. Utilize Headless desmarcado para depurar visualmente.
