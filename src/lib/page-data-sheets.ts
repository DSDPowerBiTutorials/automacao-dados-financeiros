/**
 * Centralized catalog of "Ficha Técnica" (Technical Data Sheet) for every page.
 * Each entry describes data sources, how to feed data, and the enrichment chain.
 * Bilingual EN/ES.
 */

export interface DataSheetEntry {
    title: { en: string; es: string };
    dataSources: Array<{
        name: string;
        table: string;
        description: { en: string; es: string };
    }>;
    feedInstructions: { en: string; es: string };
    enrichmentChain: { en: string; es: string };
    /** Optional URL to a tutorial video (Supabase Storage or external) */
    videoUrl?: string;
}

const sheets: Record<string, DataSheetEntry> = {
    // ─── P&L ───────────────────────────────────────────────
    "pnl": {
        title: { en: "Profit & Loss Statement", es: "Estado de Pérdidas y Ganancias" },
        dataSources: [
            { name: "Revenue (Invoice Orders)", table: "csv_rows", description: { en: "Invoice orders from AR classified by financial account code (101.x–105.x)", es: "Invoice orders de Cuentas a Receber classificadas por código de conta financeira (101.x–105.x)" } },
            { name: "Expenses (AP)", table: "invoices", description: { en: "Accounts Payable invoices with cost center allocation", es: "Facturas de Cuentas por Pagar con asignación de centro de coste" } },
            { name: "Financial Accounts", table: "financial_accounts", description: { en: "Account hierarchy (1xx Revenue, 4xx-6xx Expenses)", es: "Jerarquía de cuentas (1xx Ingresos, 4xx-6xx Gastos)" } },
        ],
        feedInstructions: { en: "Revenue: Upload Invoice Orders CSV in Accounts Receivable → Invoice Orders. Classify each product with a financial account code during upload. Expenses: Enter invoices in AP → Invoices.", es: "Ingresos: Subir CSV de Invoice Orders en Cuentas a Receber → Invoice Orders. Clasificar cada producto con un código de cuenta financiera durante la subida. Gastos: Ingresar facturas en CP → Facturas." },
        enrichmentChain: { en: "Invoice Orders CSV → upload popup (FA classification) → csv_rows (source=invoice-orders) → financial_account_code → P&L aggregation by account hierarchy", es: "CSV Invoice Orders → popup de clasificación (conta financeira) → csv_rows (source=invoice-orders) → financial_account_code → Agregación P&L por jerarquía de cuentas" },
    },

    // ─── Executive Cashflow ────────────────────────────────
    "executive-cashflow-bank": {
        title: { en: "Bank Cashflow", es: "Flujo de Caja Bancario" },
        dataSources: [
            { name: "Bank Statements", table: "csv_rows", description: { en: "Bankinter EUR/USD, Sabadell, Chase bank statement rows", es: "Filas de extractos bancarios Bankinter EUR/USD, Sabadell, Chase" } },
            { name: "AR Invoices", table: "ar_invoices", description: { en: "Accounts receivable invoices matched to bank transactions", es: "Facturas de cobro vinculadas a transacciones bancarias" } },
            { name: "Product Mappings", table: "product_pnl_mappings", description: { en: "Map bank inflows to revenue categories", es: "Mapeo de ingresos bancarios a categorías de ingreso" } },
        ],
        feedInstructions: { en: "Upload bank statements via Reports → Bankinter/Sabadell/Chase pages.", es: "Subir extractos bancarios en Reportes → páginas de Bankinter/Sabadell/Chase." },
        enrichmentChain: { en: "Bank CSV → csv_rows (source=bank) → inflow/outflow classification → daily/monthly aggregation → charts", es: "CSV bancario → csv_rows (source=bank) → clasificación ingreso/egreso → agregación diaria/mensual → gráficos" },
    },
    "executive-cashflow-consolidated": {
        title: { en: "Consolidated Cashflow", es: "Flujo de Caja Consolidado" },
        dataSources: [
            { name: "All Bank Sources", table: "csv_rows", description: { en: "Aggregated from all bank statement sources (Bankinter, Sabadell, Chase)", es: "Agregado de todas las fuentes bancarias (Bankinter, Sabadell, Chase)" } },
            { name: "Gateway Revenue", table: "csv_rows", description: { en: "Payment gateway collections (Braintree, Stripe, GoCardless)", es: "Cobros de pasarelas de pago (Braintree, Stripe, GoCardless)" } },
        ],
        feedInstructions: { en: "Automatically consolidates data from all bank and gateway uploads. No additional action needed.", es: "Consolida automáticamente datos de todas las subidas bancarias y de pasarelas. No requiere acción adicional." },
        enrichmentChain: { en: "All csv_rows sources → /api/executive/cashflow/consolidated → currency conversion → unified timeline", es: "Todas las fuentes csv_rows → /api/executive/cashflow/consolidated → conversión de divisa → línea temporal unificada" },
    },
    "executive-cashflow-real": {
        title: { en: "Real Cashflow", es: "Flujo de Caja Real" },
        dataSources: [
            { name: "Bank Statements", table: "csv_rows", description: { en: "Actual bank movements from all accounts", es: "Movimientos bancarios reales de todas las cuentas" } },
        ],
        feedInstructions: { en: "Upload bank statements via Reports pages. Data reflects actual bank balances.", es: "Subir extractos bancarios en las páginas de Reportes. Los datos reflejan saldos bancarios reales." },
        enrichmentChain: { en: "Bank CSV → csv_rows → actual balance calculation → real vs projected comparison", es: "CSV bancario → csv_rows → cálculo de saldo real → comparación real vs proyectado" },
    },
    "executive-kpis": {
        title: { en: "Key Performance Indicators", es: "Indicadores Clave de Rendimiento" },
        dataSources: [
            { name: "Revenue Data", table: "csv_rows", description: { en: "Gateway transaction totals for revenue KPIs", es: "Totales de transacciones de pasarelas para KPIs de ingresos" } },
            { name: "Expense Data", table: "invoices", description: { en: "AP invoice totals for cost KPIs", es: "Totales de facturas CP para KPIs de costes" } },
            { name: "Bank Balances", table: "csv_rows", description: { en: "Latest bank statement balances", es: "Últimos saldos de extractos bancarios" } },
        ],
        feedInstructions: { en: "KPIs auto-calculate from revenue uploads and AP invoices. Keep data up to date for accurate metrics.", es: "Los KPIs se calculan automáticamente de las subidas de ingresos y facturas CP. Mantener los datos actualizados." },
        enrichmentChain: { en: "csv_rows + invoices → API aggregation → KPI calculation (MRR, burn rate, runway, margins)", es: "csv_rows + invoices → Agregación API → Cálculo de KPIs (MRR, burn rate, runway, márgenes)" },
    },
    "executive-performance": {
        title: { en: "Performance Dashboard", es: "Panel de Rendimiento" },
        dataSources: [
            { name: "Revenue Trends", table: "csv_rows", description: { en: "Monthly revenue from all gateway sources", es: "Ingresos mensuales de todas las pasarelas" } },
            { name: "Expense Trends", table: "invoices", description: { en: "Monthly expenses from AP invoices", es: "Gastos mensuales de facturas CP" } },
        ],
        feedInstructions: { en: "Automatically derived from revenue and expense data. Upload CSVs and enter invoices regularly.", es: "Se calcula automáticamente de datos de ingresos y gastos. Subir CSVs e ingresar facturas regularmente." },
        enrichmentChain: { en: "csv_rows + invoices → monthly aggregation → YoY comparison → trend calculation", es: "csv_rows + invoices → agregación mensual → comparación interanual → cálculo de tendencias" },
    },
    "executive-reports": {
        title: { en: "Executive Reports", es: "Informes Ejecutivos" },
        dataSources: [
            { name: "All Financial Data", table: "csv_rows + invoices", description: { en: "Consolidated view from all data sources", es: "Vista consolidada de todas las fuentes de datos" } },
        ],
        feedInstructions: { en: "Reports pull from all available data. Ensure CSVs are uploaded and invoices entered.", es: "Los informes extraen de todos los datos disponibles. Asegurar que los CSVs están subidos y las facturas ingresadas." },
        enrichmentChain: { en: "All sources → report generation → PDF/Excel export", es: "Todas las fuentes → generación de informes → exportación PDF/Excel" },
    },
    "executive-forecasts": {
        title: { en: "Financial Forecasts", es: "Previsiones Financieras" },
        dataSources: [
            { name: "Historical Data", table: "csv_rows + invoices", description: { en: "Past revenue and expense data for trend projection", es: "Datos históricos de ingresos y gastos para proyección de tendencias" } },
        ],
        feedInstructions: { en: "Forecasts are calculated from historical data. More data = better predictions.", es: "Las previsiones se calculan con datos históricos. Más datos = mejores predicciones." },
        enrichmentChain: { en: "Historical csv_rows + invoices → trend analysis → linear projection → forecast charts", es: "csv_rows + invoices históricos → análisis de tendencias → proyección lineal → gráficos de previsión" },
    },

    // ─── Reports (Bank Statements) ─────────────────────────
    "reports-bankinter-eur": {
        title: { en: "Bankinter EUR Statement", es: "Extracto Bankinter EUR" },
        dataSources: [
            { name: "Bankinter EUR CSV", table: "csv_rows", description: { en: "Bank statement rows where source='bankinter-eur'", es: "Filas de extracto bancario donde source='bankinter-eur'" } },
        ],
        feedInstructions: { en: "Upload Bankinter EUR CSV (format: FECHA VALOR, DESCRIPCIÓN, DEBE, HABER). European number format.", es: "Subir CSV Bankinter EUR (formato: FECHA VALOR, DESCRIPCIÓN, DEBE, HABER). Formato numérico europeo." },
        enrichmentChain: { en: "CSV upload → column mapping (date=FECHA VALOR, amount=HABER-DEBE) → csv_rows insert → report display", es: "Subida CSV → mapeo columnas (date=FECHA VALOR, amount=HABER-DEBE) → inserción csv_rows → visualización" },
    },
    "reports-bankinter-usd": {
        title: { en: "Bankinter USD Statement", es: "Extracto Bankinter USD" },
        dataSources: [
            { name: "Bankinter USD CSV", table: "csv_rows", description: { en: "Bank statement rows where source='bankinter-usd'", es: "Filas de extracto bancario donde source='bankinter-usd'" } },
        ],
        feedInstructions: { en: "Upload Bankinter USD CSV. Same format as EUR but in USD currency.", es: "Subir CSV Bankinter USD. Mismo formato que EUR pero en moneda USD." },
        enrichmentChain: { en: "CSV upload → column mapping → csv_rows insert (source='bankinter-usd') → report", es: "Subida CSV → mapeo columnas → inserción csv_rows (source='bankinter-usd') → reporte" },
    },
    "reports-bankinter": {
        title: { en: "Bankinter Combined", es: "Bankinter Combinado" },
        dataSources: [
            { name: "Bankinter EUR + USD", table: "csv_rows", description: { en: "Combined view of both Bankinter currency accounts", es: "Vista combinada de ambas cuentas Bankinter (EUR y USD)" } },
        ],
        feedInstructions: { en: "Upload CSVs separately for EUR and USD accounts.", es: "Subir CSVs por separado para cuentas EUR y USD." },
        enrichmentChain: { en: "csv_rows (source IN bankinter-eur, bankinter-usd) → combined display", es: "csv_rows (source IN bankinter-eur, bankinter-usd) → visualización combinada" },
    },
    "reports-sabadell": {
        title: { en: "Sabadell Statement", es: "Extracto Sabadell" },
        dataSources: [
            { name: "Sabadell CSV", table: "csv_rows", description: { en: "Bank statement rows where source='sabadell'", es: "Filas de extracto bancario donde source='sabadell'" } },
        ],
        feedInstructions: { en: "Upload Sabadell bank statement CSV. European number format.", es: "Subir CSV extracto Sabadell. Formato numérico europeo." },
        enrichmentChain: { en: "CSV upload → parsing → csv_rows (source='sabadell') → report", es: "Subida CSV → parsing → csv_rows (source='sabadell') → reporte" },
    },
    "reports-chase-usd": {
        title: { en: "Chase USD Statement", es: "Extracto Chase USD" },
        dataSources: [
            { name: "Chase CSV", table: "csv_rows", description: { en: "Bank statement rows where source='chase-usd'", es: "Filas de extracto bancario donde source='chase-usd'" } },
        ],
        feedInstructions: { en: "Upload Chase bank statement CSV (US format: MM/DD/YYYY, USD amounts).", es: "Subir CSV extracto Chase (formato US: MM/DD/YYYY, montos en USD)." },
        enrichmentChain: { en: "CSV upload → US date/number parsing → csv_rows (source='chase-usd') → report", es: "Subida CSV → parsing fecha/número US → csv_rows (source='chase-usd') → reporte" },
    },

    // ─── Reports (Payment Gateways) ────────────────────────
    "reports-braintree-eur": {
        title: { en: "Braintree EUR Transactions", es: "Transacciones Braintree EUR" },
        dataSources: [
            { name: "Braintree EUR CSV", table: "csv_rows", description: { en: "Payment transactions where source='braintree-eur'", es: "Transacciones de pago donde source='braintree-eur'" } },
        ],
        feedInstructions: { en: "Upload Braintree settlement report CSV filtered for EUR transactions.", es: "Subir CSV reporte de liquidación Braintree filtrado para transacciones EUR." },
        enrichmentChain: { en: "CSV → parse settlement data → csv_rows (source='braintree-eur') + custom_data (order_id, customer) → report", es: "CSV → parseo datos liquidación → csv_rows (source='braintree-eur') + custom_data (order_id, customer) → reporte" },
    },
    "reports-braintree-usd": {
        title: { en: "Braintree USD Transactions", es: "Transacciones Braintree USD" },
        dataSources: [
            { name: "Braintree USD CSV", table: "csv_rows", description: { en: "Payment transactions where source='braintree-usd'", es: "Transacciones de pago donde source='braintree-usd'" } },
        ],
        feedInstructions: { en: "Upload Braintree settlement report CSV filtered for USD transactions.", es: "Subir CSV reporte de liquidación Braintree filtrado para transacciones USD." },
        enrichmentChain: { en: "CSV → parse settlement data → csv_rows (source='braintree-usd') → report", es: "CSV → parseo datos liquidación → csv_rows (source='braintree-usd') → reporte" },
    },
    "reports-braintree-gbp": {
        title: { en: "Braintree GBP Transactions", es: "Transacciones Braintree GBP" },
        dataSources: [
            { name: "Braintree GBP CSV", table: "csv_rows", description: { en: "Payment transactions where source='braintree-gbp'", es: "Transacciones de pago donde source='braintree-gbp'" } },
        ],
        feedInstructions: { en: "Upload Braintree settlement report CSV filtered for GBP transactions.", es: "Subir CSV reporte de liquidación Braintree filtrado para transacciones GBP." },
        enrichmentChain: { en: "CSV → parse settlement data → csv_rows (source='braintree-gbp') → report", es: "CSV → parseo datos liquidación → csv_rows (source='braintree-gbp') → reporte" },
    },
    "reports-braintree-aud": {
        title: { en: "Braintree AUD Transactions", es: "Transacciones Braintree AUD" },
        dataSources: [
            { name: "Braintree AUD CSV", table: "csv_rows", description: { en: "Payment transactions where source='braintree-aud'", es: "Transacciones de pago donde source='braintree-aud'" } },
        ],
        feedInstructions: { en: "Upload Braintree settlement report CSV filtered for AUD transactions.", es: "Subir CSV reporte de liquidación Braintree filtrado para transacciones AUD." },
        enrichmentChain: { en: "CSV → parse settlement data → csv_rows (source='braintree-aud') → report", es: "CSV → parseo datos liquidación → csv_rows (source='braintree-aud') → reporte" },
    },
    "reports-braintree-amex": {
        title: { en: "Braintree AMEX Transactions", es: "Transacciones Braintree AMEX" },
        dataSources: [
            { name: "Braintree AMEX CSV", table: "csv_rows", description: { en: "AMEX payment transactions via Braintree", es: "Transacciones de pago AMEX vía Braintree" } },
        ],
        feedInstructions: { en: "Upload Braintree AMEX settlement report CSV.", es: "Subir CSV reporte liquidación Braintree AMEX." },
        enrichmentChain: { en: "CSV → parse → csv_rows (source='braintree-amex') → report", es: "CSV → parseo → csv_rows (source='braintree-amex') → reporte" },
    },
    "reports-braintree": {
        title: { en: "Braintree Combined", es: "Braintree Combinado" },
        dataSources: [
            { name: "All Braintree Sources", table: "csv_rows", description: { en: "Combined view of all Braintree currency transactions", es: "Vista combinada de todas las transacciones Braintree por divisa" } },
        ],
        feedInstructions: { en: "Upload CSVs for each Braintree currency account separately.", es: "Subir CSVs para cada cuenta por divisa de Braintree por separado." },
        enrichmentChain: { en: "csv_rows (source LIKE 'braintree-%') → multi-currency aggregation → combined report", es: "csv_rows (source LIKE 'braintree-%') → agregación multi-divisa → reporte combinado" },
    },
    "reports-braintree-transactions": {
        title: { en: "Braintree Transaction Details", es: "Detalles de Transacciones Braintree" },
        dataSources: [
            { name: "Braintree Transactions", table: "csv_rows", description: { en: "Detailed transaction-level data with settlement batch IDs", es: "Datos a nivel de transacción con IDs de lote de liquidación" } },
        ],
        feedInstructions: { en: "Upload Braintree transaction detail reports.", es: "Subir reportes detallados de transacciones Braintree." },
        enrichmentChain: { en: "CSV → parse transaction details → csv_rows + custom_data (settlement_batch_id, order_id) → report", es: "CSV → parseo detalles transacción → csv_rows + custom_data (settlement_batch_id, order_id) → reporte" },
    },
    "reports-stripe-eur": {
        title: { en: "Stripe EUR Transactions", es: "Transacciones Stripe EUR" },
        dataSources: [
            { name: "Stripe EUR CSV", table: "csv_rows", description: { en: "Stripe payment transactions where source='stripe-eur'", es: "Transacciones de pago Stripe donde source='stripe-eur'" } },
        ],
        feedInstructions: { en: "Upload Stripe payout/balance report CSV for EUR account.", es: "Subir CSV reporte de pagos/saldo Stripe para cuenta EUR." },
        enrichmentChain: { en: "CSV → parse Stripe format → csv_rows (source='stripe-eur') → report", es: "CSV → parseo formato Stripe → csv_rows (source='stripe-eur') → reporte" },
    },
    "reports-stripe-usd": {
        title: { en: "Stripe USD Transactions", es: "Transacciones Stripe USD" },
        dataSources: [
            { name: "Stripe USD CSV", table: "csv_rows", description: { en: "Stripe payment transactions where source='stripe-usd'", es: "Transacciones de pago Stripe donde source='stripe-usd'" } },
        ],
        feedInstructions: { en: "Upload Stripe payout/balance report CSV for USD account.", es: "Subir CSV reporte de pagos/saldo Stripe para cuenta USD." },
        enrichmentChain: { en: "CSV → parse Stripe format → csv_rows (source='stripe-usd') → report", es: "CSV → parseo formato Stripe → csv_rows (source='stripe-usd') → reporte" },
    },
    "reports-stripe": {
        title: { en: "Stripe Combined", es: "Stripe Combinado" },
        dataSources: [
            { name: "All Stripe Sources", table: "csv_rows", description: { en: "Combined Stripe EUR + USD transactions", es: "Transacciones Stripe EUR + USD combinadas" } },
        ],
        feedInstructions: { en: "Upload CSVs for each Stripe currency account.", es: "Subir CSVs para cada cuenta Stripe por divisa." },
        enrichmentChain: { en: "csv_rows (source LIKE 'stripe-%') → combined display", es: "csv_rows (source LIKE 'stripe-%') → visualización combinada" },
    },
    "reports-gocardless": {
        title: { en: "GoCardless Transactions", es: "Transacciones GoCardless" },
        dataSources: [
            { name: "GoCardless CSV", table: "csv_rows", description: { en: "Direct debit transactions where source='gocardless'", es: "Transacciones de débito directo donde source='gocardless'" } },
        ],
        feedInstructions: { en: "Upload GoCardless payment export CSV.", es: "Subir CSV exportación de pagos GoCardless." },
        enrichmentChain: { en: "CSV → parse mandates/payments → csv_rows (source='gocardless') → report", es: "CSV → parseo mandatos/pagos → csv_rows (source='gocardless') → reporte" },
    },
    "reports-paypal": {
        title: { en: "PayPal Transactions", es: "Transacciones PayPal" },
        dataSources: [
            { name: "PayPal CSV", table: "csv_rows", description: { en: "PayPal transaction export where source='paypal'", es: "Exportación de transacciones PayPal donde source='paypal'" } },
        ],
        feedInstructions: { en: "Upload PayPal activity report CSV.", es: "Subir CSV reporte de actividad PayPal." },
        enrichmentChain: { en: "CSV → parse PayPal format → csv_rows (source='paypal') → report", es: "CSV → parseo formato PayPal → csv_rows (source='paypal') → reporte" },
    },
    "reports-pleo": {
        title: { en: "Pleo Expenses", es: "Gastos Pleo" },
        dataSources: [
            { name: "Pleo CSV", table: "csv_rows", description: { en: "Corporate card expenses where source='pleo'", es: "Gastos de tarjeta corporativa donde source='pleo'" } },
        ],
        feedInstructions: { en: "Upload Pleo expense export CSV.", es: "Subir CSV exportación de gastos Pleo." },
        enrichmentChain: { en: "CSV → parse Pleo format → csv_rows (source='pleo') → report", es: "CSV → parseo formato Pleo → csv_rows (source='pleo') → reporte" },
    },
    "reports-quickbooks-usd": {
        title: { en: "QuickBooks USD", es: "QuickBooks USD" },
        dataSources: [
            { name: "QuickBooks CSV", table: "csv_rows", description: { en: "QuickBooks transaction export where source='quickbooks-usd'", es: "Exportación de transacciones QuickBooks donde source='quickbooks-usd'" } },
        ],
        feedInstructions: { en: "Upload QuickBooks transaction report CSV.", es: "Subir CSV reporte de transacciones QuickBooks." },
        enrichmentChain: { en: "CSV → parse → csv_rows (source='quickbooks-usd') → report", es: "CSV → parseo → csv_rows (source='quickbooks-usd') → reporte" },
    },
    "reports-hubspot": {
        title: { en: "HubSpot Deals Import", es: "Importación Deals HubSpot" },
        dataSources: [
            { name: "HubSpot CSV", table: "csv_rows", description: { en: "HubSpot deal export with ~50 custom_data fields (order_id, customer, deal stage, etc.)", es: "Exportación de deals HubSpot con ~50 campos custom_data (order_id, customer, etapa de deal, etc.)" } },
        ],
        feedInstructions: { en: "Upload HubSpot deal export CSV. Fields are mapped to custom_data JSONB column.", es: "Subir CSV exportación de deals HubSpot. Los campos se mapean a la columna JSONB custom_data." },
        enrichmentChain: { en: "HubSpot CSV → parse all columns → csv_rows (source='hubspot') + custom_data → link via braintree_transaction_ids", es: "CSV HubSpot → parseo todas las columnas → csv_rows (source='hubspot') + custom_data → vinculación vía braintree_transaction_ids" },
    },

    // ─── Accounts Payable ──────────────────────────────────
    "ap-invoices": {
        title: { en: "AP Invoices", es: "Facturas Cuentas por Pagar" },
        dataSources: [
            { name: "Invoices", table: "invoices", description: { en: "Manual invoice entries with provider, cost center, financial account, and payment details", es: "Entradas manuales de facturas con proveedor, centro de coste, cuenta financiera y detalles de pago" } },
            { name: "Providers", table: "providers", description: { en: "Supplier master data", es: "Datos maestros de proveedores" } },
            { name: "Cost Centers", table: "cost_centers", description: { en: "Organizational cost allocation units", es: "Unidades de asignación de costes organizacionales" } },
            { name: "Financial Accounts", table: "financial_accounts", description: { en: "Accounting hierarchy for expense classification", es: "Jerarquía contable para clasificación de gastos" } },
            { name: "Bank Accounts", table: "bank_accounts", description: { en: "Payment bank account details", es: "Detalles de cuentas bancarias de pago" } },
        ],
        feedInstructions: { en: "Enter invoices manually via the form. Set up master data (providers, cost centers, financial accounts) first.", es: "Ingresar facturas manualmente vía formulario. Configurar datos maestros (proveedores, centros de coste, cuentas financieras) primero." },
        enrichmentChain: { en: "Manual entry → invoices table → linked to cost_centers + financial_accounts → feeds P&L + Departmental PnL", es: "Entrada manual → tabla invoices → vinculada a cost_centers + financial_accounts → alimenta P&L + PnL Departamental" },
        videoUrl: "https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773865549393-02_AP_-_Invoices_creation_and_reconciliation.mp4",
    },
    "ap-payments": {
        title: { en: "AP Payments", es: "Pagos Cuentas por Pagar" },
        dataSources: [
            { name: "Invoices (Paid)", table: "invoices", description: { en: "Invoice payment tracking and scheduling", es: "Seguimiento y programación de pagos de facturas" } },
        ],
        feedInstructions: { en: "Mark invoices as paid in AP → Invoices page. Payments tracked automatically.", es: "Marcar facturas como pagadas en CP → Facturas. Pagos se rastrean automáticamente." },
        enrichmentChain: { en: "Invoice status update → payment date recording → payment schedule tracking", es: "Actualización estado factura → registro fecha de pago → seguimiento calendario de pagos" },
    },
    "ap-schedule": {
        title: { en: "Payment Schedule", es: "Calendario de Pagos" },
        dataSources: [
            { name: "Invoices (Pending)", table: "invoices", description: { en: "Unpaid invoices with due dates for scheduling", es: "Facturas pendientes con fechas de vencimiento para programación" } },
        ],
        feedInstructions: { en: "Enter invoice due dates in AP → Invoices. Schedule updates automatically.", es: "Ingresar fechas de vencimiento en CP → Facturas. El calendario se actualiza automáticamente." },
        enrichmentChain: { en: "invoices (status=pending) → group by due_date → schedule visualization", es: "invoices (status=pendiente) → agrupar por due_date → visualización del calendario" },
    },
    "ap-overview": {
        title: { en: "Accounts Payable Overview", es: "Resumen Cuentas por Pagar" },
        dataSources: [
            { name: "Invoices Summary", table: "invoices", description: { en: "Aggregated AP metrics: total pending, overdue, paid this month", es: "Métricas CP agregadas: total pendiente, vencidas, pagadas este mes" } },
        ],
        feedInstructions: { en: "Overview auto-calculates from AP invoice data. Keep invoices up to date.", es: "El resumen se calcula automáticamente de datos de facturas CP. Mantener facturas actualizadas." },
        enrichmentChain: { en: "invoices → status aggregation → KPI cards + charts", es: "invoices → agregación por estado → tarjetas KPI + gráficos" },
    },

    // ─── AP Master Data ────────────────────────────────────
    "ap-master-providers": {
        title: { en: "Providers Master Data", es: "Datos Maestros de Proveedores" },
        dataSources: [
            { name: "Providers", table: "providers", description: { en: "Supplier registry with contact info, tax ID, and payment terms", es: "Registro de proveedores con info de contacto, NIF y condiciones de pago" } },
        ],
        feedInstructions: { en: "Add providers manually via the form. Required before entering invoices.", es: "Añadir proveedores manualmente vía formulario. Requerido antes de ingresar facturas." },
        enrichmentChain: { en: "Manual entry → providers table → referenced by invoices", es: "Entrada manual → tabla providers → referenciado por invoices" },
    },
    "ap-master-cost-centers": {
        title: { en: "Cost Centers", es: "Centros de Coste" },
        dataSources: [
            { name: "Cost Centers", table: "cost_centers", description: { en: "Department-level cost allocation units", es: "Unidades de asignación de costes a nivel departamental" } },
        ],
        feedInstructions: { en: "Create cost centers before entering invoices. Each center maps to a department.", es: "Crear centros de coste antes de ingresar facturas. Cada centro corresponde a un departamento." },
        enrichmentChain: { en: "Manual entry → cost_centers → used by invoices → feeds Departmental PnL", es: "Entrada manual → cost_centers → usado por invoices → alimenta PnL Departamental" },
    },
    "ap-master-financial-accounts": {
        title: { en: "Financial Accounts", es: "Cuentas Financieras" },
        dataSources: [
            { name: "Financial Accounts", table: "financial_accounts", description: { en: "Chart of accounts (1xx Revenue, 4xx-6xx Expenses, 7xx Other)", es: "Plan de cuentas (1xx Ingresos, 4xx-6xx Gastos, 7xx Otros)" } },
        ],
        feedInstructions: { en: "Set up account hierarchy. Used by both AP invoices and revenue classification.", es: "Configurar jerarquía de cuentas. Usado tanto por facturas CP como por clasificación de ingresos." },
        enrichmentChain: { en: "Manual setup → financial_accounts → referenced by invoices + csv_rows → P&L classification", es: "Configuración manual → financial_accounts → referenciado por invoices + csv_rows → clasificación P&L" },
    },
    "ap-master-departmental-accounts": {
        title: { en: "Departmental Accounts", es: "Cuentas Departamentales" },
        dataSources: [
            { name: "Sub-departments", table: "sub_departments", description: { en: "Sub-department breakdown within cost centers", es: "Desglose de sub-departamentos dentro de centros de coste" } },
        ],
        feedInstructions: { en: "Define sub-departments for granular departmental P&L reporting.", es: "Definir sub-departamentos para informes P&L departamentales granulares." },
        enrichmentChain: { en: "Manual setup → sub_departments → linked to cost_centers → Departmental PnL drill-down", es: "Configuración manual → sub_departments → vinculado a cost_centers → PnL Departamental detallado" },
    },

    // ─── Accounts Receivable ───────────────────────────────
    "ar-overview": {
        title: { en: "Accounts Receivable Overview", es: "Resumen Cuentas por Cobrar" },
        dataSources: [
            { name: "AR Invoices", table: "ar_invoices", description: { en: "Receivable invoices with customer, amount, and status", es: "Facturas por cobrar con cliente, monto y estado" } },
        ],
        feedInstructions: { en: "Enter AR invoices or sync from HubSpot deals. Track collection status.", es: "Ingresar facturas por cobrar o sincronizar desde deals HubSpot. Rastrear estado de cobro." },
        enrichmentChain: { en: "ar_invoices → status tracking → aging analysis → collection KPIs", es: "ar_invoices → seguimiento estado → análisis de antigüedad → KPIs de cobro" },
    },
    "ar-invoices": {
        title: { en: "AR Invoices", es: "Facturas por Cobrar" },
        dataSources: [
            { name: "AR Invoices", table: "ar_invoices", description: { en: "Customer invoices with payment tracking", es: "Facturas de clientes con seguimiento de pagos" } },
        ],
        feedInstructions: { en: "Create invoices manually or import from invoice-orders data.", es: "Crear facturas manualmente o importar de datos de invoice-orders." },
        enrichmentChain: { en: "Manual entry / invoice-orders import → ar_invoices → matched to bank transactions → reconciliation", es: "Entrada manual / importación invoice-orders → ar_invoices → vinculado a transacciones bancarias → conciliación" },
    },
    "ar-invoice-orders": {
        title: { en: "Invoice Orders", es: "Pedidos de Facturación" },
        dataSources: [
            { name: "Invoice Orders CSV", table: "csv_rows", description: { en: "Order data where source='invoice-orders' with custom_data (ID, Number, order_id, FA code)", es: "Datos de pedidos donde source='invoice-orders' con custom_data (ID, Número, order_id, código FA)" } },
        ],
        feedInstructions: { en: "Upload invoice orders CSV. Maps to financial account codes for revenue classification.", es: "Subir CSV de pedidos de facturación. Se mapea a códigos de cuenta financiera para clasificación de ingresos." },
        enrichmentChain: { en: "CSV → csv_rows (source='invoice-orders') + custom_data → financial_account_code → links to HubSpot orders → P&L revenue", es: "CSV → csv_rows (source='invoice-orders') + custom_data → financial_account_code → vinculación pedidos HubSpot → ingresos P&L" },
        videoUrl: "https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773861812567-01_AC_-_Invoice_Orders_Upload_Flow.mp4",
    },
    "ar-master-customers": {
        title: { en: "Customers Master Data", es: "Datos Maestros Clientes" },
        dataSources: [
            { name: "Customers", table: "customers", description: { en: "Customer registry with contact and billing information", es: "Registro de clientes con información de contacto y facturación" } },
        ],
        feedInstructions: { en: "Add customers manually or import from HubSpot contacts.", es: "Añadir clientes manualmente o importar desde contactos HubSpot." },
        enrichmentChain: { en: "Manual entry / HubSpot sync → customers → referenced by ar_invoices", es: "Entrada manual / sync HubSpot → customers → referenciado por ar_invoices" },
    },
    "ar-master-products": {
        title: { en: "Products Master Data", es: "Datos Maestros Productos" },
        dataSources: [
            { name: "Products", table: "products", description: { en: "Product catalog with pricing and financial account mapping", es: "Catálogo de productos con precios y mapeo a cuentas financieras" } },
            { name: "PnL Mappings", table: "product_pnl_mappings", description: { en: "Product-to-financial-account mapping for revenue classification", es: "Mapeo producto-a-cuenta-financiera para clasificación de ingresos" } },
        ],
        feedInstructions: { en: "Set up products and link them to financial accounts for automatic revenue classification.", es: "Configurar productos y vincularlos a cuentas financieras para clasificación automática de ingresos." },
        enrichmentChain: { en: "Manual setup → products + product_pnl_mappings → used by invoice-orders → Sales Insights + P&L", es: "Configuración manual → products + product_pnl_mappings → usado por invoice-orders → Sales Insights + P&L" },
    },

    // ─── Reconciliation ────────────────────────────────────
    "reconciliation-center": {
        title: { en: "Reconciliation Center", es: "Centro de Conciliación" },
        dataSources: [
            { name: "Bank Transactions", table: "csv_rows", description: { en: "Bank statement rows (bankinter, sabadell, chase)", es: "Filas extractos bancarios (bankinter, sabadell, chase)" } },
            { name: "Gateway Transactions", table: "csv_rows", description: { en: "Payment gateway rows (braintree, stripe, gocardless)", es: "Filas pasarelas de pago (braintree, stripe, gocardless)" } },
            { name: "CSV Files Metadata", table: "csv_files", description: { en: "Upload metadata for tracking reconciliation batches", es: "Metadatos de subidas para seguimiento de lotes de conciliación" } },
        ],
        feedInstructions: { en: "Upload bank statements AND gateway reports. Reconciliation matches transactions within ±3 days and approximate amounts.", es: "Subir extractos bancarios Y reportes de pasarelas. La conciliación hace match de transacciones dentro de ±3 días y montos aproximados." },
        enrichmentChain: { en: "csv_rows (bank) ↔ csv_rows (gateway) → date match (±3 days) + amount match (<0.01) → reconciled=true + matched_with", es: "csv_rows (banco) ↔ csv_rows (pasarela) → match fecha (±3 días) + match monto (<0.01) → reconciled=true + matched_with" },
    },
    "braintree-reconciliation": {
        title: { en: "Braintree Reconciliation", es: "Conciliación Braintree" },
        dataSources: [
            { name: "Braintree Transactions", table: "csv_rows", description: { en: "Braintree gateway transactions for matching", es: "Transacciones Braintree para matching" } },
            { name: "Bank Transactions", table: "csv_rows", description: { en: "Bank records to match against", es: "Registros bancarios para conciliar" } },
        ],
        feedInstructions: { en: "Upload Braintree settlement reports and corresponding bank statements.", es: "Subir reportes de liquidación Braintree y extractos bancarios correspondientes." },
        enrichmentChain: { en: "Braintree csv_rows ↔ Bank csv_rows → settlement batch matching → reconciliation report", es: "csv_rows Braintree ↔ csv_rows banco → matching por lote de liquidación → reporte de conciliación" },
    },

    // ─── Departmental ──────────────────────────────────────
    "departmental-pnl": {
        title: { en: "Departmental P&L", es: "P&L Departamental" },
        dataSources: [
            { name: "Invoices by Department", table: "invoices", description: { en: "AP invoices grouped by cost_center and sub_department", es: "Facturas CP agrupadas por cost_center y sub_department" } },
            { name: "Cost Centers", table: "cost_centers", description: { en: "Department definitions for grouping", es: "Definiciones de departamentos para agrupación" } },
            { name: "Sub-departments", table: "sub_departments", description: { en: "Granular department breakdown", es: "Desglose granular por sub-departamento" } },
        ],
        feedInstructions: { en: "Enter invoices with cost center + sub-department in AP → Invoices.", es: "Ingresar facturas con centro de coste + sub-departamento en CP → Facturas." },
        enrichmentChain: { en: "invoices → group by cost_center → sub_department drill-down → monthly comparison → department P&L report", es: "invoices → agrupar por cost_center → desglose sub_department → comparación mensual → reporte P&L departamental" },
    },
    "departmental-contracts": {
        title: { en: "Contracts", es: "Contratos" },
        dataSources: [
            { name: "Contracts", table: "contracts", description: { en: "Vendor/service contracts with renewal dates", es: "Contratos de proveedores/servicios con fechas de renovación" } },
        ],
        feedInstructions: { en: "Enter contracts manually. Track renewal dates and terms.", es: "Ingresar contratos manualmente. Rastrear fechas de renovación y condiciones." },
        enrichmentChain: { en: "Manual entry → contracts → linked to providers + cost_centers → renewal alerts", es: "Entrada manual → contracts → vinculado a providers + cost_centers → alertas de renovación" },
    },

    // ─── Sales Insights ────────────────────────────────────
    "sales-clinics": {
        title: { en: "Sales Insights — Clinics", es: "Insights de Ventas — Clínicas" },
        dataSources: [
            { name: "Clinic Revenue", table: "csv_rows", description: { en: "Invoice orders with financial account codes 102.x (Clinics)", es: "Pedidos de facturación con códigos de cuenta financiera 102.x (Clínicas)" } },
            { name: "Product Mappings", table: "product_pnl_mappings", description: { en: "Product-to-clinic revenue mapping", es: "Mapeo producto-a-ingresos de clínica" } },
        ],
        feedInstructions: { en: "Upload invoice orders with correct financial account codes (102.x for Clinics).", es: "Subir pedidos de facturación con códigos de cuenta financiera correctos (102.x para Clínicas)." },
        enrichmentChain: { en: "csv_rows (source='invoice-orders') → filter FA code 102.x → product_pnl_mappings → clinic revenue breakdown", es: "csv_rows (source='invoice-orders') → filtrar código FA 102.x → product_pnl_mappings → desglose de ingresos por clínica" },
    },
    "sales-lab": {
        title: { en: "Sales Insights — Lab", es: "Insights de Ventas — Laboratorio" },
        dataSources: [
            { name: "Lab Revenue", table: "csv_rows", description: { en: "Invoice orders with financial account codes 104.x (Lab)", es: "Pedidos de facturación con códigos de cuenta financiera 104.x (Laboratorio)" } },
            { name: "Product Mappings", table: "product_pnl_mappings", description: { en: "Product-to-lab revenue mapping", es: "Mapeo producto-a-ingresos de laboratorio" } },
        ],
        feedInstructions: { en: "Upload invoice orders with correct financial account codes (104.x for Lab).", es: "Subir pedidos de facturación con códigos de cuenta financiera correctos (104.x para Lab)." },
        enrichmentChain: { en: "csv_rows (source='invoice-orders') → filter FA code 104.x → product_pnl_mappings → lab revenue breakdown", es: "csv_rows (source='invoice-orders') → filtrar código FA 104.x → product_pnl_mappings → desglose de ingresos de laboratorio" },
    },
    "sales-courses": {
        title: { en: "Sales Insights — Courses", es: "Insights de Ventas — Cursos" },
        dataSources: [
            { name: "Course Revenue", table: "csv_rows", description: { en: "Invoice orders for course-related revenue", es: "Pedidos de facturación para ingresos de cursos" } },
        ],
        feedInstructions: { en: "Upload invoice orders tagged with course products.", es: "Subir pedidos de facturación etiquetados con productos de cursos." },
        enrichmentChain: { en: "csv_rows (source='invoice-orders') → course product filter → revenue aggregation", es: "csv_rows (source='invoice-orders') → filtro productos curso → agregación de ingresos" },
    },

    // ─── Cash Management ───────────────────────────────────
    "cash-management-overview": {
        title: { en: "Cash Management Overview", es: "Resumen Gestión de Tesorería" },
        dataSources: [
            { name: "Bank Balances", table: "csv_rows", description: { en: "Latest balances from all bank accounts", es: "Últimos saldos de todas las cuentas bancarias" } },
        ],
        feedInstructions: { en: "Keep bank statements uploaded for accurate balance tracking.", es: "Mantener extractos bancarios subidos para seguimiento preciso de saldos." },
        enrichmentChain: { en: "csv_rows (bank sources) → latest balance per account → consolidated treasury view", es: "csv_rows (fuentes bancarias) → último saldo por cuenta → vista consolidada de tesorería" },
    },
    "cash-management-bank-accounts": {
        title: { en: "Bank Accounts Registry", es: "Registro de Cuentas Bancarias" },
        dataSources: [
            { name: "Bank Accounts", table: "bank_accounts", description: { en: "Bank account master data with IBAN, currency, and entity details", es: "Datos maestros de cuentas bancarias con IBAN, divisa y datos de entidad" } },
        ],
        feedInstructions: { en: "Add bank accounts manually. Required for AP invoice payment allocation.", es: "Añadir cuentas bancarias manualmente. Requerido para asignación de pagos de facturas CP." },
        enrichmentChain: { en: "Manual entry → bank_accounts → referenced by invoices + cash management", es: "Entrada manual → bank_accounts → referenciado por invoices + gestión de tesorería" },
    },
    "cash-management-bank-statements": {
        title: { en: "Bank Statements Management", es: "Gestión de Extractos Bancarios" },
        dataSources: [
            { name: "CSV Files", table: "csv_files", description: { en: "Uploaded bank statement files with metadata", es: "Archivos de extractos bancarios subidos con metadatos" } },
            { name: "Statement Rows", table: "csv_rows", description: { en: "Parsed transaction rows from bank statements", es: "Filas de transacciones parseadas de extractos bancarios" } },
        ],
        feedInstructions: { en: "Upload bank statement CSVs via the respective report page.", es: "Subir CSVs de extractos bancarios vía la página de reporte correspondiente." },
        enrichmentChain: { en: "CSV upload → csv_files metadata → csv_rows parsed → bank statement view", es: "Subida CSV → metadatos csv_files → csv_rows parseados → vista de extracto bancario" },
    },
    "cash-management-payment-channels": {
        title: { en: "Payment Channels", es: "Canales de Pago" },
        dataSources: [
            { name: "Gateway Summary", table: "csv_rows", description: { en: "Aggregated data from all payment gateways", es: "Datos agregados de todas las pasarelas de pago" } },
        ],
        feedInstructions: { en: "Data aggregated automatically from gateway uploads (Braintree, Stripe, GoCardless, PayPal).", es: "Datos agregados automáticamente de subidas de pasarelas (Braintree, Stripe, GoCardless, PayPal)." },
        enrichmentChain: { en: "csv_rows (gateway sources) → group by source → channel comparison + trends", es: "csv_rows (fuentes pasarelas) → agrupar por source → comparación de canales + tendencias" },
    },
    "chase-quickbooks": {
        title: { en: "Chase / QuickBooks", es: "Chase / QuickBooks" },
        dataSources: [
            { name: "Chase Transactions", table: "csv_rows", description: { en: "Chase bank transactions (checking + savings)", es: "Transacciones bancarias Chase (checking + savings)" } },
        ],
        feedInstructions: { en: "Upload Chase CSV statements for Business Checking and Savings accounts.", es: "Subir CSVs de Chase para cuentas Business Checking y Savings." },
        enrichmentChain: { en: "CSV → csv_rows (source='chase-*') → account-level views", es: "CSV → csv_rows (source='chase-*') → vistas por cuenta" },
    },

    // ─── HubSpot ───────────────────────────────────────────
    "hubspot-companies": {
        title: { en: "HubSpot Companies", es: "Empresas HubSpot" },
        dataSources: [
            { name: "HubSpot Companies", table: "hubspot_companies", description: { en: "Company data synced from HubSpot CRM", es: "Datos de empresas sincronizados desde HubSpot CRM" } },
        ],
        feedInstructions: { en: "Synced automatically via HubSpot API integration. Configure in Settings → Integrations.", es: "Sincronizado automáticamente vía integración API HubSpot. Configurar en Ajustes → Integraciones." },
        enrichmentChain: { en: "HubSpot API → hubspot_companies → linked to contacts + deals", es: "API HubSpot → hubspot_companies → vinculado a contactos + deals" },
    },
    "hubspot-contacts": {
        title: { en: "HubSpot Contacts", es: "Contactos HubSpot" },
        dataSources: [
            { name: "HubSpot Contacts", table: "hubspot_contacts", description: { en: "Contact data synced from HubSpot CRM", es: "Datos de contactos sincronizados desde HubSpot CRM" } },
        ],
        feedInstructions: { en: "Synced automatically via HubSpot API integration.", es: "Sincronizado automáticamente vía integración API HubSpot." },
        enrichmentChain: { en: "HubSpot API → hubspot_contacts → linked to companies + deals", es: "API HubSpot → hubspot_contacts → vinculado a empresas + deals" },
    },
    "hubspot-pipeline": {
        title: { en: "HubSpot Pipeline", es: "Pipeline HubSpot" },
        dataSources: [
            { name: "HubSpot Deals", table: "csv_rows", description: { en: "Deal pipeline from HubSpot with stage tracking", es: "Pipeline de deals de HubSpot con seguimiento de etapas" } },
        ],
        feedInstructions: { en: "Upload HubSpot deal export or sync via API.", es: "Subir exportación de deals HubSpot o sincronizar vía API." },
        enrichmentChain: { en: "HubSpot deals → csv_rows (source='hubspot') → pipeline stage grouping → funnel visualization", es: "Deals HubSpot → csv_rows (source='hubspot') → agrupación por etapa → visualización del funnel" },
    },
    "hubspot-settings": {
        title: { en: "HubSpot Settings", es: "Configuración HubSpot" },
        dataSources: [
            { name: "Integration Config", table: "system_settings", description: { en: "HubSpot API credentials and sync configuration", es: "Credenciales API HubSpot y configuración de sincronización" } },
        ],
        feedInstructions: { en: "Configure HubSpot API key and sync preferences.", es: "Configurar clave API HubSpot y preferencias de sincronización." },
        enrichmentChain: { en: "Settings → API connection → scheduled/manual sync → data refresh", es: "Ajustes → conexión API → sincronización programada/manual → actualización de datos" },
    },

    // ─── People / Payroll ──────────────────────────────────
    "payroll": {
        title: { en: "Payroll", es: "Nóminas" },
        dataSources: [
            { name: "Payroll Uploads", table: "payroll_uploads", description: { en: "Monthly payroll files with employee data, departments, and salary details", es: "Archivos mensuales de nómina con datos de empleados, departamentos y detalles salariales" } },
        ],
        feedInstructions: { en: "Upload monthly payroll Excel/CSV via the upload button. Format: employee name, department, salary concepts.", es: "Subir nómina mensual en Excel/CSV vía botón de subida. Formato: nombre empleado, departamento, conceptos salariales." },
        enrichmentChain: { en: "Excel upload → /api/payroll/upload → payroll_uploads (JSON data) → employee/department views", es: "Subida Excel → /api/payroll/upload → payroll_uploads (datos JSON) → vistas por empleado/departamento" },
    },
    "payroll-master-data": {
        title: { en: "Payroll Master Data", es: "Datos Maestros Nóminas" },
        dataSources: [
            { name: "Payroll Concepts", table: "payroll_concepts", description: { en: "Salary concept definitions (base salary, bonuses, deductions)", es: "Definiciones de conceptos salariales (salario base, bonificaciones, deducciones)" } },
        ],
        feedInstructions: { en: "Set up payroll concepts before uploading payroll data.", es: "Configurar conceptos de nómina antes de subir datos de nómina." },
        enrichmentChain: { en: "Manual setup → payroll_concepts → referenced by payroll_uploads", es: "Configuración manual → payroll_concepts → referenciado por payroll_uploads" },
    },

    // ─── Actions / Tools ───────────────────────────────────
    "bot-logs": {
        title: { en: "Bot Logs", es: "Logs del Bot" },
        dataSources: [
            { name: "Bot Activity", table: "bot_logs", description: { en: "Automated bot execution logs with status and results", es: "Logs de ejecución de bot automatizado con estado y resultados" } },
        ],
        feedInstructions: { en: "Logs are generated automatically by system bots. No manual input needed.", es: "Los logs se generan automáticamente por bots del sistema. No requiere entrada manual." },
        enrichmentChain: { en: "Bot execution → log entry → status tracking → error alerting", es: "Ejecución bot → entrada de log → seguimiento estado → alerta de errores" },
    },
    "integration-insights": {
        title: { en: "Integration Insights", es: "Insights de Integraciones" },
        dataSources: [
            { name: "Sync Metadata", table: "sync_metadata", description: { en: "Integration sync status, last run times, and error counts", es: "Estado de sincronización, últimas ejecuciones y conteo de errores" } },
        ],
        feedInstructions: { en: "Automatically tracked for all configured integrations.", es: "Rastreado automáticamente para todas las integraciones configuradas." },
        enrichmentChain: { en: "Integration runs → sync_metadata → health dashboard → alerts", es: "Ejecuciones de integración → sync_metadata → dashboard de salud → alertas" },
    },

    // ─── Settings ──────────────────────────────────────────
    "settings-users": {
        title: { en: "User Management", es: "Gestión de Usuarios" },
        dataSources: [
            { name: "Users", table: "profiles", description: { en: "User accounts with roles and permissions", es: "Cuentas de usuario con roles y permisos" } },
        ],
        feedInstructions: { en: "Add/manage users via the admin panel. Assign roles for access control.", es: "Añadir/gestionar usuarios vía panel admin. Asignar roles para control de acceso." },
        enrichmentChain: { en: "Admin action → profiles → auth system → role-based page access", es: "Acción admin → profiles → sistema auth → acceso por roles" },
    },
    "settings-roles": {
        title: { en: "Roles & Permissions", es: "Roles y Permisos" },
        dataSources: [
            { name: "Roles", table: "roles", description: { en: "Role definitions with permission sets", es: "Definiciones de roles con conjuntos de permisos" } },
        ],
        feedInstructions: { en: "Define roles and assign to users. Controls page and action access.", es: "Definir roles y asignar a usuarios. Controla acceso a páginas y acciones." },
        enrichmentChain: { en: "Role definition → assign to profiles → access control enforcement", es: "Definición de rol → asignar a profiles → aplicación control de acceso" },
    },
    "settings-audit": {
        title: { en: "Audit Log", es: "Log de Auditoría" },
        dataSources: [
            { name: "Audit Trail", table: "audit_logs", description: { en: "System-wide action audit trail", es: "rastro de auditoría de acciones del sistema" } },
        ],
        feedInstructions: { en: "Automatically logged for all user actions. No manual input needed.", es: "Se registra automáticamente para todas las acciones de usuario. No requiere entrada manual." },
        enrichmentChain: { en: "User action → audit_logs → searchable audit trail", es: "Acción usuario → audit_logs → rastro de auditoría buscable" },
    },
    "settings-notifications": {
        title: { en: "Notification Settings", es: "Configuración de Notificaciones" },
        dataSources: [
            { name: "Notification Preferences", table: "notification_settings", description: { en: "User notification preferences and channels", es: "Preferencias de notificación por usuario y canal" } },
        ],
        feedInstructions: { en: "Configure notification preferences per user.", es: "Configurar preferencias de notificación por usuario." },
        enrichmentChain: { en: "User preferences → notification_settings → event triggers → delivery", es: "Preferencias usuario → notification_settings → triggers de eventos → entrega" },
    },
    "settings-integrations": {
        title: { en: "Integrations", es: "Integraciones" },
        dataSources: [
            { name: "Integration Config", table: "integrations", description: { en: "External service connections (HubSpot, Braintree, etc.)", es: "Conexiones a servicios externos (HubSpot, Braintree, etc.)" } },
        ],
        feedInstructions: { en: "Configure API credentials for external service integrations.", es: "Configurar credenciales API para integraciones con servicios externos." },
        enrichmentChain: { en: "Credentials → integrations → API connection → data sync", es: "Credenciales → integrations → conexión API → sincronización de datos" },
    },
    "settings-botella": {
        title: { en: "Botella Bot Settings", es: "Configuración Bot Botella" },
        dataSources: [
            { name: "Bot Templates", table: "bot_templates", description: { en: "Automated task templates and schedules", es: "Plantillas de tareas automatizadas y horarios" } },
        ],
        feedInstructions: { en: "Create and configure bot task templates.", es: "Crear y configurar plantillas de tareas del bot." },
        enrichmentChain: { en: "Template config → bot_templates → scheduled execution → bot_logs", es: "Configuración plantilla → bot_templates → ejecución programada → bot_logs" },
    },
    "settings-security": {
        title: { en: "Security Settings", es: "Configuración de Seguridad" },
        dataSources: [
            { name: "Security Config", table: "system_settings", description: { en: "Security policies, 2FA settings, session management", es: "Políticas de seguridad, configuración 2FA, gestión de sesiones" } },
        ],
        feedInstructions: { en: "Configure security policies for the organization.", es: "Configurar políticas de seguridad para la organización." },
        enrichmentChain: { en: "Admin settings → system_settings → security enforcement", es: "Ajustes admin → system_settings → aplicación de seguridad" },
    },
    "settings-system": {
        title: { en: "System Settings", es: "Configuración del Sistema" },
        dataSources: [
            { name: "System Config", table: "system_settings", description: { en: "Global system configuration (timezone, currency, defaults)", es: "Configuración global del sistema (zona horaria, divisa, valores por defecto)" } },
        ],
        feedInstructions: { en: "Configure system-wide defaults.", es: "Configurar valores por defecto del sistema." },
        enrichmentChain: { en: "Admin settings → system_settings → applied across all modules", es: "Ajustes admin → system_settings → aplicado en todos los módulos" },
    },
    "settings-profile": {
        title: { en: "Profile Settings", es: "Configuración de Perfil" },
        dataSources: [
            { name: "User Profile", table: "profiles", description: { en: "Current user's profile and preferences", es: "Perfil y preferencias del usuario actual" } },
        ],
        feedInstructions: { en: "Update your profile information and preferences.", es: "Actualizar tu información de perfil y preferencias." },
        enrichmentChain: { en: "User edit → profiles → display across app", es: "Edición usuario → profiles → visualización en toda la app" },
    },

    // ─── Workstream ────────────────────────────────────────
    "workstream-goals": {
        title: { en: "Goals", es: "Objetivos" },
        dataSources: [
            { name: "Goals", table: "goals", description: { en: "Team and individual goals with progress tracking", es: "Objetivos de equipo e individuales con seguimiento de progreso" } },
        ],
        feedInstructions: { en: "Create goals and link to projects/tasks.", es: "Crear objetivos y vincular a proyectos/tareas." },
        enrichmentChain: { en: "Goal creation → goals → linked to tasks/projects → progress calculation", es: "Creación objetivo → goals → vinculado a tareas/proyectos → cálculo progreso" },
    },
    "workstream-inbox": {
        title: { en: "Inbox", es: "Bandeja de Entrada" },
        dataSources: [
            { name: "Notifications", table: "notifications", description: { en: "Task assignments, mentions, and updates", es: "Asignaciones de tareas, menciones y actualizaciones" } },
        ],
        feedInstructions: { en: "Notifications arrive automatically from task and project activity.", es: "Las notificaciones llegan automáticamente de actividad de tareas y proyectos." },
        enrichmentChain: { en: "Activity events → notifications → inbox → read/action", es: "Eventos de actividad → notifications → bandeja → lectura/acción" },
    },
    "workstream-my-tasks": {
        title: { en: "My Tasks", es: "Mis Tareas" },
        dataSources: [
            { name: "Tasks", table: "tasks", description: { en: "Tasks assigned to current user", es: "Tareas asignadas al usuario actual" } },
        ],
        feedInstructions: { en: "Tasks assigned to you appear here. Create tasks in project boards.", es: "Las tareas asignadas a ti aparecen aquí. Crear tareas en tableros de proyectos." },
        enrichmentChain: { en: "tasks (assigned_to=current_user) → filtered view → status tracking", es: "tasks (assigned_to=usuario_actual) → vista filtrada → seguimiento estado" },
    },
    "workstream-portfolios": {
        title: { en: "Portfolios", es: "Portafolios" },
        dataSources: [
            { name: "Portfolios", table: "portfolios", description: { en: "Project portfolio groupings with status overview", es: "Agrupaciones de portafolio de proyectos con resumen de estado" } },
        ],
        feedInstructions: { en: "Create portfolios to group related projects.", es: "Crear portafolios para agrupar proyectos relacionados." },
        enrichmentChain: { en: "Portfolio creation → linked projects → aggregated status → overview", es: "Creación portafolio → proyectos vinculados → estado agregado → resumen" },
    },
    "workstream-reporting": {
        title: { en: "Workstream Reports", es: "Reportes Workstream" },
        dataSources: [
            { name: "Tasks & Projects", table: "tasks + projects", description: { en: "Aggregated project and task metrics", es: "Métricas agregadas de proyectos y tareas" } },
        ],
        feedInstructions: { en: "Reports auto-generate from task and project data.", es: "Los reportes se generan automáticamente de datos de tareas y proyectos." },
        enrichmentChain: { en: "tasks + projects → metrics aggregation → charts + burndown", es: "tasks + projects → agregación métricas → gráficos + burndown" },
    },
    "workstream-teams": {
        title: { en: "Teams", es: "Equipos" },
        dataSources: [
            { name: "Teams", table: "teams", description: { en: "Team definitions with members and projects", es: "Definiciones de equipos con miembros y proyectos" } },
        ],
        feedInstructions: { en: "Create teams and assign members.", es: "Crear equipos y asignar miembros." },
        enrichmentChain: { en: "Team creation → members → linked projects → team dashboard", es: "Creación equipo → miembros → proyectos vinculados → dashboard del equipo" },
    },

    // ─── Other ─────────────────────────────────────────────
    "calendar": {
        title: { en: "Calendar", es: "Calendario" },
        dataSources: [
            { name: "Events", table: "events", description: { en: "Payment due dates, payroll dates, and custom events", es: "Fechas de vencimiento de pagos, nóminas y eventos personalizados" } },
        ],
        feedInstructions: { en: "Events auto-populate from invoice due dates and payroll schedule. Add custom events manually.", es: "Los eventos se rellenan automáticamente de fechas de vencimiento y calendario de nóminas. Añadir eventos manuales." },
        enrichmentChain: { en: "invoices (due dates) + payroll_uploads (dates) + manual events → calendar view", es: "invoices (vencimientos) + payroll_uploads (fechas) + eventos manuales → vista calendario" },
    },
    "notifications": {
        title: { en: "Notifications Center", es: "Centro de Notificaciones" },
        dataSources: [
            { name: "Notifications", table: "notifications", description: { en: "System and user notifications", es: "Notificaciones del sistema y de usuarios" } },
        ],
        feedInstructions: { en: "Notifications generated automatically by system events.", es: "Notificaciones generadas automáticamente por eventos del sistema." },
        enrichmentChain: { en: "System events → notifications → real-time display → read/dismiss", es: "Eventos del sistema → notifications → visualización en tiempo real → lectura/descarte" },
    },
    "profile": {
        title: { en: "User Profile", es: "Perfil de Usuario" },
        dataSources: [
            { name: "Profile", table: "profiles", description: { en: "User profile data", es: "Datos de perfil de usuario" } },
        ],
        feedInstructions: { en: "Edit your profile information directly.", es: "Editar tu información de perfil directamente." },
        enrichmentChain: { en: "User edit → profiles → displayed across app", es: "Edición usuario → profiles → visualización en toda la app" },
    },
};

/**
 * Route path → sheet key mapping.
 * Maps Next.js route paths to their corresponding data sheet keys.
 */
const routeToSheet: Record<string, string> = {
    "/pnl": "pnl",
    "/executive/cash-flow/bank": "executive-cashflow-bank",
    "/executive/cash-flow/consolidated": "executive-cashflow-consolidated",
    "/executive/cash-flow/real": "executive-cashflow-real",
    "/executive/kpis": "executive-kpis",
    "/executive/performance": "executive-performance",
    "/executive/reports": "executive-reports",
    "/executive/forecasts": "executive-forecasts",
    // Bank reports
    "/reports/bankinter-eur": "reports-bankinter-eur",
    "/reports/bankinter-usd": "reports-bankinter-usd",
    "/reports/bankinter": "reports-bankinter",
    "/reports/sabadell": "reports-sabadell",
    "/reports/chase-usd": "reports-chase-usd",
    // Gateway reports
    "/reports/braintree-eur": "reports-braintree-eur",
    "/reports/braintree-usd": "reports-braintree-usd",
    "/reports/braintree-gbp": "reports-braintree-gbp",
    "/reports/braintree-aud": "reports-braintree-aud",
    "/reports/braintree-amex": "reports-braintree-amex",
    "/reports/braintree": "reports-braintree",
    "/reports/braintree-transactions": "reports-braintree-transactions",
    "/reports/stripe-eur": "reports-stripe-eur",
    "/reports/stripe-usd": "reports-stripe-usd",
    "/reports/stripe": "reports-stripe",
    "/reports/gocardless": "reports-gocardless",
    "/reports/paypal": "reports-paypal",
    "/reports/pleo": "reports-pleo",
    "/reports/quickbooks-usd": "reports-quickbooks-usd",
    "/reports/hubspot": "reports-hubspot",
    // AP
    "/accounts-payable": "ap-overview",
    "/accounts-payable/invoices": "ap-invoices",
    "/accounts-payable/invoices/payments": "ap-payments",
    "/accounts-payable/insights/schedule": "ap-schedule",
    "/accounts-payable/master-data/providers": "ap-master-providers",
    "/accounts-payable/master-data/cost-centers": "ap-master-cost-centers",
    "/accounts-payable/master-data/financial-accounts": "ap-master-financial-accounts",
    "/accounts-payable/master-data/departmental-accounts": "ap-master-departmental-accounts",
    // AR
    "/accounts-receivable": "ar-overview",
    "/accounts-receivable/invoices": "ar-invoices",
    "/accounts-receivable/invoice-orders": "ar-invoice-orders",
    "/accounts-receivable/master-data/customers": "ar-master-customers",
    "/accounts-receivable/master-data/products": "ar-master-products",
    // Reconciliation
    "/actions/reconciliation-center": "reconciliation-center",
    "/actions/braintree-reconciliation": "braintree-reconciliation",
    "/actions/bot-logs": "bot-logs",
    "/actions/integration-insights": "integration-insights",
    // Departmental
    "/departmental/pnl": "departmental-pnl",
    "/departmental/contracts": "departmental-contracts",
    // Sales
    "/sales-insights/clinics": "sales-clinics",
    "/sales-insights/lab": "sales-lab",
    "/sales-insights/courses": "sales-courses",
    // Cash Management
    "/cash-management": "cash-management-overview",
    "/cash-management/bank-accounts": "cash-management-bank-accounts",
    "/cash-management/bank-statements": "cash-management-bank-statements",
    "/cash-management/payment-channels": "cash-management-payment-channels",
    "/cash-management/chase-quickbooks": "chase-quickbooks",
    "/cash-management/chase-quickbooks/business-checking": "chase-quickbooks",
    "/cash-management/chase-quickbooks/savings": "chase-quickbooks",
    // HubSpot
    "/hubspot/companies": "hubspot-companies",
    "/hubspot/contacts": "hubspot-contacts",
    "/hubspot/pipeline": "hubspot-pipeline",
    "/hubspot/settings": "hubspot-settings",
    // People
    "/people/payroll": "payroll",
    "/people/payroll/master-data": "payroll-master-data",
    // Settings
    "/settings/users": "settings-users",
    "/settings/roles": "settings-roles",
    "/settings/audit": "settings-audit",
    "/settings/notifications": "settings-notifications",
    "/settings/integrations": "settings-integrations",
    "/settings/botella": "settings-botella",
    "/settings/security": "settings-security",
    "/settings/system": "settings-system",
    "/settings/profile": "settings-profile",
    // Workstream
    "/workstream/goals": "workstream-goals",
    "/workstream/inbox": "workstream-inbox",
    "/workstream/my-tasks": "workstream-my-tasks",
    "/workstream/portfolios": "workstream-portfolios",
    "/workstream/reporting": "workstream-reporting",
    "/workstream/teams": "workstream-teams",
    // Other
    "/calendar": "calendar",
    "/notifications": "notifications",
    "/profile": "profile",
};

/** Get a data sheet entry by explicit key */
export function getDataSheet(key: string): DataSheetEntry | undefined {
    return sheets[key];
}

/** Get a data sheet by route path (e.g., "/pnl", "/reports/bankinter-eur") */
export function getDataSheetByRoute(route: string): DataSheetEntry | undefined {
    const key = routeToSheet[route];
    return key ? sheets[key] : undefined;
}

/** Get all available sheet keys */
export function getAllSheetKeys(): string[] {
    return Object.keys(sheets);
}
