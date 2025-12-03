#!/bin/bash
set -e

echo "🚀 Codex Rebuild Production — Vercel Secure Build Trigger"
echo "----------------------------------------------------------"
echo ""

# 1️⃣ Atualiza dependências locais para garantir que Next.js esteja seguro
echo "🧠 Verificando e aplicando patches de segurança..."
npm pkg set dependencies.next="^15.5.7"
npm pkg set dependencies.react="^19.1.2"
npm pkg set dependencies.react-dom="^19.1.2"
npm pkg set dependencies.eslint-config-next="^15.5.7"
npm install --force
echo "✅ Dependências atualizadas para versões seguras"
echo ""

# 2️⃣ Cria um commit vazio apenas para acionar o Codex Auto-Fix e o deploy Vercel
echo "💾 Criando commit para disparar rebuild..."
git add package.json package-lock.json || true
git commit -m "chore(security): force rebuild production with Next.js 15.5.7 (Codex Trigger)" || echo "ℹ️ Nenhuma mudança para commitar"
git push origin main --force-with-lease
echo "✅ Commit enviado e workflow acionado"
echo ""

# 3️⃣ Mensagem final e instruções
echo "----------------------------------------------------------"
echo "🧠 O Codex Auto-Fix será executado no GitHub Actions."
echo "🚀 A Vercel iniciará o rebuild automático com a versão segura do Next.js."
echo ""
echo "📍 Verifique o progresso em:"
echo "   - GitHub → Actions → 🤖 Codex Auto Fix"
echo "   - Vercel → Deployments → último build"
echo ""
echo "✅ Após a conclusão, o aviso de vulnerabilidade desaparecerá automaticamente."
echo "----------------------------------------------------------"
