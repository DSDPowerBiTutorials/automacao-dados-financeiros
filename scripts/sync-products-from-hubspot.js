/**
 * Sync Products from HubSpot LineItem table
 * 
 * Busca os produtos REAIS da tabela LineItem do HubSpot
 * e insere na tabela products do Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sql = require('mssql');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// SQL Server config (HubSpot database)
const sqlConfig = {
    server: process.env.SQLSERVER_HOST || '',
    database: process.env.SQLSERVER_DATABASE || '',
    user: process.env.SQLSERVER_USER || '',
    password: process.env.SQLSERVER_PASSWORD || '',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000,
        requestTimeout: 60000,
    }
};

async function syncProducts() {
    console.log('🔍 Conectando ao HubSpot SQL Server...\n');

    let pool;
    try {
        pool = await sql.connect(sqlConfig);
        console.log('✅ Conectado ao SQL Server\n');

        // Query para buscar produtos únicos do LineItem
        // Filtra apenas produtos de deals fechados a partir de 01/01/2025
        const query = `
            SELECT DISTINCT
                li.name AS product_name,
                li.description AS product_description,
                li.hs_sku AS product_sku,
                li.price AS default_price,
                COUNT(*) as usage_count,
                SUM(CAST(ISNULL(li.amount, 0) AS DECIMAL(12,2))) as total_revenue
            FROM LineItem li
            INNER JOIN DealLineItemAssociations dlia ON li.LineItemId = dlia.LineItemId
            INNER JOIN Deal d ON d.DealId = dlia.DealId
            WHERE li.name IS NOT NULL 
              AND LEN(TRIM(li.name)) > 0
              AND d.closedate >= '2025-01-01'
            GROUP BY 
                li.name,
                li.description,
                li.hs_sku,
                li.price
            ORDER BY usage_count DESC
        `;

        console.log('🔍 Buscando produtos da tabela LineItem...\n');
        const result = await pool.request().query(query);

        const products = result.recordset;
        console.log(`📦 Total de produtos únicos encontrados: ${products.length}\n`);

        if (products.length === 0) {
            console.log('❌ Nenhum produto encontrado na tabela LineItem');
            return;
        }

        // Mostrar os produtos encontrados
        console.log('📋 Produtos encontrados:\n');
        products.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.product_name}`);
            if (p.product_sku) console.log(`     SKU: ${p.product_sku}`);
            if (p.default_price) console.log(`     Preço: €${parseFloat(p.default_price).toFixed(2)}`);
            console.log(`     Usado em ${p.usage_count} deals (€${parseFloat(p.total_revenue || 0).toFixed(2)} total)`);
            console.log('');
        });

        // Verificar produtos já cadastrados
        const { data: existingProducts, error: existingError } = await supabase
            .from('products')
            .select('name, code');

        if (existingError) {
            console.error('❌ Erro ao buscar produtos existentes:', existingError.message);
            return;
        }

        const existingNames = new Set((existingProducts || []).map(p => p.name?.toLowerCase()));
        console.log(`\n✅ Produtos já cadastrados: ${existingNames.size}`);

        // Filtrar novos produtos
        const newProducts = products.filter(p =>
            !existingNames.has(p.product_name?.toLowerCase())
        );

        console.log(`➕ Novos produtos a inserir: ${newProducts.length}\n`);

        if (newProducts.length === 0) {
            console.log('✅ Todos os produtos já estão cadastrados!');
            return;
        }

        // Limpar tabela antes de inserir (para sincronização limpa)
        console.log('🗑️ Limpando produtos antigos (transações de cartão)...');
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .like('code', 'DSD-WEB-%');

        if (deleteError) {
            console.error('⚠️ Aviso ao limpar:', deleteError.message);
        }

        // Preparar dados para inserção
        const productsToInsert = newProducts.map((p, index) => {
            const code = p.product_sku || `PROD-${String(index + 1).padStart(3, '0')}`;

            // Detectar categoria pelo nome
            let category = 'Other';
            const name = (p.product_name || '').toLowerCase();

            if (name.includes('clinic') || name.includes('clínica')) {
                category = 'Clinic Fee';
            } else if (name.includes('course') || name.includes('curso')) {
                category = 'Course';
            } else if (name.includes('workshop') || name.includes('module')) {
                category = 'Workshop/Module';
            } else if (name.includes('subscription') || name.includes('assinatura')) {
                category = 'Subscription';
            } else if (name.includes('coaching')) {
                category = 'Coaching';
            } else if (name.includes('certification')) {
                category = 'Certification';
            } else if (name.includes('residency')) {
                category = 'Residency';
            } else if (name.includes('planning')) {
                category = 'Planning';
            }

            return {
                code: code,
                name: p.product_name,
                description: p.product_description || null,
                default_price: p.default_price ? parseFloat(p.default_price) : null,
                currency: 'EUR',
                category: category,
                product_type: 'service',
                scope: 'GLOBAL',
                is_active: true,
                source: 'hubspot-lineitem',
                external_id: p.product_sku || null
            };
        });

        // Inserir em lotes
        console.log('💾 Inserindo produtos...\n');

        const batchSize = 50;
        let inserted = 0;

        for (let i = 0; i < productsToInsert.length; i += batchSize) {
            const batch = productsToInsert.slice(i, i + batchSize);

            const { error } = await supabase
                .from('products')
                .insert(batch);

            if (error) {
                console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
            } else {
                inserted += batch.length;
                console.log(`  ✅ Lote ${Math.floor(i / batchSize) + 1}: ${batch.length} produtos inseridos`);
            }
        }

        console.log(`\n✅ ${inserted} produtos inseridos com sucesso!\n`);

        // Listar produtos inseridos
        console.log('📦 Produtos cadastrados:');
        productsToInsert.forEach((p, i) => {
            console.log(`  - ${p.code}: ${p.name} (${p.category})`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);

        if (error.message.includes('Login failed')) {
            console.log('\n💡 Verifique as credenciais do SQL Server no .env.local:');
            console.log('   HUBSPOT_SQL_SERVER=');
            console.log('   HUBSPOT_SQL_DATABASE=');
            console.log('   HUBSPOT_SQL_USER=');
            console.log('   HUBSPOT_SQL_PASSWORD=');
        }
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

syncProducts();
