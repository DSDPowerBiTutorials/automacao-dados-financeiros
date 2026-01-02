#!/bin/bash

echo "================================================"
echo "  🧪 Teste de Autenticação - DSD Finance Hub"
echo "================================================"
echo ""

echo "✅ Verificando arquivos modificados..."
echo ""

# Verificar se os arquivos existem
FILES=(
    "src/lib/supabase.ts"
    "src/contexts/auth-context.tsx"
    "src/components/auth/AuthGuard.tsx"
    "public/clear-auth-cache.html"
    "docs/FIX-SESSION-ISSUE.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (NOT FOUND)"
    fi
done

echo ""
echo "================================================"
echo "  📝 Instruções de Teste"
echo "================================================"
echo ""

echo "1️⃣ PRIMEIRO PASSO - Limpar cache antigo:"
echo "   Acesse: http://localhost:3000/clear-auth-cache.html"
echo "   Clique em 'Limpar Tudo e Recarregar'"
echo ""

echo "2️⃣ SEGUNDO PASSO - Verificar login:"
echo "   - Faça login normalmente"
echo "   - Recarregue a página (F5)"
echo "   - Deve continuar logado ✅"
echo ""

echo "3️⃣ TERCEIRO PASSO - Verificar logout:"
echo "   - Faça logout"
echo "   - Tente acessar /dashboard"
echo "   - Deve redirecionar para /login ✅"
echo ""

echo "4️⃣ QUARTO PASSO - Fechar e reabrir:"
echo "   - Faça login"
echo "   - Feche o navegador completamente"
echo "   - Reabra e acesse a aplicação"
echo "   - Deve continuar logado ✅"
echo ""

echo "================================================"
echo "  🐛 Verificar Problemas no Console"
echo "================================================"
echo ""

echo "Abra DevTools (F12) e procure por:"
echo "  ✅ 'Auth event: SIGNED_IN' - quando fizer login"
echo "  ✅ 'Auth event: SIGNED_OUT' - quando fizer logout"
echo "  ✅ 'Auth event: TOKEN_REFRESHED' - tokens renovando"
echo "  ❌ Erros relacionados a 'session' ou 'auth'"
echo ""

echo "================================================"
echo "  🔧 Limpar Cache Manualmente (se necessário)"
echo "================================================"
echo ""

echo "Cole no Console do Navegador (F12):"
echo ""
cat << 'EOF'
Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));
sessionStorage.clear();
console.log('✅ Cache limpo!');
location.reload();
EOF

echo ""
echo "================================================"
echo "  🚀 Iniciar Servidor de Desenvolvimento"
echo "================================================"
echo ""

read -p "Deseja iniciar o servidor agora? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Iniciando servidor..."
    npm run dev
fi
