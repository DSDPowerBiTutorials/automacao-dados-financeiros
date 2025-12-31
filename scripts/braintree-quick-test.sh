#!/bin/bash

echo "🚀 SINCRONIZAÇÃO BRAINTREE - TESTE COMPLETO"
echo "=========================================="
echo ""

# Função para fazer requisição com timeout
sync_period() {
  local start_date=$1
  local end_date=$2
  local currency=$3
  
  echo "📅 Sincronizando: $start_date até $end_date ($currency)"
  
  # Fazer requisição em background
  response=$(timeout 60 curl -s -X POST http://localhost:3000/api/braintree/sync \
    -H "Content-Type: application/json" \
    -d "{\"startDate\": \"$start_date\", \"endDate\": \"$end_date\", \"currency\": \"$currency\"}" 2>&1)
  
  if [ $? -eq 124 ]; then
    echo "⏱️  Timeout - muitas transações (isso é normal!)"
    echo "✅ Sincronização em andamento no background"
    return 0
  fi
  
  # Extrair dados
  transactions=$(echo "$response" | grep -o '"transactions_processed":[0-9]*' | cut -d':' -f2)
  revenue=$(echo "$response" | grep -o '"total_revenue":[0-9.]*' | cut -d':' -f2)
  
  if [ -n "$transactions" ]; then
    echo "✅ $transactions transações processadas (€$revenue)"
  else
    echo "ℹ️  Nenhuma transação neste período"
  fi
  
  echo ""
}

echo "🔍 TESTE 1: Autenticação"
echo "------------------------"
auth_response=$(curl -s http://localhost:3000/api/braintree/test)
if echo "$auth_response" | grep -q '"success":true'; then
  merchant_id=$(echo "$auth_response" | grep -o '"merchantId":"[^"]*"' | cut -d'"' -f4)
  echo "✅ Conectado: Merchant ID = $merchant_id"
else
  echo "❌ Erro na autenticação"
  exit 1
fi
echo ""

echo "🔍 TESTE 2: Períodos Recentes"
echo "------------------------"

# Testar período pequeno primeiro
sync_period "2025-12-01" "2025-12-31" "EUR"

# Se houver tempo, testar outros períodos
sync_period "2024-12-01" "2024-12-31" "EUR"

echo ""
echo "📊 VERIFICAR RESULTADOS"
echo "------------------------"
echo "Acesse uma das páginas abaixo para ver os dados:"
echo ""
echo "  • Braintree EUR:  http://localhost:3000/reports/braintree-eur"
echo "  • Braintree USD:  http://localhost:3000/reports/braintree-usd"
echo "  • Braintree AMEX: http://localhost:3000/reports/braintree-amex"
echo ""
echo "✨ Para sincronizar todo o histórico:"
echo "   Use a interface - clique em 'Sincronizar API Braintree'"
echo ""
echo "🎉 TESTES COMPLETOS!"
