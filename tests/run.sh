#!/usr/bin/env bash
# Ejecuta todas las páginas de test con Edge/Chrome sin interfaz y muestra el resultado.
# Uso: bash tests/run.sh
cd "$(dirname "$0")/.." || exit 1
BROWSER=""
for p in "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Google/Chrome/Application/chrome.exe"; do
  [ -f "$p" ] && BROWSER="$p" && break
done
[ -z "$BROWSER" ] && { echo "No se encontró Edge ni Chrome"; exit 2; }

STATUS=0

# Toda página (la portada y cada app de apps.json) debe cargar shared/auth.js, y antes que theme.js
echo "== sesion obligatoria en todas las paginas"
for f in index.html $(grep -o '"path": "[^"]*"' apps.json | sed 's/"path": "//; s/"$//'); do
  A=$(grep -n 'shared/auth\.js' "$f" | head -1 | cut -d: -f1)
  T=$(grep -n 'shared/theme\.js' "$f" | head -1 | cut -d: -f1)
  if [ -z "$A" ] || { [ -n "$T" ] && [ "$A" -gt "$T" ]; }; then echo "FALTA auth.js (o va despues de theme.js) en $f"; STATUS=1; else echo "PASS $f"; fi
done
for page in apps/*/tests/*.test.html shared/tests/*.test.html; do
  echo "== $page"
  URL="file:///$(cygpath -m "$PWD/$page")"
  OUT=$("$BROWSER" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=4000 --dump-dom "$URL" 2>/dev/null)
  BODY=$(printf '%s' "$OUT" | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/.*<pre id="out">//; s/<\/pre>.*//' | sed 's/&gt;/>/g; s/&lt;/</g; s/&quot;/"/g; s/&amp;/\&/g')
  if [ -z "$BODY" ]; then echo "(sin resultados: la página no terminó)"; STATUS=1; continue; fi
  printf '%s\n' "$BODY"
  printf '%s' "$BODY" | grep -q 'failed=0' || STATUS=1
done
exit $STATUS
