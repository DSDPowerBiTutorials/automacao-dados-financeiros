const sql = require('mssql');
require('dotenv').config();

(async () => {
  const config = {
    server: process.env.DB_SERVER,
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
    },
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  };
  
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Conectado ao SQL Server\n');
    
    // Listar todas as tabelas
    const tables = await pool.request()
      .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' ORDER BY TABLE_NAME`);
    
    console.log('📊 TABELAS DISPONÍVEIS:\n');
    tables.recordset.forEach(t => console.log('  • ' + t.TABLE_NAME));
    
    console.log('\n\n📋 ANÁLISE DETALHADA:\n');
    
    for (const table of tables.recordset) {
      const cols = await pool.request()
        .query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.TABLE_NAME}' ORDER BY ORDINAL_POSITION`);
      
      console.log(`\n🔹 ${table.TABLE_NAME} (${cols.recordset.length} colunas)`);
      
      const relevantCols = cols.recordset.filter(c => 
        /name|email|customer|product|client|id/i.test(c.COLUMN_NAME)
      );
      
      if (relevantCols.length > 0) {
        console.log('   Colunas relevantes:');
        relevantCols.forEach(c => console.log(`     - ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
      }
      
      // Mostrar primeiras colunas
      const first5 = cols.recordset.slice(0, 5);
      console.log(`   Primeiras colunas: ${first5.map(c => c.COLUMN_NAME).join(', ')}`);
    }
    
    // Foreign Keys
    console.log('\n\n🔗 RELAÇÕES (Foreign Keys):\n');
    const fks = await pool.request()
      .query(`
        SELECT 
          KCU1.TABLE_NAME,
          KCU1.COLUMN_NAME,
          KCU2.TABLE_NAME AS REFERENCED_TABLE_NAME,
          KCU2.COLUMN_NAME AS REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU1 ON RC.CONSTRAINT_NAME = KCU1.CONSTRAINT_NAME
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU2 ON RC.UNIQUE_CONSTRAINT_NAME = KCU2.CONSTRAINT_NAME
        WHERE RC.CONSTRAINT_SCHEMA = 'dbo'
      `);
    
    if (fks.recordset.length > 0) {
      fks.recordset.forEach(fk => {
        console.log(`  ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('  ⚠️  Nenhuma Foreign Key definida (talvez use IDs soltos)');
    }
    
    await pool.close();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
