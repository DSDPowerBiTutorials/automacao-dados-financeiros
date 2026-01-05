const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.HUBSPOT_SQL_SERVER,
  database: process.env.HUBSPOT_SQL_DATABASE,
  user: process.env.HUBSPOT_SQL_USER,
  password: process.env.HUBSPOT_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  }
};

async function testFields() {
  try {
    await sql.connect(config);
    
    console.log('\n=== TESTANDO CAMPOS DA TABELA DEAL ===\n');
    
    // Buscar deal específico com todos os campos
    const result = await sql.query`
      SELECT TOP 1 *
      FROM Deal
      WHERE DealId = 12037674126
    `;
    
    if (result.recordset && result.recordset[0]) {
      const deal = result.recordset[0];
      const keys = Object.keys(deal);
      
      console.log(`Total de campos encontrados: ${keys.length}\n`);
      
      // Filtrar apenas campos que contêm "ecomm", "order", "website", "billing", "shipping", "payment"
      const relevantFields = keys.filter(k => 
        k.toLowerCase().includes('ecomm') ||
        k.toLowerCase().includes('order') ||
        k.toLowerCase().includes('website') ||
        k.toLowerCase().includes('billing') ||
        k.toLowerCase().includes('shipping') ||
        k.toLowerCase().includes('payment') ||
        k.toLowerCase().includes('address')
      );
      
      console.log('=== CAMPOS RELEVANTES ENCONTRADOS ===');
      relevantFields.forEach(field => {
        console.log(`${field}: ${deal[field]}`);
      });
      
      console.log('\n=== VERIFICANDO CAMPOS ESPECÍFICOS ===');
      const fieldsToCheck = [
        'ip__ecomm_bridge__order_number',
        'ip__ecomm_bridge__order_id', 
        'website_order_id',
        'billing_address',
        'shipping_address',
        'payment_method'
      ];
      
      fieldsToCheck.forEach(field => {
        const exists = keys.includes(field);
        console.log(`${field}: ${exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
        if (exists) console.log(`  Valor: ${deal[field]}`);
      });
    }
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await sql.close();
  }
}

testFields();
