#!/bin/bash
# 🚀 Codex Deploy Preview Script - DSD Financial System
# Cria commit, branch, pull request e preview automático na Vercel.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿  Codex Automated Deploy Preview Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1️⃣ Confere branch atual
BRANCH=$(git branch --show-current)

if [ "$BRANCH" == "main" ] || [ -z "$BRANCH" ]; then
  read -p "👉 Digite o nome da nova branch (ex: fix-bankinter-upload): " FEATURE
  BRANCH="codex/${FEATURE}"
  git checkout -b "$BRANCH"
  echo "✅ Nova branch criada: $BRANCH"
else
  echo "🪴 Usando branch existente: $BRANCH"
fi

# 2️⃣ Confirma commit
read -p "💬 Descreva brevemente a alteração (ex: correção upload CSV Bankinter): " MSG
git add .
git commit -m "feat: $MSG"
git push -u origin "$BRANCH"

# 3️⃣ Cria Pull Request no GitHub
TITLE="🚀 Deploy Preview: $MSG"
BODY="Este PR foi criado automaticamente via Codex.

🧩 **Branch:** $BRANCH  
🪄 **Descrição:** $MSG  
🌍 **Deploy Preview:** será gerado automaticamente pela Vercel.  

⚙️ **Executado via:** \`scripts/deploy-preview.sh\`"

echo ""
echo "🧱 Criando Pull Request: $BRANCH → main ..."
gh pr create --base main --head "$BRANCH" --title "$TITLE" --body "$BODY" --label "codex:auto" --fill

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Pull Request criado com sucesso!"
  echo "🔗 Verifique o preview assim que a Vercel terminar o build:"
  echo "   https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros/pulls"
else
  echo "❌ Erro ao criar Pull Request. Verifique autenticação do GitHub CLI."
  exit 1
fi

echo ""
echo "🌍 Acesse a Vercel para acompanhar o deploy preview:"
echo "   https://vercel.com/dashboard"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Processo concluído!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
