// Script para criar a tabela products via Supabase SQL API
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const createTableSQL = `
-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS product_merges CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Create products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    default_price DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Financial account association
    financial_account_id UUID,
    financial_account_code VARCHAR(50),
    
    -- Department/Cost Center
    department VARCHAR(100),
    cost_center_id UUID,
    cost_center_code VARCHAR(50),
    
    -- Categorization
    category VARCHAR(100),
    product_type VARCHAR(50) DEFAULT 'service',
    
    -- Scope (ES, US, GLOBAL)
    scope VARCHAR(10) DEFAULT 'GLOBAL',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Alternative names for matching
    alternative_names TEXT[] DEFAULT '{}',
    
    -- Merged into
    merged_into_id UUID,
    
    -- Metadata
    source VARCHAR(100),
    external_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create product_merges table
CREATE TABLE product_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_product_id UUID NOT NULL,
    source_product_name VARCHAR(255) NOT NULL,
    source_product_code VARCHAR(50),
    target_product_id UUID NOT NULL,
    merged_by VARCHAR(255),
    merged_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Create indexes
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_scope ON products(scope);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_merges ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all for products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all for product_merges" ON product_merges FOR ALL USING (true);
`;

async function main() {
    console.log('🔧 Criando tabelas products e product_merges...\n');

    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
        console.log('⚠️  Método RPC não disponível, tentando outra abordagem...\n');
        console.log('Por favor, execute o seguinte SQL no Supabase Dashboard:\n');
        console.log('='.repeat(60));
        console.log(createTableSQL);
        console.log('='.repeat(60));
        console.log('\n📋 Copie o SQL acima e execute em:');
        console.log('   Supabase Dashboard → SQL Editor → New Query → Run\n');
    } else {
        console.log('✅ Tabelas criadas com sucesso!\n');
    }
}

main();
