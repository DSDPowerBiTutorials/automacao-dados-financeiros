// Script para extrair produtos das transações e inserir na tabela products
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Categorizar produto baseado no valor
function categorizeProduct(amount, description) {
    const absAmount = Math.abs(amount);
    const descLower = (description || '').toLowerCase();

    if (descLower.includes('masterclass') || descLower.includes('master class')) return 'Premium Course';
    if (descLower.includes('residency')) return 'Premium Course';
    if (descLower.includes('clinic fee') || descLower.includes('monthly fee')) return 'Clinic Fee';
    if (descLower.includes('coaching')) return 'Standard Course';
    if (descLower.includes('subscription')) return 'Subscription';
    if (descLower.includes('workshop')) return 'Workshop/Module';

    if (absAmount >= 5000) return 'Premium Course';
    if (absAmount >= 2000) return 'Standard Course';
    if (absAmount >= 500) return 'Workshop/Module';
    if (absAmount >= 100) return 'Subscription';
    return 'Other';
}

// Determinar tipo do produto
function getProductType(description, amount) {
    const descLower = (description || '').toLowerCase();
    if (descLower.includes('subscription') || descLower.includes('monthly') || descLower.includes('fee')) {
        return 'subscription';
    }
    return 'service';
}

async function main() {
    console.log('🔍 Buscando transações desde 01/12/2025...\n');

    // Buscar transações desde 01/12/2025
    const { data, error } = await supabase
        .from('csv_rows')
        .select('custom_data, description, amount, source')
        .in('source', ['braintree-api-revenue', 'gocardless-payments', 'gocardless'])
        .gte('date', '2025-12-01')
        .limit(2000);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`📊 Total transações encontradas: ${data.length}\n`);

    // Extrair produtos únicos
    const products = new Map();

    data.forEach(row => {
        const cd = row.custom_data || {};
        const productName = cd.product_name || cd.description || row.description || '';
        const amount = parseFloat(row.amount) || 0;

        if (productName && productName.length > 2) {
            const key = productName.toLowerCase().trim();
            if (!products.has(key)) {
                products.set(key, {
                    name: productName.trim(),
                    amounts: [amount],
                    count: 1,
                    source: row.source
                });
            } else {
                products.get(key).amounts.push(amount);
                products.get(key).count++;
            }
        }
    });

    console.log(`📦 Produtos únicos encontrados: ${products.size}\n`);

    // Buscar produtos já existentes
    const { data: existingProducts } = await supabase
        .from('products')
        .select('name, code, alternative_names');

    const existingNames = new Set();
    (existingProducts || []).forEach(p => {
        existingNames.add(p.name.toLowerCase());
        (p.alternative_names || []).forEach(n => existingNames.add(n.toLowerCase()));
    });

    console.log(`✅ Produtos já cadastrados: ${existingProducts?.length || 0}\n`);

    // Preparar novos produtos para inserir
    const newProducts = [];
    let counter = 100; // Começar numeração após os pré-cadastrados

    for (const [key, val] of products.entries()) {
        // Verificar se já existe
        if (existingNames.has(key)) {
            console.log(`⏭️  Já existe: ${val.name}`);
            continue;
        }

        const avgPrice = val.amounts.reduce((a, b) => a + b, 0) / val.amounts.length;
        const category = categorizeProduct(avgPrice, val.name);
        const prefix = category.substring(0, 3).toUpperCase();

        counter++;
        const code = `DSD-WEB-${String(counter).padStart(3, '0')}`;

        newProducts.push({
            code,
            name: val.name,
            description: `Produto importado automaticamente da web (${val.source})`,
            default_price: Math.round(avgPrice * 100) / 100,
            currency: 'EUR',
            category,
            product_type: getProductType(val.name, avgPrice),
            scope: 'GLOBAL',
            is_active: true,
            source: val.source,
            alternative_names: []
        });

        console.log(`➕ Novo: ${val.name} (${category}) - €${avgPrice.toFixed(2)} - x${val.count}`);
    }

    console.log(`\n📝 Total de novos produtos a inserir: ${newProducts.length}\n`);

    if (newProducts.length === 0) {
        console.log('✅ Nenhum produto novo para inserir!\n');
        return;
    }

    // Inserir novos produtos
    console.log('💾 Inserindo produtos...\n');

    const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert(newProducts)
        .select();

    if (insertError) {
        console.error('❌ Erro ao inserir:', insertError);
        return;
    }

    console.log(`✅ ${inserted.length} produtos inseridos com sucesso!\n`);

    // Listar produtos inseridos
    inserted.forEach(p => {
        console.log(`  - ${p.code}: ${p.name} (€${p.default_price})`);
    });
}

main().catch(console.error);
