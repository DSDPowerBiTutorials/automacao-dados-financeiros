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

async function checkFields() {
  try {
    await sql.connect(config);
    
    console.log('\n=== Buscando campos ecomm da deal do Ahmed Hamada ===');
    const result = await sql.query`
      SELECT 
        d.DealId,
        d.dealname,
        d.amount,
        d.ip__ecomm_bridge__order_number,
        d.ip__ecomm_bridge__order_id,
        d.ecomm_order_number,
        d.website_order_id,
        li.product_name,
        li.product_quantity,
        li.product_amount,
        li.product_discount,
        c.email,
        c.firstname,
        c.lastname
      FROM Deal d
      LEFT JOIN Contact c ON d.associatedcontactid = c.ContactId
      LEFT JOIN LineItem li ON d.DealId = li.associateddealid
      WHERE c.email = 'drhamada@akdentalgroups.com'
        AND d.dealname LIKE '%Miami%'
        AND YEAR(d.closedate) = 2023
      ORDER BY d.closedate DESC
    `;
    
    console.log(JSON.stringify(result.recordset, null, 2));
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await sql.close();
  }
}

checkFields();
