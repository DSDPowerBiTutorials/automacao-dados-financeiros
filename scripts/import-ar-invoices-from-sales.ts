import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '@/lib/supabase';

// Ajuste o caminho do arquivo CSV conforme necessário
const CSV_PATH = path.resolve(__dirname, '../data/sales-export.csv');

async function main() {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    for (const row of records) {
        if (!row['Invoice Date']) continue; // Só processa vendas com Invoice Date

        // Mapeamento dos campos do print para o modelo de invoice AR
        const payload = {
            invoice_date: row['Invoice Date'],
            order_number: row['Order'],
            customer_name: row['Client'],
            company_name: row['Company'],
            email: row['Email'],
            invoice_amount: parseFloat(row['Total'].replace(',', '.')),
            currency: row['Currency'],
            payment_method_code: row['Payment Method'],
            description: row['Products'],
            notes: row['Note'],
            // Adicione outros campos conforme necessário
        };

        // Checa duplicidade por order_number + invoice_date
        const { data: existing, error: findError } = await supabaseAdmin
            .from('invoices')
            .select('id')
            .eq('order_number', payload.order_number)
            .eq('invoice_date', payload.invoice_date)
            .maybeSingle();
        if (existing) {
            console.log(`Invoice já existe para Order ${payload.order_number} em ${payload.invoice_date}`);
            continue;
        }

        // Insere invoice no AR
        const { error } = await supabaseAdmin.from('invoices').insert([payload]);
        if (error) {
            console.error('Erro ao inserir invoice:', error.message);
        } else {
            console.log(`Invoice criada para Order ${payload.order_number} em ${payload.invoice_date}`);
        }
    }
}

main().catch(console.error);
