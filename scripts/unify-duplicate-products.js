/**
 * Unify Duplicate Products
 * 
 * Identifica produtos com nomes idênticos e unifica automaticamente,
 * mantendo apenas um registro principal e mesclando os demais.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function unifyDuplicates() {
    console.log('🔍 Buscando todos os produtos...\n');

    // Buscar todos os produtos (sem limite)
    let allProducts = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data: batch, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: true })
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('❌ Erro ao buscar produtos:', error.message);
            return;
        }

        if (!batch || batch.length === 0) break;
        allProducts = allProducts.concat(batch);
        offset += batchSize;

        if (batch.length < batchSize) break;
    }

    const products = allProducts;

    console.log(`📦 Total de produtos: ${products.length}\n`);

    // Agrupar por nome (case-insensitive, trim)
    const groups = {};
    products.forEach(p => {
        const normalizedName = (p.name || '').trim().toLowerCase();
        if (!groups[normalizedName]) {
            groups[normalizedName] = [];
        }
        groups[normalizedName].push(p);
    });

    // Encontrar duplicados
    const duplicateGroups = Object.entries(groups).filter(([, items]) => items.length > 1);

    console.log(`🔄 Grupos com duplicados: ${duplicateGroups.length}\n`);

    if (duplicateGroups.length === 0) {
        console.log('✅ Nenhum produto duplicado encontrado!');
        return;
    }

    // Mostrar estatísticas
    let totalDuplicates = 0;
    duplicateGroups.forEach(([name, items]) => {
        totalDuplicates += items.length - 1; // -1 porque um será mantido
    });

    console.log(`📊 Estatísticas:`);
    console.log(`   - Grupos duplicados: ${duplicateGroups.length}`);
    console.log(`   - Produtos a remover: ${totalDuplicates}`);
    console.log(`   - Produtos únicos após unificação: ${products.length - totalDuplicates}\n`);

    // Mostrar top 20 duplicados por quantidade
    const sortedGroups = duplicateGroups.sort((a, b) => b[1].length - a[1].length);
    console.log('📋 Top 20 produtos mais duplicados:\n');
    sortedGroups.slice(0, 20).forEach(([name, items], i) => {
        const displayName = items[0].name.substring(0, 60);
        console.log(`   ${i + 1}. "${displayName}" - ${items.length}x duplicados`);
    });

    console.log('\n🔧 Iniciando unificação...\n');

    let unified = 0;
    let mergeRecords = [];
    let idsToDelete = [];

    for (const [normalizedName, items] of duplicateGroups) {
        // Manter o primeiro (mais antigo) como principal
        const [principal, ...duplicates] = items;

        // Coletar nomes alternativos (se houver variações de case)
        const alternativeNames = new Set(principal.alternative_names || []);
        duplicates.forEach(d => {
            if (d.name !== principal.name) {
                alternativeNames.add(d.name);
            }
            if (d.alternative_names) {
                d.alternative_names.forEach(n => alternativeNames.add(n));
            }
        });

        // Atualizar produto principal com nomes alternativos
        if (alternativeNames.size > 0) {
            await supabase
                .from('products')
                .update({
                    alternative_names: Array.from(alternativeNames),
                    updated_at: new Date().toISOString()
                })
                .eq('id', principal.id);
        }

        // Registrar merges e coletar IDs para deletar
        for (const dup of duplicates) {
            mergeRecords.push({
                source_product_id: dup.id,
                source_product_name: dup.name,
                source_product_code: dup.code,
                target_product_id: principal.id,
                merged_by: 'auto-unify-script',
                notes: `Auto-merged: identical name "${normalizedName}"`
            });
            idsToDelete.push(dup.id);
            unified++;
        }

        // Inserir merges em lotes de 100
        if (mergeRecords.length >= 100) {
            const { error: mergeError } = await supabase
                .from('product_merges')
                .insert(mergeRecords);
            if (mergeError) {
                console.error('⚠️ Erro ao registrar merges:', mergeError.message);
            }
            mergeRecords = [];
        }
    }

    // Inserir merges restantes
    if (mergeRecords.length > 0) {
        const { error: mergeError } = await supabase
            .from('product_merges')
            .insert(mergeRecords);
        if (mergeError) {
            console.error('⚠️ Erro ao registrar merges:', mergeError.message);
        }
    }

    console.log(`📝 ${unified} registros de merge criados\n`);

    // Deletar duplicados em lotes
    console.log(`🗑️ Removendo ${idsToDelete.length} produtos duplicados...\n`);

    const deleteBatchSize = 100;
    let deleted = 0;

    for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
        const batch = idsToDelete.slice(i, i + deleteBatchSize);
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .in('id', batch);

        if (deleteError) {
            console.error(`⚠️ Erro ao deletar lote ${Math.floor(i / batchSize) + 1}:`, deleteError.message);
        } else {
            deleted += batch.length;
            process.stdout.write(`\r   Deletados: ${deleted}/${idsToDelete.length}`);
        }
    }

    console.log('\n');

    // Verificar resultado final
    const { count: finalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    console.log('✅ Unificação concluída!\n');
    console.log(`📊 Resultado:`);
    console.log(`   - Produtos antes: ${products.length}`);
    console.log(`   - Duplicados removidos: ${deleted}`);
    console.log(`   - Produtos após: ${finalCount}`);
}

unifyDuplicates();
