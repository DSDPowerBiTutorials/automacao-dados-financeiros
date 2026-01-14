const sql = require('mssql');
const fs = require('fs');

const config = {
    server: process.env.SQLSERVER_HOST || 'datawarehouse-io-eur.database.windows.net',
    database: process.env.SQLSERVER_DATABASE || 'Jorge9660',
    user: process.env.SQLSERVER_USER || 'Jorge6368',
    password: process.env.SQLSERVER_PASSWORD || 'UUp^QePdo5Wv8aQ6',
    options: {
        encrypt: true,
        trustServerCertificate: false,
    },
};

async function exportHubspotData() {
    console.log('Conectando ao SQL Server...\n');

    try {
        const pool = await sql.connect(config);
        console.log('Conectado!\n');

        // Query apenas colunas de vendas relevantes
        const result = await pool.request().query(`
      SELECT TOP 2000
        DealId AS deal_id,
        dealname AS order_code,
        ip__ecomm_bridge__order_number AS order_number,
        amount,
        amount_in_home_currency,
        deal_currency_code AS currency,
        closedate AS date_ordered,
        createdate AS date_created,
        hs_closed_won_date AS date_paid,
        paid_status,
        total_payment,
        ip__ecomm_bridge__discount_amount AS discount_amount,
        ip__ecomm_bridge__tax_amount AS tax_amount,
        dealstage AS stage,
        pipeline,
        dealtype AS deal_type,
        ecommerce_deal,
        website_order_id,
        coupon_code,
        hs_is_closed,
        hs_is_closed_won
      FROM Deal
      WHERE amount IS NOT NULL OR total_payment IS NOT NULL
      ORDER BY closedate DESC
    `);

        const deals = result.recordset;
        console.log('Total de deals: ' + deals.length + '\n');

        if (deals.length === 0) {
            console.log('Nenhum deal encontrado');
            await pool.close();
            return;
        }

        // Gerar CSV
        const headers = Object.keys(deals[0]);
        const csvLines = [headers.join(',')];

        deals.forEach(row => {
            const values = headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                let str = String(val).replace(/"/g, '""');
                // Converter datas para formato legível
                if (val instanceof Date) {
                    str = val.toISOString().split('T')[0];
                }
                return (str.includes(',') || str.includes('\n') || str.includes('"')) ? '"' + str + '"' : str;
            });
            csvLines.push(values.join(','));
        });

        fs.writeFileSync('data/hubspot-deals-export.csv', csvLines.join('\n'));
        console.log('Exportado: data/hubspot-deals-export.csv');
        console.log(deals.length + ' linhas, ' + headers.length + ' colunas');
        console.log('\nColunas: ' + headers.join(', '));

        await pool.close();
        console.log('\nConcluido!');

    } catch (error) {
        console.error('Erro:', error.message);
    }
}

exportHubspotData();
