Guia para usar o GARIMPADOR (Windows)

Requisitos
- Node.js 18+ e npm
- Python 3.10+ com pip

Primeiro uso (atalhos prontos)
1) Abra a pasta `runwebscrap` que veio neste repositório:
   - `scripts/windows/runwebscrap/`
   - Ou extraia `runwebscrap.zip` para a Área de Trabalho.
2) Duplo clique em:
   - `Terminal 1 - Backend.bat` (sobe API em http://localhost:8000)
   - `Terminal 2 - UI.bat` (abre UI em http://localhost:8501)
3) Na primeira execução:
   - Se pedir o caminho do projeto, informe a pasta onde você clonou este repositório (a que contém `package.json`).

Pela UI (recomendado)
- Abra http://localhost:8501
- Sidebar:
  - Marketplace: escolha (Temu, AliExpress, Submarino, Mercado Livre)
  - Palavra de busca: ex. smartphone
  - Páginas: 1 (teste) a 5
  - Produtos: 3 (teste) a 10
  - Headless: desmarcado para ver o navegador
  - Debug: marcado para salvar screenshots em erros
  - Clique Iniciar

Resultados e arquivos
- Export: `.data/YYYY-MM-DD-<marketplace>-<query>.{csv,json}`
- Logs: `logs/run-<timestamp>.log`
- Evidências (debug): `logs/screenshots/<runId>/` (PNG + HTML)

Linha de comando (opcional)
- Exemplo Temu (1 página, 3 produtos):
  `npm run scrape -- --marketplace Temu --query "smartphone" --pages 1 --products 3 --headless false --debug --export json`
- Exemplo Mercado Livre:
  `npm run scrape -- --marketplace "Mercado Livre" --query "smartphone" --pages 1 --products 3 --headless false --debug --export csv`

Problemas comuns
- Captcha/wall: UI mostrará “Intervenção necessária”. Tente proxy e Headless desmarcado.
- Porta ocupada: feche janelas antigas. Os .bat já tentam liberar 8000/8501.

