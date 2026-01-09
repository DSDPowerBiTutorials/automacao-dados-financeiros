import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'docs/sample-files/Movimientos_cuenta_corriente_ES7201280074060100064605.xlsx');

console.log('🔍 Analisando arquivo Bankinter EUR...\n');
console.log('📁 Diretório atual:', process.cwd());
console.log('📂 Arquivo procurado:', filePath);

if (!fs.existsSync(filePath)) {
    console.error('\n❌ Arquivo não encontrado!');

    const docsDir = path.join(process.cwd(), 'docs/sample-files');
    if (fs.existsSync(docsDir)) {
        console.log('\n📋 Arquivos disponíveis em docs/sample-files:');
        const files = fs.readdirSync(docsDir);
        files.forEach(f => console.log(`  - ${f}`));
    } else {
        console.log('\n⚠️ Diretório docs/sample-files não existe');
    }

    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    console.log('\n📄 Nome da planilha:', sheetName);
    console.log('📊 Range:', sheet['!ref']);

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][];
    console.log('\n📋 MÉTODO 1 - Primeiras 5 linhas (array):\n');
    rawData.slice(0, 5).forEach((row, i) => {
        console.log(`Linha ${i}:`, JSON.stringify(row));
    });

    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as any[];
    console.log('\n📋 MÉTODO 2 - Primeiros 3 registros (objeto):\n');
    console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));

    console.log('\n🔑 COLUNAS DETECTADAS:');
    if (jsonData.length > 0) {
        const columns = Object.keys(jsonData[0]);
        columns.forEach((col, i) => {
            const sampleValue = jsonData[0][col];
            console.log(`  ${i + 1}. "${col}"`);
            console.log(`     Tipo: ${typeof sampleValue}`);
            console.log(`     Exemplo: ${sampleValue}`);
        });
    }

    console.log('\n✅ Análise completa!');
    console.log(`Total de linhas (array): ${rawData.length}`);
    console.log(`Total de registros (json): ${jsonData.length}`);

    if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        const dateColumns = Object.keys(firstRow).filter(k =>
            k.toLowerCase().includes('fecha') || k.toLowerCase().includes('date') || k.toLowerCase().includes('data')
        );

        if (dateColumns.length > 0) {
            console.log('\n📅 Colunas de Data Detectadas:');
            dateColumns.forEach(col => {
                const value = firstRow[col];
                console.log(`  ${col}: ${value} (tipo: ${typeof value})`);
            });
        }

        const moneyColumns = Object.keys(firstRow).filter(k =>
            k.toLowerCase().includes('debe') ||
            k.toLowerCase().includes('haber') ||
            k.toLowerCase().includes('saldo') ||
            k.toLowerCase().includes('importe')
        );

        if (moneyColumns.length > 0) {
            console.log('\n💰 Colunas Monetárias Detectadas:');
            moneyColumns.forEach(col => {
                const value = firstRow[col];
                console.log(`  ${col}: ${value} (tipo: ${typeof value})`);
            });
        }
    }

    console.log('\n📊 ESTATÍSTICAS:');
    if (jsonData.length > 0) {
        const columns = Object.keys(jsonData[0]);
        const stats: Record<string, any> = {};

        columns.forEach(col => {
            const values = jsonData.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
            stats[col] = {
                total: values.length,
                empty: jsonData.length - values.length,
                tipos: [...new Set(values.map(v => typeof v))]
            };
        });

        Object.entries(stats).forEach(([col, data]) => {
            console.log(`  ${col}: ${data.total} preenchidos, ${data.empty} vazios, tipos: ${data.tipos.join(', ')}`);
        });
    }

} catch (error) {
    console.error('\n❌ Erro ao ler arquivo:', error);
    if (error instanceof Error) {
        console.error('Detalhes:', error.message);
        console.error('Stack:', error.stack);
    }
    process.exit(1);
}
