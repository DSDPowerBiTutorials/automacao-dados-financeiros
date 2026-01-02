#!/bin/bash

# Script para adicionar variáveis de ambiente no Vercel via CLI
# Execute: chmod +x scripts/setup-vercel-env.sh && ./scripts/setup-vercel-env.sh

echo "🚀 Configurando variáveis de ambiente no Vercel..."

# Verificar se Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI não está instalado."
    echo "Instale com: npm install -g vercel"
    exit 1
fi

# SQL Server Data Warehouse
echo "Adicionando SQLSERVER_HOST..."
vercel env add SQLSERVER_HOST production <<< "datawarehouse-io-eur.database.windows.net"

echo "Adicionando SQLSERVER_DATABASE..."
vercel env add SQLSERVER_DATABASE production <<< "Jorge9660"

echo "Adicionando SQLSERVER_USER..."
vercel env add SQLSERVER_USER production <<< "Jorge6368"

echo "Adicionando SQLSERVER_PASSWORD..."
vercel env add SQLSERVER_PASSWORD production <<< "***REMOVED***"

echo "✅ Variáveis configuradas com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Acesse: https://vercel.com/dashboard"
echo "2. Verifique as variáveis em Settings > Environment Variables"
echo "3. Redeploy o projeto se necessário"
