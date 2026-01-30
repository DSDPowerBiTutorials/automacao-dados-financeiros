#!/usr/bin/env node
/**
 * Script para corrigir registros Bankinter EUR que foram salvos com FECHA CONTABLE (D-1)
 * em vez de FECHA VALOR (data real da transação).
 * 
 * Uso: node scripts/fix-bankinter-fecha-valor.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente não configuradas');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '❌');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Converte serial Excel para data ISO usando parse_date_code (evita D-1)
function excelSerialToISO(serial) {
    if (typeof serial !== 'number') return null;
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (!parsed) return null;
    const year = parsed.y;
    const month = String(parsed.m).padStart(2, '0');
    const day = String(parsed.d).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Converte DD/MM/YYYY para ISO
function ddmmyyyyToISO(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length !== 3) return null;
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
}

async function fixBankinterFechaValor() {
    console.log('🔧 Iniciando correção de datas Bankinter EUR...\n');

    // Buscar todos os registros bankinter-eur
    const { data: rows, error } = await supabase
        .from('csv_rows')
        .select('id, date, custom_data')
        .eq('source', 'bankinter-eur');

    if (error) {
        console.error('❌ Erro ao buscar registros:', error.message);
        process.exit(1);
    }

    console.log(`📊 Total de registros encontrados: ${rows.length}\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            const customData = row.custom_data || {};
            const fechaValorRaw = customData.fecha_valor;
            const currentDate = row.date;

            // Se não tem fecha_valor, não tem como corrigir
            if (!fechaValorRaw) {
                skipped++;
                continue;
            }

            // Converter fecha_valor para ISO
            let fechaValorISO;
            if (typeof fechaValorRaw === 'number') {
                fechaValorISO = excelSerialToISO(fechaValorRaw);
            } else if (typeof fechaValorRaw === 'string') {
                fechaValorISO = ddmmyyyyToISO(fechaValorRaw);
            }

            if (!fechaValorISO) {
                console.warn(`⚠️ ID ${row.id}: fecha_valor inválida:`, fechaValorRaw);
                skipped++;
                continue;
            }

            // Se a data atual já é igual à fecha_valor, não precisa atualizar
            if (currentDate === fechaValorISO) {
                skipped++;
                continue;
            }

            // Atualizar registro
            const { error: updateError } = await supabase
                .from('csv_rows')
                .update({
                    date: fechaValorISO,
                    custom_data: {
                        ...customData,
                        fecha_valor_iso: fechaValorISO,
                        _fixed_from_contable: currentDate // manter referência da data antiga
                    }
                })
                .eq('id', row.id);

            if (updateError) {
                console.error(`❌ ID ${row.id}: Erro ao atualizar:`, updateError.message);
                errors++;
            } else {
                console.log(`✅ ID ${row.id}: ${currentDate} → ${fechaValorISO}`);
                updated++;
            }

        } catch (err) {
            console.error(`❌ ID ${row.id}: Exceção:`, err.message);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 RESUMO:');
    console.log(`   ✅ Atualizados: ${updated}`);
    console.log(`   ⏭️  Ignorados (já corretos ou sem fecha_valor): ${skipped}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log('='.repeat(50));
}

fixBankinterFechaValor().catch(console.error);
