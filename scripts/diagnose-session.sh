#!/bin/bash

# Script para diagnosticar problemas de sessão do navegador

echo "================================================"
echo "  Diagnóstico de Sessão - DSD Finance Hub"
echo "================================================"
echo ""

echo "1. Verificando arquivos de sessão do Supabase..."
echo "   (Execute este comando no console do navegador - F12)"
echo ""
echo "   // Cole este código no console do navegador:"
echo "   Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => {"
echo "     console.log('Key:', k);"
echo "     console.log('Value:', localStorage.getItem(k));"
echo "   });"
echo ""

echo "2. Para limpar TODAS as sessões antigas manualmente:"
echo "   (Execute no console do navegador - F12)"
echo ""
echo "   // Cole este código no console do navegador:"
echo "   Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));"
echo "   sessionStorage.clear();"
echo "   console.log('✅ Cache limpo! Recarregue a página.');"
echo ""

echo "3. Verificando se há problemas no código..."
npm run lint 2>&1 | head -20

echo ""
echo "================================================"
echo "  Soluções Rápidas"
echo "================================================"
echo ""
echo "Se ainda tiver problemas:"
echo "1. Abra o DevTools (F12) > Application > Storage"
echo "2. Clique em 'Clear site data'"
echo "3. Recarregue a página (Ctrl+Shift+R / Cmd+Shift+R)"
echo "4. Faça login novamente"
echo ""
echo "Ou use modo anônimo para testar sem cache."
echo "================================================"
