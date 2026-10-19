#!/usr/bin/env bash
# Levanta la app de Streamlit (modelos en vivo) y la página web de la presentación.
#
#   ./run.sh            -> Streamlit en :8501 y la web (astro dev) en :4321
#   ./run.sh --build    -> igual, pero la web compilada (astro build + preview)
#
# La primera vez crea app/.venv e instala app/requirements.txt, y web/node_modules.
# Ctrl+C detiene las dos. Variables opcionales: ST_PORT, WEB_PORT, NO_OPEN=1.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ST_PORT="${ST_PORT:-8501}"
WEB_PORT="${WEB_PORT:-4321}"

# ---------- Python / Streamlit ----------
VENV="$RAIZ/app/.venv"
if [ ! -x "$VENV/bin/streamlit" ]; then
  echo "▸ Creando app/.venv e instalando dependencias (solo la primera vez)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$RAIZ/app/requirements.txt"
fi

# ---------- Node / Astro ----------
if [ ! -d "$RAIZ/web/node_modules" ]; then
  echo "▸ Instalando dependencias de la web (solo la primera vez)…"
  (cd "$RAIZ/web" && npm install --silent)
fi

for port in "$ST_PORT" "$WEB_PORT"; do
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ El puerto $port ya está en uso. Ciérralo o usa ST_PORT=… / WEB_PORT=…" >&2
    exit 1
  fi
done

PIDS=()
limpiar() {
  trap - EXIT INT TERM
  echo
  echo "▸ Deteniendo…"
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap limpiar EXIT INT TERM

echo "▸ Streamlit en http://localhost:$ST_PORT"
(cd "$RAIZ/app" && exec "$VENV/bin/streamlit" run app.py \
  --server.port "$ST_PORT" --server.headless true) &
PIDS+=($!)

WEB_URL="http://localhost:$WEB_PORT"
# la página busca la app en localhost:8501; si se usa otro puerto se le indica con ?st=
[ "$ST_PORT" != 8501 ] && WEB_URL="$WEB_URL/?st=http://localhost:$ST_PORT"

if [ "${1:-}" = "--build" ]; then
  echo "▸ Compilando la web…"
  (cd "$RAIZ/web" && npm run build --silent)
  echo "▸ Web en $WEB_URL"
  (cd "$RAIZ/web" && exec ./node_modules/.bin/astro preview --port "$WEB_PORT" --ignore-lock) &
else
  echo "▸ Web en $WEB_URL"
  (cd "$RAIZ/web" && exec ./node_modules/.bin/astro dev --port "$WEB_PORT" --ignore-lock) &
fi
PIDS+=($!)

# abre el navegador cuando la web responda (NO_OPEN=1 para no abrirlo)
[ -z "${NO_OPEN:-}" ] && (
  for _ in $(seq 60); do
    if curl -s -o /dev/null "http://localhost:$WEB_PORT"; then
      command -v open >/dev/null && open "$WEB_URL" || xdg-open "$WEB_URL" 2>/dev/null || true
      break
    fi
    sleep 1
  done
) &

echo "▸ Listo. Ctrl+C para detener ambas."
# termina en cuanto cualquiera de las dos se caiga (compatible con el bash 3.2 de macOS)
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 1; done
