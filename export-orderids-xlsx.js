const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exportToXLSX() {
    console.log('📊 Exportando dados para XLSX...\n');
    
    // Buscar todos os registros Braintree
    const { data, error } = await supabase
        .from('csv_rows')
        .select('id, date, description, amount, customer_name, customer_email, custom_data, reconciled')
        .like('source', 'braintree-api-revenue%')
        .order('date', { ascending: false })
        .limit(2000);
    
    if (error) {
        console.error('Erro:', error.message);
        return;
    }
    
    console.log(`📥 Total registros: ${data.length}`);
    
    // Transformar dados para Excel
    const rows = data.map(row => ({
        'Data': row.date,
        'Transaction ID': row.custom_data?.transaction_id || '',
        'Order ID': row.custom_data?.order_id || '',
        'Cliente': row.customer_name || row.custom_data?.customer_name || '',
        'Email': row.customer_email || row.custom_data?.customer_email || '',
        'Valor': row.amount,
        'Moeda': row.custom_data?.currency || 'EUR',
        'Método Pagamento': row.custom_data?.payment_method || '',
        'Status': row.custom_data?.status || '',
        'Reconciliado': row.reconciled ? 'Sim' : 'Não',
        'Merchant Account': row.custom_data?.merchant_account_id || ''
    }));
    
    // Estatísticas
    const withOrderId = rows.filter(r => r['Order ID'] && r['Order ID'] !== 'null');
    const withoutOrderId = rows.filter(r => !r['Order ID'] || r['Order ID'] === 'null');
    
    console.log(`✅ Com Order ID: ${withOrderId.length}`);
    console.log(`❌ Sem Order ID: ${withoutOrderId.length}`);
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Aba 1: Todos os registros
    const ws1 = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Todos');
    
    // Aba 2: Com Order ID
    const ws2 = XLSX.utils.json_to_sheet(withOrderId);
    XLSX.utils.book_append_sheet(wb, ws2, 'Com Order ID');
    
    // Aba 3: Sem Order ID
    const ws3 = XLSX.utils.json_to_sheet(withoutOrderId);
    XLSX.utils.book_append_sheet(wb, ws3, 'Sem Order ID');
    
    // Salvar arquivo
    const filename = `braintree-orderids-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    console.log(`\n✅ Arquivo salvo: ${filename}`);
}

exportToXLSX();
