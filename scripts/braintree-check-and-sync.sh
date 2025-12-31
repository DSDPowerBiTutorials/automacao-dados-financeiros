#!/bin/bash

# Script para verificar e sincronizar Braintree
# Usage: ./scripts/braintree-check-and-sync.sh

echo "🔍 Verificando configuração do Braintree..."

# 1. Testar autenticação
echo ""
echo "1️⃣ Testando autenticação..."
AUTH_RESPONSE=$(curl -s http://localhost:3000/api/braintree/test)
echo "$AUTH_RESPONSE" | python3 -m json.tool

if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Autenticação OK"
else
  echo "❌ Erro na autenticação"
  exit 1
fi

# 2. Verificar merchant accounts
echo ""
echo "2️⃣ Verificando merchant accounts..."
ACCOUNTS_RESPONSE=$(curl -s http://localhost:3000/api/braintree/merchant-accounts)
echo "$ACCOUNTS_RESPONSE" | python3 -m json.tool

# 3. Sincronizar últimos 30 dias
echo ""
echo "3️⃣ Sincronizando últimos 30 dias..."
END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -d '30 days ago' +%Y-%m-%d)

echo "Período: $START_DATE até $END_DATE"

SYNC_RESPONSE=$(curl -s -X POST http://localhost:3000/api/braintree/sync \
  -H "Content-Type: application/json" \
  -d "{
    \"startDate\": \"$START_DATE\",
    \"endDate\": \"$END_DATE\",
    \"currency\": \"EUR\"
  }")

echo "$SYNC_RESPONSE" | python3 -m json.tool

# Extrair estatísticas
TRANSACTIONS=$(echo "$SYNC_RESPONSE" | grep -o '"transactions_processed":[0-9]*' | cut -d':' -f2)
REVENUE=$(echo "$SYNC_RESPONSE" | grep -o '"total_revenue":[0-9.]*' | cut -d':' -f2)
FEES=$(echo "$SYNC_RESPONSE" | grep -o '"total_fees":[0-9.]*' | cut -d':' -f2)

echo ""
echo "📊 Resultado:"
echo "   Transações processadas: $TRANSACTIONS"
echo "   Receita total: €$REVENUE"
echo "   Fees totais: €$FEES"

echo ""
echo "✅ Verificação completa!"
