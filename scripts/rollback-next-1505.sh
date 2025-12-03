#!/bin/bash
# 🧩 ROLLBACK NEXT.JS PARA 15.0.5 — PREVIEW DEPLOY NA VERCEL
# Autor: DSD Finance Dev GPT
# Descrição: Corrige versão do Next.js e faz push automático pra branch Preview.

set -euo pipefail

BRANCH="rollback-next-1505"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Iniciando rollback automático do Next.js para 15.0.5..."

if [ ! -f "package.json" ]; then
  echo "❌ Erro: package.json não encontrado na pasta atual."
  exit 1
fi

log "🔧 Atualizando versão do Next.js para 15.0.5..."
node <<'NODE'
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!pkg.dependencies || !pkg.dependencies.next) {
  throw new Error('Dependência "next" não encontrada em package.json');
}

pkg.dependencies.next = '15.0.5';
if (pkg.dependencies['eslint-config-next']) {
  pkg.dependencies['eslint-config-next'] = '15.0.5';
}
if (pkg.devDependencies && pkg.devDependencies['eslint-config-next']) {
  pkg.devDependencies['eslint-config-next'] = '15.0.5';
}

pkg.engines = pkg.engines || {};
pkg.engines.node = pkg.engines.node || '>=18.17.0 <19';

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE

log "🧹 Limpando cache e reinstalando dependências..."
rm -rf node_modules .next package-lock.json
npm install

log "🧪 Testando build local..."
if ! npm run build; then
  echo "❌ Build falhou. Verifique dependências antes do push."
  exit 1
fi

log "🌿 Criando branch de preview: ${BRANCH}"
if git rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
  git checkout "${BRANCH}"
else
  git checkout -b "${BRANCH}"
fi

log "💾 Commitando alterações..."
git add package.json package-lock.json
if git diff --cached --quiet; then
  log "ℹ️ Nenhuma alteração para commit."
else
  git commit -m "chore: rollback Next.js to 15.0.5 for stable preview build"
fi

log "🚀 Enviando para GitHub..."
git push -u origin "${BRANCH}"

log "✅ Rollback concluído com sucesso!"
echo "🔗 Preview da Vercel: https://automacao-dados-financeiros-git-${BRANCH}.vercel.app"
