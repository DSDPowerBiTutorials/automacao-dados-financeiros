import sql from 'mssql';

const config: sql.config = {
    server: process.env.SQLSERVER_HOST || '',
    database: process.env.SQLSERVER_DATABASE || '',
    user: process.env.SQLSERVER_USER || '',
    password: process.env.SQLSERVER_PASSWORD || '',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 90000, // 90 segundos - suficiente mas não excessivo
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool: sql.ConnectionPool | null = null;

export async function getSQLServerConnection(): Promise<sql.ConnectionPool> {
    if (!pool) {
        pool = await sql.connect(config);
    }
    return pool;
}

export async function closeSQLServerConnection(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

export { sql };
