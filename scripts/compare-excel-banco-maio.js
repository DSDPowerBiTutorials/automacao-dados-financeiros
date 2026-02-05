/**
 * Comparação: Excel vs Banco de Dados - Maio 2025
 */

// Valores do Excel do usuário (Maio 2025)
const excelValues = {
    '101.0': 172840.4,
    '101.1': 120876,
    '101.2': 0,
    '101.3': 0,
    '101.4': 51477.65,
    '101.5': 486.74,
    '101.6': 0,
    '102.0': 370582,
    '102.1': 122735,
    '102.2': 211747,
    '102.3': 0,
    '102.4': 18000,
    '102.5': 6600,
    '102.6': 5000,
    '102.7': 6500,
    '103.0': 98962.25,
    '103.1': 27506.2,
    '103.2': 24287.88,
    '103.3': 0,
    '103.4': 1572.5,
    '103.5': 36119.02,
    '103.6': 0,
    '103.7': 9476.65,
    '103.8': 0,
    '103.9': 0,
    '104.0': 95441.44,
    '104.1': 27832.07,
    '104.2': 34526.55,
    '104.3': 0,
    '104.4': 2394,
    '104.5': 15632.5,
    '104.6': 0,
    '104.7': 15056.32,
    '105.0': 3670.25,
    '105.1': 3670.25,
    '105.2': 0,
    '105.3': 0,
    '105.4': 0,
};

// Valores do Banco de Dados (Maio 2025) - já verificados
const bancoValues = {
    '101.1': 112876.00,
    '101.4': 51477.65,
    '101.5': 486.74,
    '101.6': 0,
    '102.1': 122735.00,
    '102.2': 211747.00,
    '102.3': 0,
    '102.4': 18000.00,
    '102.5': 6600.00,
    '102.6': 5000.00,
    '102.7': 6500.00,
    '103.1': 27506.20,
    '103.2': 24287.88,
    '103.3': 0,
    '103.4': 1572.50,
    '103.5': 36119.02,
    '103.6': 0,
    '103.7': 9476.65,
    '103.8': 0,
    '103.9': 0,
    '104.1': 27832.07,
    '104.2': 34526.55,
    '104.3': 0,
    '104.4': 2394.00,
    '104.5': 15632.50,
    '104.6': 0,
    '104.7': 15056.32,
    '105.1': 3670.25,
    '105.2': 0,
    '105.3': 0,
    '105.4': 0,
};

// Calcular totais do banco
bancoValues['101.0'] = bancoValues['101.1'] + (bancoValues['101.2'] || 0) + (bancoValues['101.3'] || 0) + bancoValues['101.4'] + bancoValues['101.5'];
bancoValues['102.0'] = bancoValues['102.1'] + (bancoValues['102.2'] || 0) + (bancoValues['102.3'] || 0) + bancoValues['102.4'] + bancoValues['102.5'] + bancoValues['102.6'] + bancoValues['102.7'];
bancoValues['103.0'] = bancoValues['103.1'] + bancoValues['103.2'] + (bancoValues['103.3'] || 0) + bancoValues['103.4'] + bancoValues['103.5'] + (bancoValues['103.6'] || 0) + bancoValues['103.7'];
bancoValues['104.0'] = bancoValues['104.1'] + bancoValues['104.2'] + (bancoValues['104.3'] || 0) + bancoValues['104.4'] + bancoValues['104.5'] + (bancoValues['104.6'] || 0) + bancoValues['104.7'];
bancoValues['105.0'] = bancoValues['105.1'] + (bancoValues['105.2'] || 0) + (bancoValues['105.3'] || 0) + (bancoValues['105.4'] || 0);

console.log('='.repeat(70));
console.log('COMPARAÇÃO: EXCEL vs BANCO DE DADOS - MAIO 2025');
console.log('='.repeat(70));

console.log('\nFA'.padEnd(10), 'Excel'.padStart(14), 'Banco'.padStart(14), 'Diferença'.padStart(14), 'Status');
console.log('-'.repeat(60));

let totalDiff = 0;
const fas = Object.keys(excelValues).sort();

for (const fa of fas) {
    const excel = excelValues[fa] || 0;
    const banco = bancoValues[fa] || 0;
    const diff = excel - banco;

    if (Math.abs(diff) > 0.01) {
        const status = diff > 0 ? '⬆️ Excel maior' : '⬇️ Banco maior';
        console.log(
            fa.padEnd(10),
            excel.toFixed(2).padStart(14),
            banco.toFixed(2).padStart(14),
            diff.toFixed(2).padStart(14),
            status
        );
        totalDiff += diff;
    }
}

console.log('-'.repeat(60));

// Totais
const excelTotal = excelValues['101.0'] + excelValues['102.0'] + excelValues['103.0'] + excelValues['104.0'] + excelValues['105.0'];
const bancoTotal = bancoValues['101.0'] + bancoValues['102.0'] + bancoValues['103.0'] + bancoValues['104.0'] + bancoValues['105.0'];

console.log('\n' + '='.repeat(70));
console.log('📊 RESUMO:');
console.log('   Excel Total Maio 2025:', excelTotal.toFixed(2), '€');
console.log('   Banco Total Maio 2025:', bancoTotal.toFixed(2), '€');
console.log('   DIFERENÇA TOTAL:', (excelTotal - bancoTotal).toFixed(2), '€');
console.log('='.repeat(70));

if (Math.abs(excelTotal - bancoTotal) > 1) {
    console.log('\n⚠️  DISCREPÂNCIA ENCONTRADA!');
    console.log('   A diferença de', (excelTotal - bancoTotal).toFixed(2), '€ está em:');

    // Identificar onde está a diferença
    for (const fa of fas) {
        const excel = excelValues[fa] || 0;
        const banco = bancoValues[fa] || 0;
        const diff = excel - banco;
        if (Math.abs(diff) > 1 && !fa.endsWith('.0')) {
            console.log('   -', fa, ':', diff.toFixed(2), '€');
        }
    }
}
