#!/bin/bash
set -e

FEATURE_NAME=${1:-"preview-$(date +%H%M%S)"}
BRANCH_NAME="preview/${FEATURE_NAME}"

echo "🧩 Criando branch local de preview: ${BRANCH_NAME}"
git checkout -b "$BRANCH_NAME"

echo "🧹 Limpando cache anterior..."
rm -rf .next

echo "⚙️ Instalando dependências..."
npm install --silent

echo "🏗️ Gerando build local de preview..."
npm run build

echo "🌐 Iniciando servidor local de preview..."
PORT=4000
npx serve out -l $PORT &
SERVER_PID=$!

sleep 2
echo "🚀 Preview disponível em: http://localhost:$PORT"
echo "🧠 Use Ctrl+C para encerrar o preview."

# abre o navegador automaticamente (macOS/Linux)
if command -v xdg-open >/dev/null; then
  xdg-open "http://localhost:$PORT"
elif command -v open >/dev/null; then
  open "http://localhost:$PORT"
fi

wait $SERVER_PID
