const sql = require('mssql');

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

async function findOrder() {
  try {
    await sql.connect(config);
    
    // Buscar por diferentes critérios
    console.log('\n=== Buscando por Deal ID 12037674126 ===');
    const byDealId = await sql.query`
      SELECT TOP 5
        d.DealId,
        d.dealname,
        d.amount,
        d.closedate,
        d.dealstage,
        d.hs_object_id,
        d.paid_status,
        d.coupon_code,
        d.total_payment,
        d.website_source,
        c.email,
        c.firstname,
        c.lastname,
        comp.name as company_name,
        li.product_name,
        li.product_quantity,
        li.product_amount,
        li.product_discount
      FROM Deal d
      LEFT JOIN Contact c ON d.associatedcontactid = c.ContactId
      LEFT JOIN Company comp ON d.associatedcompanyid = comp.CompanyId
      LEFT JOIN LineItem li ON d.DealId = li.associateddealid
      WHERE d.DealId = 12037674126
    `;
    console.log(JSON.stringify(byDealId.recordset, null, 2));
    
    console.log('\n=== Buscando por dealname contendo e437d54 ===');
    const byDealname = await sql.query`
      SELECT TOP 5
        d.DealId,
        d.dealname,
        d.amount,
        d.closedate,
        d.dealstage,
        d.hs_object_id,
        d.paid_status,
        d.coupon_code,
        d.total_payment,
        d.website_source,
        c.email,
        c.firstname,
        c.lastname,
        comp.name as company_name,
        li.product_name,
        li.product_quantity,
        li.product_amount,
        li.product_discount
      FROM Deal d
      LEFT JOIN Contact c ON d.associatedcontactid = c.ContactId
      LEFT JOIN Company comp ON d.associatedcompanyid = comp.CompanyId
      LEFT JOIN LineItem li ON d.DealId = li.associateddealid
      WHERE d.dealname LIKE '%e437d54%'
    `;
    console.log(JSON.stringify(byDealname.recordset, null, 2));
    
    console.log('\n=== Buscando por email drhamada@akdentalgroups.com ===');
    const byEmail = await sql.query`
      SELECT TOP 5
        d.DealId,
        d.dealname,
        d.amount,
        d.closedate,
        d.dealstage,
        d.hs_object_id,
        d.paid_status,
        d.coupon_code,
        d.total_payment,
        d.website_source,
        c.email,
        c.firstname,
        c.lastname,
        comp.name as company_name,
        li.product_name,
        li.product_quantity,
        li.product_amount,
        li.product_discount
      FROM Deal d
      LEFT JOIN Contact c ON d.associatedcontactid = c.ContactId
      LEFT JOIN Company comp ON d.associatedcompanyid = comp.CompanyId
      LEFT JOIN LineItem li ON d.DealId = li.associateddealid
      WHERE c.email = 'drhamada@akdentalgroups.com'
    `;
    console.log(JSON.stringify(byEmail.recordset, null, 2));
    
    // Buscar todas as propriedades customizadas da deal
    console.log('\n=== Buscando TODAS as colunas da Deal 12037674126 ===');
    const allColumns = await sql.query`
      SELECT *
      FROM Deal
      WHERE DealId = 12037674126
    `;
    console.log(JSON.stringify(allColumns.recordset, null, 2));
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await sql.close();
  }
}

findOrder();
