#!/bin/bash
# ==============================================
# Script para aplicar migration de padronização
# ==============================================

echo "🔧 Aplicando migration de padronização da tabela csv_rows..."
echo ""

# Ler variáveis de ambiente
source .env.local 2>/dev/null

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Erro: NEXT_PUBLIC_SUPABASE_URL não definida"
    exit 1
fi

# Extrair project ref da URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's|https://\([^.]*\).*|\1|')
echo "📦 Project: $PROJECT_REF"
echo ""

# Mostrar comandos para aplicar via Supabase Dashboard
echo "==================================================="
echo "📋 INSTRUÇÕES PARA APLICAR A MIGRATION"
echo "==================================================="
echo ""
echo "1. Acesse o Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo ""
echo "2. Cole o conteúdo do arquivo:"
echo "   supabase/migrations/20260113_standardize_csv_rows.sql"
echo ""
echo "3. Execute a query"
echo ""
echo "==================================================="
echo ""

# Opção: usar supabase CLI se disponível
if command -v supabase &> /dev/null; then
    echo "💡 Supabase CLI detectado. Você pode usar:"
    echo "   supabase db push --linked"
    echo ""
fi

echo "📄 Conteúdo resumido da migration:"
echo "-----------------------------------"
head -30 supabase/migrations/20260113_standardize_csv_rows.sql
echo "..."
echo "-----------------------------------"
echo ""
echo "✅ Migration criada com sucesso!"
