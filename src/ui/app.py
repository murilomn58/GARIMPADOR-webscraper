import time
import requests
import pandas as pd
import streamlit as st

API = "http://localhost:8000"

st.set_page_config(page_title="Garimpador", layout="wide")

# CSS fino para aproximar o visual das screenshots
st.markdown(
    """
    <style>
    .app-header {
        padding: 10px 16px; border-radius: 8px; background: #f7f9fc; border: 1px solid #e6ebf2;
        margin-bottom: 10px;
    }
    .app-counters { font-weight: 600; color: #1f2937; }
    .app-legend { color: #6b7280; font-size: 0.9rem; }
    .stProgress > div > div > div { background: linear-gradient(90deg, #0ea5e9, #22c55e); }
    .critico-vazio { background-color: #fff3cd !important; }
    .thumbs-row img { border: 1px solid #e5e7eb; border-radius: 6px; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("Garimpador de Marketplaces")

header_col = st.container()
with header_col:
    st.markdown('<div class="app-header">', unsafe_allow_html=True)
    progress_container = st.progress(0)
    counts_container = st.markdown('<div class="app-counters"></div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

with st.sidebar:
    st.header("DADOS")
    colA, colB = st.columns(2)
    use_prev = colA.button("Utilizar Resultados de Busca")
    new_search = colB.button("Efetuar Nova Pesquisa")

    st.header("PARÂMETROS · NAVEGAÇÃO")
    marketplace = st.selectbox(
        "Marketplace",
        ["Temu","AliExpress","Amazon","Americanas","Carrefour","Casas Bahia","Magalu","Mercado Livre","Shopee","Submarino"],
        index=0
    )
    query = st.text_input("Palavra de busca", value="smartphone")
    pages = st.number_input("N de Páginas de Busca a Navegar", min_value=1, max_value=50, value=5)
    products = st.number_input("N de Produtos a Capturar", min_value=1, max_value=100, value=10)
    sample_random = st.checkbox("Amostrar Páginas Aleatoriamente", value=False)
    clear_cookies = st.checkbox("Limpar Cookies ao Iniciar", value=False)

    st.header("CONFIGURAÇÕES · BROWSER")
    connect = st.number_input("Tempo de espera para conectar-se ao navegador (s)", min_value=1.0, value=7.0, step=0.5)
    load = st.number_input("Tempo limite ao carregar elementos da página (s)", min_value=1.0, value=3.0, step=0.5)
    headless = st.checkbox("Headless", value=True)
    proxy = st.text_input("Proxy (opcional)", value="")
    debug = st.checkbox("Debug (screenshots em erros)", value=False)

    run = st.button("Iniciar")
    stop = st.button("Parar")
    export_csv = st.button("Exportar CSV")
    export_json = st.button("Exportar JSON")

cols = st.columns([1,1])
with cols[0]:
    st.subheader("Imagem do produto")
    image_box = st.empty()
    thumbs_box = st.container()
with cols[1]:
    with st.expander("Dados do produto (JSON)", expanded=True):
        json_box = st.empty()

st.subheader("Resultados")
table_box = st.empty()

legend = st.markdown("<span class='app-legend'>Classificação: Positivo (Homologação Compulsória pela Anatel) · Negativo (Não é produto de Telecomunicações)</span>", unsafe_allow_html=True)
with st.expander("Logs (recentes)"):
    logs_box = st.empty()

session = requests.Session()

def trigger_run():
    payload = {
        "marketplace": marketplace,
        "query": query,
        "pages": int(pages),
        "products": int(products),
        "sampleRandomPages": bool(sample_random),
        "clearCookies": bool(clear_cookies),
        "timeouts": {"connect": float(connect), "load": float(load)},
        "headless": bool(headless),
        "debug": bool(debug),
        "proxy": proxy or None,
    }
    r = session.post(f"{API}/run", json=payload, timeout=10)
    r.raise_for_status()

def trigger_stop():
    session.post(f"{API}/stop", timeout=10)

def do_export(fmt:str):
    r = session.get(f"{API}/export", params={"format": fmt}, timeout=10)
    if r.ok:
        st.toast(f"Exportado: {r.json().get('file')}")
    else:
        st.error(r.text)

if run:
    try:
        trigger_run()
    except Exception as e:
        st.error(f"Falha ao iniciar: {e}")

if stop:
    trigger_stop()

if export_csv:
    do_export("csv")

if export_json:
    do_export("json")

def color_rules(val, col):
    if col in ("certificado","ean_gtin","modelo") and (val is None or val == ""):
        return "background-color: #fff3cd"  # amarelo claro
    return ""

def render_status():
    try:
        r = session.get(f"{API}/status", timeout=10)
        if not r.ok:
            progress_container.info("Aguardando backend...")
            return
        s = r.json()
        percent = int(s.get("percent", 0))
        progress_container.progress(percent/100)
        counts_container.markdown(
            f"<div class='app-counters'>Realizando raspagem <strong>{percent}%</strong> — "
            f"<strong>{s.get('resultsFound',0)}</strong> resultados de busca — "
            f"<strong>{s.get('productsCollected',0)}/{s.get('productsTarget',0)}</strong> anúncios processados</div>",
            unsafe_allow_html=True
        )
        if s.get("intervencaoNecessaria"):
            st.error("Intervenção necessária: captcha/wall detectado. Avalie executar com proxy e headful.")
        current = s.get("currentItem")
        if current:
            if current.get("imagem"):
                image_box.image(current.get("imagem"), caption=current.get("nome", ""), use_column_width=True)
            # miniaturas adicionais
            try:
                imgs = current.get("imagens") or []
                thumbs = [u for u in imgs if isinstance(u, str)][1:6]
                if thumbs:
                    cthumbs = thumbs_box.container()
                    cols_th = cthumbs.columns(len(thumbs), gap="small")
                    for i, u in enumerate(thumbs):
                        with cols_th[i]:
                            st.image(u, use_column_width=True)
            except Exception:
                pass
            json_box.json(current)
        # build table
        try:
            data = session.get(f"{API}/data", timeout=10).json().get('items', [])
            if data:
                df = pd.DataFrame(data)
                def style_df(df):
                    def highlight(val, col):
                        if col in ("certificado","ean_gtin","modelo") and (pd.isna(val) or val == ""):
                            return "background-color: #fff3cd"
                        return ""
                    return df.style.apply(lambda s: [highlight(v, s.name) for v in s], axis=0)
                table_box.dataframe(style_df(df), use_container_width=True)
        except Exception:
            pass
        # logs
        try:
            logs = s.get('logs', [])
            if logs:
                logs_box.code("\n".join([f"[{l.get('time','')}] {l.get('level','')}: {l.get('msg','')}" for l in logs]))
        except Exception:
            pass
    except Exception as e:
        progress_container.info("Backend indisponível")

render_status()

if st.session_state.get("auto_poll", True):
    with st.empty():
        for _ in range(40):
            time.sleep(1.0)
            render_status()
