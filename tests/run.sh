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
# Todo archivo de apps.json y todo manifiesto/icono enlazado desde una pagina debe existir
echo "== archivos de apps.json, manifiestos e iconos existen"
for f in $(grep -o '"apps/[^"]*"' apps.json | tr -d '"'); do
  if [ -f "$f" ]; then echo "PASS $f"; else echo "FALTA $f (listado en apps.json)"; STATUS=1; fi
done
for page in index.html $(grep -o '"path": "[^"]*"' apps.json | sed 's/"path": "//; s/"$//'); do
  dir=$(dirname "$page")
  for ref in $(grep -o '<link rel="\(manifest\|icon\|apple-touch-icon\)"[^>]*href="[^"]*"' "$page" | sed 's/.*href="//; s/"$//'); do
    target=$(cd "$dir" && realpath -m "$ref" 2>/dev/null)
    if [ -f "$target" ]; then echo "PASS $page -> $ref"; else echo "FALTA $ref enlazado desde $page"; STATUS=1; fi
  done
done
for page in apps/*/tests/*.test.html shared/tests/*.test.html; do
  echo "== $page"
  URL="file:///$(cygpath -m "$PWD/$page")"
  # A veces el navegador sin interfaz se queda colgado y no devuelve nada: se corta a los 30 s y se reintenta
  for try in 1 2 3; do
    OUT=$(timeout -k 5 30 "$BROWSER" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=4000 --dump-dom "$URL" 2>/dev/null)
    printf '%s' "$OUT" | grep -q '<pre id="out">' && break
    echo "(el navegador no respondió, intento $try de 3)"
  done
  BODY=$(printf '%s' "$OUT" | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/.*<pre id="out">//; s/<\/pre>.*//' | sed 's/&gt;/>/g; s/&lt;/</g; s/&quot;/"/g; s/&amp;/\&/g')
  if [ -z "$BODY" ]; then echo "(sin resultados: la página no terminó)"; STATUS=1; continue; fi
  printf '%s\n' "$BODY"
  printf '%s' "$BODY" | grep -q 'failed=0' || STATUS=1
done
exit $STATUS
