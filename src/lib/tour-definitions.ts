/**
 * Tour definitions for the interactive guided tour system.
 * Each tour is bilingual (EN/ES) and references elements via data-tour attributes.
 */

export type TourLang = "en" | "es";

export interface TourStep {
    /** CSS selector (preferably [data-tour="..."]). Omit for centered popover. */
    element?: string;
    titleEN: string;
    titleES: string;
    descriptionEN: string;
    descriptionES: string;
    side?: "top" | "bottom" | "left" | "right";
}

export interface TourDefinition {
    id: string;
    titleEN: string;
    titleES: string;
    descriptionEN: string;
    descriptionES: string;
    /** If set, tour is only available on pages matching this path prefix */
    pagePath?: string;
    steps: TourStep[];
}

export const TOURS: TourDefinition[] = [
    /* ------------------------------------------------------------------ */
    /*  1. Welcome / Getting Started Tour                                  */
    /* ------------------------------------------------------------------ */
    {
        id: "welcome",
        titleEN: "Welcome Tour",
        titleES: "Tour de Bienvenida",
        descriptionEN: "Get to know the main interface elements",
        descriptionES: "Conoce los elementos principales de la interfaz",
        steps: [
            {
                element: '[data-tour="brand"]',
                titleEN: "DSD Finance Hub",
                titleES: "DSD Finance Hub",
                descriptionEN: "Click the logo anytime to return to the Dashboard.",
                descriptionES: "Haz clic en el logo en cualquier momento para volver al Dashboard.",
                side: "bottom",
            },
            {
                element: '[data-tour="menu-toggle"]',
                titleEN: "Navigation Menu",
                titleES: "Menú de Navegación",
                descriptionEN: "Toggle the navigation bar on or off. When expanded, you'll see all modules: Cash Management, AR, AP, Reports, and more.",
                descriptionES: "Activa o desactiva la barra de navegación. Al expandir, verás todos los módulos: Cash Management, CC, CP, Informes, y más.",
                side: "bottom",
            },
            {
                element: '[data-tour="search"]',
                titleEN: "Quick Search",
                titleES: "Búsqueda Rápida",
                descriptionEN: "Search the navigation menu by keyword. Type to instantly filter all available pages and modules.",
                descriptionES: "Busca en el menú de navegación por palabra clave. Escribe para filtrar instantáneamente todas las páginas y módulos disponibles.",
                side: "bottom",
            },
            {
                element: '[data-tour="scope-selector"]',
                titleEN: "Company Scope",
                titleES: "Ámbito de Empresa",
                descriptionEN: "Switch between DSD Spain (ES), DSD USA (US), or Global view. All data throughout the app filters based on this selection.",
                descriptionES: "Cambia entre DSD Spain (ES), DSD USA (US), o vista Global. Todos los datos de la aplicación se filtran según esta selección.",
                side: "bottom",
            },
            {
                element: '[data-tour="workstream"]',
                titleEN: "DSD Workstream",
                titleES: "DSD Workstream",
                descriptionEN: "Jump to the project management area — tasks, goals, portfolios, and team collaboration.",
                descriptionES: "Accede al área de gestión de proyectos — tareas, objetivos, portfolios y colaboración en equipo.",
                side: "bottom",
            },
            {
                element: '[data-tour="tour-menu"]',
                titleEN: "Guided Tours",
                titleES: "Tours Guiados",
                descriptionEN: "Click here anytime to start an interactive tour. Different tours are available depending on which page you're on.",
                descriptionES: "Haz clic aquí en cualquier momento para iniciar un tour interactivo. Hay tours diferentes disponibles según la página en la que estés.",
                side: "bottom",
            },
            {
                element: '[data-tour="manual"]',
                titleEN: "Product Manual",
                titleES: "Manual del Producto",
                descriptionEN: "Access the complete product manual with detailed documentation of every feature, flow, and configuration.",
                descriptionES: "Accede al manual completo del producto con documentación detallada de cada funcionalidad, flujo y configuración.",
                side: "bottom",
            },
            {
                element: '[data-tour="notifications"]',
                titleEN: "Notifications",
                titleES: "Notificaciones",
                descriptionEN: "Real-time alerts for important events: reconciliation issues, sync errors, invoice deadlines, and team mentions.",
                descriptionES: "Alertas en tiempo real para eventos importantes: problemas de conciliación, errores de sync, vencimientos de facturas y menciones del equipo.",
                side: "bottom",
            },
            {
                element: '[data-tour="data-freshness"]',
                titleEN: "Data Freshness",
                titleES: "Frescura de Datos",
                descriptionEN: "Monitor how up-to-date your data sources are. Green = fresh, yellow = slightly stale, red = needs attention.",
                descriptionES: "Monitoriza lo actualizadas que están tus fuentes de datos. Verde = fresco, amarillo = ligeramente antiguo, rojo = necesita atención.",
                side: "bottom",
            },
            {
                element: '[data-tour="user-menu"]',
                titleEN: "User Menu",
                titleES: "Menú de Usuario",
                descriptionEN: "Access your profile, security settings, and sign out.",
                descriptionES: "Accede a tu perfil, configuración de seguridad y cierre de sesión.",
                side: "left",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  2. Bank Statement Reconciliation Tour                              */
    /* ------------------------------------------------------------------ */
    {
        id: "bank-import",
        titleEN: "Bank Statement Reconciliation",
        titleES: "Conciliación de Extractos Bancarios",
        descriptionEN: "Full walkthrough: import CSV, review KPIs, filter, auto-match revenues & expenses",
        descriptionES: "Guía completa: importar CSV, revisar KPIs, filtrar, conciliar automáticamente ingresos y gastos",
        pagePath: "/cash-management/bank-statements",
        steps: [
            /* Step 1 — Bank selector */
            {
                element: '[data-tour="bank-selector"]',
                titleEN: "1. Select Bank Account",
                titleES: "1. Seleccionar Cuenta Bancaria",
                descriptionEN: "Start by selecting one or more bank accounts. Each tab shows the account label, transaction count, and the date of the last upload. You can click 'All' to see every account combined.",
                descriptionES: "Comienza seleccionando una o más cuentas bancarias. Cada pestaña muestra la etiqueta de la cuenta, el número de transacciones y la fecha de la última carga. Puedes hacer clic en 'All' para ver todas las cuentas combinadas.",
                side: "bottom",
            },
            /* Step 2 — Upload CSV */
            {
                element: '[data-tour="upload-csv"]',
                titleEN: "2. Upload Bank Statement",
                titleES: "2. Cargar Extracto Bancario",
                descriptionEN: "Click the small upload icon on each bank tab to import a CSV statement. The system auto-detects the bank format (Bankinter, Sabadell, Chase) and parses European number formatting (dot = thousands, comma = decimals).",
                descriptionES: "Haz clic en el icono de carga de cada pestaña para importar un CSV. El sistema auto-detecta el formato del banco (Bankinter, Sabadell, Chase) y procesa el formato numérico europeo (punto = miles, coma = decimales).",
                side: "bottom",
            },
            /* Step 3 — KPI Status Cards */
            {
                element: '[data-tour="kpi-cards"]',
                titleEN: "3. Reconciliation Dashboard",
                titleES: "3. Panel de Conciliación",
                descriptionEN: "Five KPI cards give you an instant overview: Pending Inflows (revenue not yet matched), Pending Outflows (expenses not matched), All Pending (combined), Reconciled (matched count & %), and Net Balance. Click any card to filter the transaction list below.",
                descriptionES: "Cinco tarjetas KPI dan una vista instantánea: Ingresos Pendientes (ingresos sin emparejar), Salidas Pendientes (gastos sin emparejar), Total Pendiente (combinado), Conciliado (cantidad y %), y Saldo Neto. Haz clic en cualquier tarjeta para filtrar la lista de transacciones.",
                side: "bottom",
            },
            /* Step 4 — Filters */
            {
                element: '[data-tour="date-filter"]',
                titleEN: "4. Filter Transactions",
                titleES: "4. Filtrar Transacciones",
                descriptionEN: "Narrow down transactions with powerful filters: date range, payment gateway (Braintree, Stripe, PayPal, GoCardless), flow direction (inflows vs outflows), reconciliation status, gateway reconciliation type (Auto/Manual/Intercompany), and order match state.",
                descriptionES: "Filtra transacciones con filtros potentes: rango de fechas, pasarela de pago (Braintree, Stripe, PayPal, GoCardless), dirección del flujo (ingresos vs gastos), estado de conciliación, tipo de conciliación de pasarela (Auto/Manual/Intercompañía) y estado de emparejamiento de pedidos.",
                side: "bottom",
            },
            /* Step 5 — Reconciliation modes / action bar */
            {
                element: '[data-tour="reconciliation-modes"]',
                titleEN: "5. Reconciliation Actions",
                titleES: "5. Acciones de Conciliación",
                descriptionEN: "The action bar has two key buttons: 'Preview' runs a dry-run showing what WOULD match (no changes saved), and 'Auto-Reconcile' (⚡) executes the matching. Five reconciliation engines run: Expense→AP Invoice, Credit→Gateway Settlement, Disbursement Chain, Revenue→Web Orders, and Intercompany. Use the search box on the right to find specific transactions.",
                descriptionES: "La barra de acciones tiene dos botones clave: 'Preview' ejecuta una simulación mostrando qué SE emparejaría (sin guardar cambios), y 'Auto-Reconcile' (⚡) ejecuta el emparejamiento. Se ejecutan cinco motores: Gasto→Factura CP, Crédito→Lote Liquidación, Cadena Desembolsos, Ingreso→Pedidos Web, e Intercompañía. Usa la barra de búsqueda a la derecha para encontrar transacciones específicas.",
                side: "top",
            },
            /* Step 6 — Transaction table */
            {
                element: '[data-tour="txn-table"]',
                titleEN: "6. Transaction Table",
                titleES: "6. Tabla de Transacciones",
                descriptionEN: "Transactions are grouped by month then by day. Each row shows: Date, Bank, Description, Debit (red), Credit (green), Gateway badge (payment source), GW status icon (✓ reconciled, ◉ partial, 🔗 pending), and Order match status. Expand months/days with the chevron arrows.",
                descriptionES: "Las transacciones se agrupan por mes y después por día. Cada fila muestra: Fecha, Banco, Descripción, Débito (rojo), Crédito (verde), badge de Pasarela (fuente de pago), icono GW (✓ conciliado, ◉ parcial, 🔗 pendiente) y estado de emparejamiento de Pedido. Expande meses/días con las flechas.",
                side: "bottom",
            },
            /* Step 7 — Detail Panel (centered popover, element may not exist) */
            {
                titleEN: "7. Transaction Detail & Order Reconciliation",
                titleES: "7. Detalle y Conciliación de Pedidos",
                descriptionEN: "Click any row to open the detail panel on the right. For reconciled revenues you'll see:<br/><br/>• <b>Order Reconciliation</b> — status badge (Full Match / Partial / Not Matched)<br/>• <b>Matched Orders</b> — each customer name, order ID, amount, and links to backend & AR<br/>• <b>Orders Total</b> — sum of all matched orders in green<br/>• <b>Gateway Fee</b> — the processing fee with amount and linked AP Invoice number<br/>• <b>Revert</b> button — undo reconciliation if needed<br/><br/>For expenses: matched AP invoices with provider codes and amounts.",
                descriptionES: "Haz clic en cualquier fila para abrir el panel de detalle a la derecha. Para ingresos conciliados verás:<br/><br/>• <b>Conciliación de Pedidos</b> — badge de estado (Full Match / Partial / Not Matched)<br/>• <b>Pedidos Emparejados</b> — nombre de cliente, ID de pedido, importe, y enlaces al backend y CC<br/>• <b>Total Pedidos</b> — suma de todos los pedidos emparejados en verde<br/>• <b>Comisión Gateway</b> — la comisión de procesamiento con importe y factura CP vinculada<br/>• Botón <b>Revert</b> — deshacer conciliación si es necesario<br/><br/>Para gastos: facturas CP emparejadas con códigos de proveedor e importes.",
                side: "bottom",
            },
            /* Step 8 — Opening Reconciliation Dialog (centered popover) */
            {
                titleEN: "8. Opening the Reconciliation Dialog",
                titleES: "8. Abrir el Diálogo de Conciliación",
                descriptionEN: "To reconcile a pending transaction, look for the <b>🔗 chain icon</b> in the <b>GW column</b> of the transaction table. Click it to open the Smart Matching dialog directly.<br/><br/>Alternatively, click any unreconciled row to open the detail panel, then click the <b>'Manual Reconcile'</b> button (🔗 icon) at the bottom.<br/><br/>The dialog opens with the transaction context (date, amount, bank, description) and starts searching for matching items automatically.",
                descriptionES: "Para conciliar una transacción pendiente, busca el <b>icono de cadena 🔗</b> en la <b>columna GW</b> de la tabla de transacciones. Haz clic para abrir el diálogo de Emparejamiento Inteligente directamente.<br/><br/>Alternativamente, haz clic en cualquier fila no conciliada para abrir el panel de detalle, y luego haz clic en el botón <b>'Manual Reconcile'</b> (icono 🔗) en la parte inferior.<br/><br/>El diálogo se abre con el contexto de la transacción (fecha, importe, banco, descripción) y comienza a buscar coincidencias automáticamente.",
                side: "bottom",
            },
            /* Step 9 — Suggestions tab */
            {
                titleEN: "9. Suggestions Tab",
                titleES: "9. Pestaña Sugerencias",
                descriptionEN: "The <b>Suggestions</b> tab shows AI-powered matches ranked by confidence score. For revenues, you'll see:<br/><br/>• <b>Disbursement Suggestions</b> — gateway settlement batches (e.g., 'Braintree EUR — 2026-01-28') with transaction count, resolved orders, and total amount. Click to expand and see individual orders & gateway transactions inside.<br/>• <b>Payment Source Matches</b> — direct gateway matches<br/>• <b>Revenue Order Matches</b> — individual order matches<br/><br/>Each match shows a <b>confidence % badge</b> (green = high, yellow = medium).",
                descriptionES: "La pestaña <b>Sugerencias</b> muestra coincidencias con IA ordenadas por puntuación de confianza. Para ingresos, verás:<br/><br/>• <b>Sugerencias de Desembolso</b> — lotes de liquidación de pasarela (ej. 'Braintree EUR — 2026-01-28') con recuento de transacciones, pedidos resueltos e importe total. Haz clic para expandir y ver pedidos individuales y transacciones de pasarela.<br/>• <b>Coincidencias de Fuente de Pago</b> — coincidencias directas de pasarela<br/>• <b>Coincidencias de Pedidos</b> — coincidencias individuales de pedidos<br/><br/>Cada coincidencia muestra un <b>badge de confianza %</b> (verde = alta, amarillo = media).",
                side: "bottom",
            },
            /* Step 10 — Manual tab */
            {
                titleEN: "10. Manual Search Tab",
                titleES: "10. Pestaña Búsqueda Manual",
                descriptionEN: "The <b>Manual</b> tab lets you search and reconcile freely:<br/><br/>• <b>For expenses</b> — search AP invoices by supplier name or invoice number<br/>• <b>For revenues</b> — search Web Orders by customer name, Order ID, or invoice number. Select one or more orders using checkboxes. A progress bar shows how much of the bank amount is covered.<br/>• <b>Gateway Transactions</b> — link specific Braintree/Stripe/GoCardless transactions<br/>• <b>Payment Source</b> dropdown — reconcile without an invoice by selecting the gateway<br/><br/>Click <b>Reconcile</b> when ready to confirm.",
                descriptionES: "La pestaña <b>Manual</b> permite buscar y conciliar libremente:<br/><br/>• <b>Para gastos</b> — busca facturas CP por nombre de proveedor o número de factura<br/>• <b>Para ingresos</b> — busca Pedidos Web por nombre de cliente, ID de pedido o número de factura. Selecciona uno o más pedidos con los checkboxes. Una barra de progreso muestra cuánto del importe bancario está cubierto.<br/>• <b>Transacciones de Pasarela</b> — vincula transacciones específicas de Braintree/Stripe/GoCardless<br/>• Dropdown de <b>Fuente de Pago</b> — concilia sin factura seleccionando la pasarela<br/><br/>Haz clic en <b>Reconcile</b> cuando estés listo para confirmar.",
                side: "bottom",
            },
            /* Step 11 — Intercompany tab */
            {
                titleEN: "11. Intercompany Tab",
                titleES: "11. Pestaña Intercompañía",
                descriptionEN: "The <b>Intercompany</b> tab finds matching transfers between bank accounts (e.g., DSD Spain → DSD USA). It searches same day ±1 (Fri→Mon) with opposite amounts.<br/><br/>• Use the <b>bank filter dropdown</b> to narrow results to a specific origin/destination bank<br/>• Cross-currency EUR↔USD matches use a 20% tolerance for exchange rates<br/>• Same-currency matches use tight 0.5% tolerance<br/>• Each match shows bank name, description, currency, date, amount, and confidence %<br/><br/>Select a match and click Reconcile — both sides are marked as reconciled.",
                descriptionES: "La pestaña <b>Intercompañía</b> busca transferencias coincidentes entre cuentas bancarias (ej., DSD Spain → DSD USA). Busca en el mismo día ±1 (Vie→Lun) con importes opuestos.<br/><br/>• Usa el <b>dropdown de filtro de banco</b> para limitar resultados a un banco de origen/destino específico<br/>• Coincidencias cross-currency EUR↔USD usan tolerancia del 20% para tipos de cambio<br/>• Coincidencias misma moneda usan tolerancia estricta del 0.5%<br/>• Cada coincidencia muestra banco, descripción, moneda, fecha, importe y % de confianza<br/><br/>Selecciona una coincidencia y haz clic en Reconcile — ambos lados se marcan como conciliados.",
                side: "bottom",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  3. Gateway Sync Tour                                               */
    /* ------------------------------------------------------------------ */
    {
        id: "gateway-sync",
        titleEN: "Payment Gateway Sync",
        titleES: "Sincronización de Pasarelas de Pago",
        descriptionEN: "Understand how gateway data flows into the system",
        descriptionES: "Entiende cómo los datos de pasarelas fluyen al sistema",
        pagePath: "/reports/braintree",
        steps: [
            {
                element: '[data-tour="sync-button"]',
                titleEN: "Sync Gateway Data",
                titleES: "Sincronizar Datos de Pasarela",
                descriptionEN: "Pull the latest transactions from the payment gateway API. The system processes settlements, refunds, and disbursements automatically.",
                descriptionES: "Extrae las últimas transacciones de la API de la pasarela de pago. El sistema procesa liquidaciones, reembolsos y desembolsos automáticamente.",
                side: "bottom",
            },
            {
                element: '[data-tour="gateway-stats"]',
                titleEN: "Gateway Statistics",
                titleES: "Estadísticas de Pasarela",
                descriptionEN: "Overview cards showing total volume, transaction count, reconciled percentage, and pending items for the selected period.",
                descriptionES: "Tarjetas resumen mostrando volumen total, número de transacciones, porcentaje conciliado y elementos pendientes del período seleccionado.",
                side: "bottom",
            },
            {
                element: '[data-tour="settlement-batches"]',
                titleEN: "Settlement Batches",
                titleES: "Lotes de Liquidación",
                descriptionEN: "Each row represents a batch of payments deposited to your bank. Click to expand and see individual transactions inside the batch.",
                descriptionES: "Cada fila representa un lote de pagos depositados en tu banco. Haz clic para expandir y ver las transacciones individuales dentro del lote.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  4. Invoice Orders Tour                                             */
    /* ------------------------------------------------------------------ */
    {
        id: "invoice-orders",
        titleEN: "Invoice Orders (AR)",
        titleES: "Pedidos de Factura (CC)",
        descriptionEN: "Navigate the AR Invoice Orders page and reconciliation tools",
        descriptionES: "Navega la página de Pedidos de Factura CC y herramientas de conciliación",
        pagePath: "/accounts-receivable/invoice-orders",
        steps: [
            {
                element: '[data-tour="ar-stats"]',
                titleEN: "AR Summary Cards",
                titleES: "Tarjetas Resumen CC",
                descriptionEN: "Quick stats: total invoices, reconciled vs pending, total amounts, and collection efficiency percentage.",
                descriptionES: "Estadísticas rápidas: total de facturas, conciliadas vs pendientes, importes totales y porcentaje de eficiencia de cobro.",
                side: "bottom",
            },
            {
                element: '[data-tour="bank-match-btn"]',
                titleEN: "Bank Match Button",
                titleES: "Botón Bank Match",
                descriptionEN: "The main reconciliation tool. Runs a dry-run preview comparing bank credits against open AR invoices, then lets you confirm the matches.",
                descriptionES: "La herramienta principal de conciliación. Ejecuta una vista previa comparando créditos bancarios con facturas CC abiertas, y luego te permite confirmar las coincidencias.",
                side: "bottom",
            },
            {
                element: '[data-tour="invoice-table"]',
                titleEN: "Invoice Table",
                titleES: "Tabla de Facturas",
                descriptionEN: "Browse all AR invoices with inline editing. Status badges show reconciliation state. Click any row to expand details and see the matched bank transaction.",
                descriptionES: "Explora todas las facturas CC con edición inline. Los badges de estado muestran el estado de conciliación. Haz clic en cualquier fila para expandir detalles y ver la transacción bancaria emparejada.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  5. P&L Statement Tour                                              */
    /* ------------------------------------------------------------------ */
    {
        id: "pnl-statement",
        titleEN: "P&L Statement",
        titleES: "Estado de Resultados (P&L)",
        descriptionEN: "Navigate the Profit & Loss statement with drill-down analysis",
        descriptionES: "Navega el Estado de Resultados con análisis detallado",
        pagePath: "/pnl",
        steps: [
            {
                element: '[data-tour="pnl-year-selector"]',
                titleEN: "1. Year Selector",
                titleES: "1. Selector de Año",
                descriptionEN: "Choose the fiscal year to display. The P&L loads data from AR Invoice Orders — all figures come from real invoices, not estimates.",
                descriptionES: "Elige el año fiscal a mostrar. El P&L carga datos de los Pedidos de Factura — todas las cifras provienen de facturas reales, no estimaciones.",
                side: "bottom",
            },
            {
                element: '[data-tour="pnl-kpi-cards"]',
                titleEN: "2. Executive KPIs",
                titleES: "2. KPIs Ejecutivos",
                descriptionEN: "Six summary cards showing: <b>Revenue YTD</b> (vs budget %), <b>Gross Profit</b> (margin %), <b>EBITDA</b> (margin %), <b>Expenses</b> (under/over budget), and <b>Net Income</b> (vs budget + full-year estimate + variance %).",
                descriptionES: "Seis tarjetas resumen: <b>Ingresos YTD</b> (vs presupuesto %), <b>Beneficio Bruto</b> (margen %), <b>EBITDA</b> (margen %), <b>Gastos</b> (bajo/sobre presupuesto), e <b>Ingreso Neto</b> (vs presupuesto + estimación anual + varianza %).",
                side: "bottom",
            },
            {
                element: '[data-tour="pnl-revenue-section"]',
                titleEN: "3. Revenue Section",
                titleES: "3. Sección de Ingresos",
                descriptionEN: "Monthly revenue breakdown by Financial Account code (FA 101–107). Each row shows the 12-month grid plus an annual total. Rows are expandable if they have sub-accounts (e.g., clinic variations 102.x–104.x).",
                descriptionES: "Desglose mensual de ingresos por código de Cuenta Financiera (FA 101–107). Cada fila muestra la cuadrícula de 12 meses más un total anual. Las filas son expandibles si tienen subcuentas (ej., variaciones clínicas 102.x–104.x).",
                side: "bottom",
            },
            {
                element: '[data-tour="pnl-expense-section"]',
                titleEN: "4. Expense Section",
                titleES: "4. Sección de Gastos",
                descriptionEN: "Same grid layout for expenses. Click any <b>cell with a value</b> to drill down — a popup will show all the invoices for that FA code + month, grouped by provider.",
                descriptionES: "Mismo formato de cuadrícula para gastos. Haz clic en cualquier <b>celda con valor</b> para hacer drill-down — un popup mostrará todas las facturas de esa cuenta + mes, agrupadas por proveedor.",
                side: "top",
            },
            {
                titleEN: "5. Drill-Down: Transaction List",
                titleES: "5. Drill-Down: Lista de Transacciones",
                descriptionEN: "When you click a cell, the drill-down popup shows individual transactions grouped by provider/customer. Each line has: date, description, amount, and invoice number. Click any invoice to open the full detail panel.",
                descriptionES: "Al hacer clic en una celda, el popup de drill-down muestra transacciones individuales agrupadas por proveedor/cliente. Cada línea tiene: fecha, descripción, importe y número de factura. Haz clic en cualquier factura para abrir el panel de detalle completo.",
                side: "bottom",
            },
            {
                titleEN: "6. Invoice Detail Panel",
                titleES: "6. Panel de Detalle de Factura",
                descriptionEN: "The invoice detail shows all metadata: invoice number, dates (invoice/benefit/input/due/payment), amounts, currency, provider/customer codes, bank account, payment method, cost center, and cost type. Use the <b>Edit</b> button to modify fields, and <b>History</b> to see all invoices from the same provider.",
                descriptionES: "El detalle de factura muestra toda la metadata: número de factura, fechas (factura/beneficio/entrada/vencimiento/pago), importes, moneda, códigos de proveedor/cliente, cuenta bancaria, método de pago, centro de coste y tipo de coste. Usa el botón <b>Edit</b> para modificar campos, e <b>History</b> para ver todas las facturas del mismo proveedor.",
                side: "bottom",
            },
            {
                element: '[data-tour="pnl-budget-variance"]',
                titleEN: "7. Budget vs Actual",
                titleES: "7. Presupuesto vs Real",
                descriptionEN: "Five variance cards comparing YTD actual vs budget for Revenue, Gross Profit, EBITDA, Expenses, and Net Income. Green = favorable variance, red = unfavorable. Each card shows the absolute difference and percentage.",
                descriptionES: "Cinco tarjetas de varianza comparando YTD real vs presupuesto para Ingresos, Beneficio Bruto, EBITDA, Gastos e Ingreso Neto. Verde = varianza favorable, rojo = desfavorable. Cada tarjeta muestra la diferencia absoluta y el porcentaje.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  6. Bank Cashflow Tour                                              */
    /* ------------------------------------------------------------------ */
    {
        id: "bank-cashflow",
        titleEN: "Bank Cashflow",
        titleES: "Cashflow Bancario",
        descriptionEN: "Explore your bank cash position, inflow analytics, and transaction details",
        descriptionES: "Explora tu posición de caja bancaria, análisis de entradas y detalles de transacciones",
        pagePath: "/executive/cash-flow/bank",
        steps: [
            {
                element: '[data-tour="cf-bank-selector"]',
                titleEN: "1. Bank Account Tabs",
                titleES: "1. Pestañas de Cuenta Bancaria",
                descriptionEN: "Click to toggle bank accounts on/off. <b>Double-click</b> to isolate a single bank. Each tab shows the account name, transaction count, last upload date, and last data date. Click <b>All</b> to select every account.",
                descriptionES: "Haz clic para activar/desactivar cuentas bancarias. <b>Doble clic</b> para aislar un solo banco. Cada pestaña muestra nombre de cuenta, recuento de transacciones, última carga y fecha del último dato. Haz clic en <b>All</b> para seleccionar todas.",
                side: "bottom",
            },
            {
                element: '[data-tour="cf-cash-position"]',
                titleEN: "2. Cash Position Section",
                titleES: "2. Sección Posición de Caja",
                descriptionEN: "Expandable accordion showing your <b>daily cash position</b>: an area chart with evolution over time (click any data point to inspect that day), plus a detailed table with per-bank balances. Use the range selector (7d / 30d / 90d / custom) to adjust the period.",
                descriptionES: "Acordeón expandible mostrando tu <b>posición de caja diaria</b>: un gráfico de área con evolución temporal (haz clic en cualquier punto para inspeccionar ese día), más una tabla detallada con saldos por banco. Usa el selector de rango (7d / 30d / 90d / custom) para ajustar el período.",
                side: "bottom",
            },
            {
                element: '[data-tour="cf-inflow-analytics"]',
                titleEN: "3. Inflow Analytics",
                titleES: "3. Análisis de Entradas",
                descriptionEN: "Expandable charts section with donut charts showing inflow distribution by bank and by gateway (Braintree, Stripe, GoCardless, PayPal). Gives a visual overview of where your money comes from.",
                descriptionES: "Sección de gráficos expandible con donut charts mostrando distribución de entradas por banco y por pasarela (Braintree, Stripe, GoCardless, PayPal). Da una visión general de dónde viene tu dinero.",
                side: "bottom",
            },
            {
                element: '[data-tour="cf-kpi-cards"]',
                titleEN: "4. KPI Summary Cards",
                titleES: "4. Tarjetas Resumen KPI",
                descriptionEN: "Quick stats for the selected period: <b>Inflows</b> (total credits), <b>Outflows</b> (total debits), <b>Reconciled %</b>, and <b>Avg Monthly</b> cash flow. Updates dynamically based on selected banks and date range.",
                descriptionES: "Estadísticas rápidas del período seleccionado: <b>Entradas</b> (total créditos), <b>Salidas</b> (total débitos), <b>% Conciliado</b>, y <b>Promedio Mensual</b> de flujo de caja. Se actualiza dinámicamente según bancos y rango de fechas.",
                side: "bottom",
            },
            {
                element: '[data-tour="cf-filters"]',
                titleEN: "5. Transaction Filters",
                titleES: "5. Filtros de Transacciones",
                descriptionEN: "Filter transactions by: <b>Gateway</b> (Braintree/Stripe/GoCardless/PayPal), <b>Flow</b> (Inflows/Outflows), <b>Reconciliation</b> (Reconciled/Pending), <b>GW Type</b> (Auto/Manual/Intercompany), <b>Order Match</b> (Matched/Not Matched), and a <b>search box</b> for description/customer.",
                descriptionES: "Filtra transacciones por: <b>Pasarela</b> (Braintree/Stripe/GoCardless/PayPal), <b>Flujo</b> (Entradas/Salidas), <b>Conciliación</b> (Conciliado/Pendiente), <b>Tipo GW</b> (Auto/Manual/Intercompañía), <b>Emparejamiento</b> (Con/Sin pedido), y una <b>caja de búsqueda</b> para descripción/cliente.",
                side: "bottom",
            },
            {
                element: '[data-tour="cf-txn-table"]',
                titleEN: "6. Transaction Table",
                titleES: "6. Tabla de Transacciones",
                descriptionEN: "Transactions grouped by <b>Month → Day</b>. Each row shows: date, bank description, debit (red) / credit (green), gateway badge, GW status icon (✓ auto / ◉ manual / 🔗 link), and order match status. Click any row to open the detail panel on the right.",
                descriptionES: "Transacciones agrupadas por <b>Mes → Día</b>. Cada fila muestra: fecha, descripción bancaria, débito (rojo) / crédito (verde), badge de pasarela, icono de estado GW (✓ auto / ◉ manual / 🔗 enlace), y estado de emparejamiento de pedido. Haz clic en cualquier fila para abrir el panel de detalle a la derecha.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  7. Consolidated Revenue Cashflow Tour                              */
    /* ------------------------------------------------------------------ */
    {
        id: "consolidated-cashflow",
        titleEN: "Revenue Cashflow (Consolidated)",
        titleES: "Cashflow de Ingresos (Consolidado)",
        descriptionEN: "Understand the consolidated revenue cashflow report",
        descriptionES: "Entiende el informe consolidado de cashflow de ingresos",
        pagePath: "/executive/cash-flow/consolidated",
        steps: [
            {
                element: '[data-tour="ccf-year-selector"]',
                titleEN: "1. Year Selector",
                titleES: "1. Selector de Año",
                descriptionEN: "Switch between fiscal years. The report loads data from all bank accounts and cross-references with invoice orders and gateway reconciliation data.",
                descriptionES: "Cambia entre años fiscales. El informe carga datos de todas las cuentas bancarias y cruza con pedidos de factura y datos de conciliación de pasarela.",
                side: "bottom",
            },
            {
                element: '[data-tour="ccf-kpi-cards"]',
                titleEN: "2. Summary KPIs",
                titleES: "2. KPIs Resumen",
                descriptionEN: "Four cards: <b>Bank Inflows</b> (total credits with gateway count), <b>Reconciled</b> (amount + % of inflows), <b>Revenue Invoiced</b> (from invoice orders), and <b>Net Bank Flow</b> (inflows − outflows).",
                descriptionES: "Cuatro tarjetas: <b>Entradas Bancarias</b> (total créditos con recuento de pasarelas), <b>Conciliado</b> (importe + % de entradas), <b>Ingresos Facturados</b> (de pedidos de factura), y <b>Flujo Neto Bancario</b> (entradas − salidas).",
                side: "bottom",
            },
            {
                element: '[data-tour="ccf-grid"]',
                titleEN: "3. Unified 14-Column Grid",
                titleES: "3. Cuadrícula Unificada de 14 Columnas",
                descriptionEN: "The main grid shows 12 months + total. Sections include:<br/>• <b>Bank Inflows</b> — total + by-bank breakdown + by-gateway breakdown<br/>• <b>Reconciliation %</b> — color-coded (green ≥80%, amber ≥50%, red &lt;50%)<br/>• <b>Revenue Attribution</b> — by FA code with expandable sub-groups<br/>• <b>Outflows & Net Flow</b><br/>• <b>Gap Analysis</b> — difference between bank inflows and invoiced revenue",
                descriptionES: "La cuadrícula principal muestra 12 meses + total. Secciones incluyen:<br/>• <b>Entradas Bancarias</b> — total + desglose por banco + por pasarela<br/>• <b>% Conciliación</b> — código de colores (verde ≥80%, ámbar ≥50%, rojo &lt;50%)<br/>• <b>Atribución de Ingresos</b> — por código FA con subgrupos expandibles<br/>• <b>Salidas y Flujo Neto</b><br/>• <b>Análisis de Gap</b> — diferencia entre entradas bancarias e ingresos facturados",
                side: "top",
            },
            {
                titleEN: "4. Expand/Collapse Sections",
                titleES: "4. Expandir/Colapsar Secciones",
                descriptionEN: "Click any row with a <b>chevron arrow</b> (▶/▼) to expand or collapse its children. For example, expand 'Reconciled Inflows' to see per-gateway amounts (Braintree, Stripe, GoCardless), or expand Revenue groups to see sub-FA codes.",
                descriptionES: "Haz clic en cualquier fila con <b>flecha chevron</b> (▶/▼) para expandir o colapsar sus hijos. Por ejemplo, expande 'Reconciled Inflows' para ver importes por pasarela (Braintree, Stripe, GoCardless), o expande grupos de Revenue para ver sub-códigos FA.",
                side: "bottom",
            },
            {
                element: '[data-tour="ccf-export"]',
                titleEN: "5. CSV Export",
                titleES: "5. Exportar CSV",
                descriptionEN: "Download the full cashflow report as a structured CSV file for use in Excel or Google Sheets. Includes all sections: bank inflows, gateways, revenue by FA, outflows, and net flow.",
                descriptionES: "Descarga el informe completo de cashflow como CSV estructurado para usar en Excel o Google Sheets. Incluye todas las secciones: entradas bancarias, pasarelas, ingresos por FA, salidas y flujo neto.",
                side: "bottom",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  8. KPIs & Financial Ratios Tour                                    */
    /* ------------------------------------------------------------------ */
    {
        id: "kpis-ratios",
        titleEN: "KPIs & Financial Ratios",
        titleES: "KPIs y Ratios Financieros",
        descriptionEN: "Overview of key financial health metrics",
        descriptionES: "Resumen de métricas clave de salud financiera",
        pagePath: "/executive/kpis",
        steps: [
            {
                element: '[data-tour="kpis-summary"]',
                titleEN: "1. Executive Summary",
                titleES: "1. Resumen Ejecutivo",
                descriptionEN: "Four cards: <b>Overall Score</b> (out of 10), <b>Metrics on Target</b> (count + %), <b>Needs Attention</b> (metrics below target), and <b>Trend</b> direction (improving/declining).",
                descriptionES: "Cuatro tarjetas: <b>Puntuación Global</b> (de 10), <b>Métricas en Objetivo</b> (recuento + %), <b>Requieren Atención</b> (métricas bajo objetivo), y dirección de <b>Tendencia</b> (mejorando/declinando).",
                side: "bottom",
            },
            {
                element: '[data-tour="kpis-categories"]',
                titleEN: "2. KPI Categories",
                titleES: "2. Categorías de KPI",
                descriptionEN: "Four ratio groups: <b>Profitability</b> (margins, ROA), <b>Liquidity</b> (current/quick/cash ratios), <b>Efficiency</b> (turnover, DSO, DPO), and <b>Leverage</b> (debt ratios, interest coverage). Each table shows Current value, Target, Change, and a Status badge (green = On Target, orange = Warning, red = Critical).",
                descriptionES: "Cuatro grupos de ratios: <b>Rentabilidad</b> (márgenes, ROA), <b>Liquidez</b> (ratios corriente/rápida/caja), <b>Eficiencia</b> (rotación, DSO, DPO), y <b>Apalancamiento</b> (ratios de deuda, cobertura de intereses). Cada tabla muestra valor Actual, Objetivo, Cambio, y badge de Estado (verde = En Objetivo, naranja = Atención, rojo = Crítico).",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  9. Performance Analytics Tour                                      */
    /* ------------------------------------------------------------------ */
    {
        id: "performance-analytics",
        titleEN: "Performance Analytics",
        titleES: "Análisis de Rendimiento",
        descriptionEN: "Business intelligence metrics and regional performance",
        descriptionES: "Métricas de inteligencia de negocio y rendimiento regional",
        pagePath: "/executive/performance",
        steps: [
            {
                element: '[data-tour="perf-metrics"]',
                titleEN: "1. Key Metrics",
                titleES: "1. Métricas Clave",
                descriptionEN: "Four cards: <b>Revenue Growth</b>, <b>Operating Margin</b>, <b>Customer Acquisition</b>, and <b>Average Deal Size</b>. Each shows current value, period-over-period change (↑ green / ↓ red), and trend direction.",
                descriptionES: "Cuatro tarjetas: <b>Crecimiento de Ingresos</b>, <b>Margen Operativo</b>, <b>Adquisición de Clientes</b>, y <b>Tamaño Medio de Operación</b>. Cada una muestra valor actual, cambio período-a-período (↑ verde / ↓ rojo), y dirección de tendencia.",
                side: "bottom",
            },
            {
                element: '[data-tour="perf-charts"]',
                titleEN: "2. Charts & Regional Distribution",
                titleES: "2. Gráficos y Distribución Regional",
                descriptionEN: "Revenue trend chart (12-month) and regional distribution bars showing ES vs US market split with percentage breakdown.",
                descriptionES: "Gráfico de tendencia de ingresos (12 meses) y barras de distribución regional mostrando split de mercado ES vs US con desglose porcentual.",
                side: "bottom",
            },
            {
                element: '[data-tour="perf-dept-table"]',
                titleEN: "3. Department Performance",
                titleES: "3. Rendimiento por Departamento",
                descriptionEN: "Comparative table across business units (Sales, Marketing, Operations): Revenue, Growth %, Margin %, and status badge (Excellent / Good / Needs Attention).",
                descriptionES: "Tabla comparativa entre unidades de negocio (Ventas, Marketing, Operaciones): Ingresos, % Crecimiento, % Margen, y badge de estado (Excelente / Bueno / Requiere Atención).",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  10. Consolidated Reports Tour                                      */
    /* ------------------------------------------------------------------ */
    {
        id: "consolidated-reports",
        titleEN: "Consolidated Reports",
        titleES: "Informes Consolidados",
        descriptionEN: "Access and manage financial reports",
        descriptionES: "Accede y gestiona informes financieros",
        pagePath: "/executive/reports",
        steps: [
            {
                element: '[data-tour="reports-stats"]',
                titleEN: "1. Report Statistics",
                titleES: "1. Estadísticas de Informes",
                descriptionEN: "Quick stats: <b>Total Reports</b> this year, <b>Available Now</b> (ready to download), <b>In Progress</b> (currently generating), and <b>Scheduled</b> (upcoming).",
                descriptionES: "Estadísticas rápidas: <b>Total Informes</b> este año, <b>Disponibles Ahora</b> (listos para descargar), <b>En Progreso</b> (generándose), y <b>Programados</b> (próximos).",
                side: "bottom",
            },
            {
                element: '[data-tour="reports-list"]',
                titleEN: "2. Reports List",
                titleES: "2. Lista de Informes",
                descriptionEN: "Each report card shows: title, description, date, type (Monthly/Quarterly/Annual/Custom), and status badge. Available reports have a <b>Download</b> button. Types include P&L, Balance Sheet, Cash Flow, and Tax Compliance.",
                descriptionES: "Cada tarjeta de informe muestra: título, descripción, fecha, tipo (Mensual/Trimestral/Anual/Custom), y badge de estado. Los informes disponibles tienen un botón <b>Download</b>. Tipos incluyen P&L, Balance, Cash Flow y Tax Compliance.",
                side: "bottom",
            },
            {
                element: '[data-tour="reports-builder"]',
                titleEN: "3. Custom Report Builder",
                titleES: "3. Constructor de Informes Custom",
                descriptionEN: "Quick-launch templates for common reports: P&L Statement, Balance Sheet, Cash Flow, Budget vs Actual, Variance Analysis, and Custom Report.",
                descriptionES: "Plantillas de lanzamiento rápido para informes comunes: Estado de Resultados, Balance, Cash Flow, Presupuesto vs Real, Análisis de Varianza e Informe Custom.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  11. Dashboard Tour                                                 */
    /* ------------------------------------------------------------------ */
    {
        id: "dashboard",
        titleEN: "Dashboard Overview",
        titleES: "Visión General del Dashboard",
        descriptionEN: "Explore the main dashboard with KPIs, charts, and summaries",
        descriptionES: "Explora el dashboard principal con KPIs, gráficos y resúmenes",
        pagePath: "/dashboard",
        steps: [
            {
                element: '[data-tour="dash-kpi-strip"]',
                titleEN: "1. Key Performance Indicators",
                titleES: "1. Indicadores Clave de Rendimiento",
                descriptionEN: "Six KPI cards at a glance: <b>Revenue</b>, <b>Expenses</b>, <b>Net Result</b>, <b>Reconciliation Rate</b>, <b>Pending Transactions</b>, and <b>Bank Balance</b>. Toggle the Intercompany switch to include/exclude inter-entity transfers from the numbers.",
                descriptionES: "Seis tarjetas KPI de un vistazo: <b>Ingresos</b>, <b>Gastos</b>, <b>Resultado Neto</b>, <b>Tasa de Conciliación</b>, <b>Transacciones Pendientes</b> y <b>Saldo Bancario</b>. Activa el interruptor Intercompany para incluir/excluir transferencias inter-entidad.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-cashflow-chart"]',
                titleEN: "2. Cash Flow Trend",
                titleES: "2. Tendencia de Flujo de Caja",
                descriptionEN: "A 12-month area chart showing monthly <b>inflows</b> (green) and <b>outflows</b> (red). Hover over any point to see the exact amounts. The chart adapts when the Intercompany toggle is active.",
                descriptionES: "Gráfico de área de 12 meses mostrando <b>entradas</b> mensuales (verde) y <b>salidas</b> (rojo). Pasa el cursor sobre cualquier punto para ver los importes exactos. El gráfico se adapta cuando el toggle Intercompany está activo.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-revenue-channel"]',
                titleEN: "3. Revenue by Payment Channel",
                titleES: "3. Ingresos por Canal de Pago",
                descriptionEN: "Breakdown of revenue by payment gateway: Braintree, Stripe, GoCardless, PayPal, and others. Shows how much revenue flows through each channel.",
                descriptionES: "Desglose de ingresos por pasarela de pago: Braintree, Stripe, GoCardless, PayPal y otros. Muestra cuántos ingresos fluyen por cada canal.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-expense-center"]',
                titleEN: "4. Expenses by Cost Center",
                titleES: "4. Gastos por Centro de Coste",
                descriptionEN: "Top 8 departments by expense amount. Quickly identify which areas of the business are driving the highest costs.",
                descriptionES: "Los 8 departamentos principales por importe de gasto. Identifica rápidamente qué áreas del negocio generan los mayores costes.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-bank-balances"]',
                titleEN: "5. Bank Account Balances",
                titleES: "5. Saldos de Cuentas Bancarias",
                descriptionEN: "Card grid showing current balances for each bank account (Bankinter EUR, Bankinter USD, Sabadell, Chase). Each card displays total inflows, outflows, and the running balance.",
                descriptionES: "Cuadrícula de tarjetas mostrando saldos actuales de cada cuenta bancaria (Bankinter EUR, Bankinter USD, Sabadell, Chase). Cada tarjeta muestra entradas, salidas y saldo acumulado.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-recon-status"]',
                titleEN: "6. Reconciliation Status",
                titleES: "6. Estado de Conciliación",
                descriptionEN: "Reconciliation progress by data source (top 10). Each bar shows the percentage of transactions matched. Green = fully reconciled, amber = partially, red = needs attention.",
                descriptionES: "Progreso de conciliación por fuente de datos (top 10). Cada barra muestra el porcentaje de transacciones emparejadas. Verde = completamente conciliado, ámbar = parcial, rojo = necesita atención.",
                side: "bottom",
            },
            {
                element: '[data-tour="dash-weekly-payments"]',
                titleEN: "7. This Week's Payments",
                titleES: "7. Pagos de Esta Semana",
                descriptionEN: "A table of scheduled payments for the current week (Monday–Sunday). Shows date, provider, description, amount, and payment status (Paid / Pending). Data comes from the Payment Schedule.",
                descriptionES: "Tabla de pagos programados para la semana actual (Lunes–Domingo). Muestra fecha, proveedor, descripción, importe y estado de pago (Pagado / Pendiente). Los datos vienen del Payment Schedule.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  12. Accounts Payable Invoices Tour                                 */
    /* ------------------------------------------------------------------ */
    {
        id: "ap-invoices",
        titleEN: "Accounts Payable — Invoices",
        titleES: "Cuentas por Pagar — Facturas",
        descriptionEN: "Complete walkthrough of the AP invoices management page",
        descriptionES: "Guía completa de la página de gestión de facturas CP",
        pagePath: "/accounts-payable/invoices",
        steps: [
            {
                element: '[data-tour="ap-new-invoice"]',
                titleEN: "1. Create New Invoice",
                titleES: "1. Crear Nueva Factura",
                descriptionEN: "Click <b>New Invoice</b> to open the creation form. Choose invoice type (Incurred, Budget, or Adjustment), fill in dates, provider, amounts, and financial account. You can also export to Excel or PDF from here.",
                descriptionES: "Haz clic en <b>New Invoice</b> para abrir el formulario de creación. Elige el tipo (Incurred, Budget o Adjustment), rellena fechas, proveedor, importes y cuenta financiera. También puedes exportar a Excel o PDF desde aquí.",
                side: "bottom",
            },
            {
                element: '[data-tour="ap-column-selector"]',
                titleEN: "2. Column Selector",
                titleES: "2. Selector de Columnas",
                descriptionEN: "Customize which columns are visible in the table. Choose from 25+ columns including dates, amounts, financial accounts, cost centers, and payment info. Drag to reorder columns.",
                descriptionES: "Personaliza qué columnas son visibles en la tabla. Elige entre más de 25 columnas incluyendo fechas, importes, cuentas financieras, centros de coste e info de pago. Arrastra para reordenar.",
                side: "bottom",
            },
            {
                element: '[data-tour="ap-grouping"]',
                titleEN: "3. Grouping Modes",
                titleES: "3. Modos de Agrupación",
                descriptionEN: "Group invoices by <b>Provider</b>, <b>Financial Account</b>, or <b>Department</b>. Each group shows a subtotal. Use Expand All / Collapse All for quick navigation through grouped data.",
                descriptionES: "Agrupa facturas por <b>Proveedor</b>, <b>Cuenta Financiera</b> o <b>Departamento</b>. Cada grupo muestra un subtotal. Usa Expand All / Collapse All para navegación rápida.",
                side: "bottom",
            },
            {
                element: '[data-tour="ap-year-filter"]',
                titleEN: "4. Year Filter",
                titleES: "4. Filtro de Año",
                descriptionEN: "Filter invoices by fiscal year (2023–2026) or view all years combined. This is a server-side filter that reloads data for the selected year.",
                descriptionES: "Filtra facturas por año fiscal (2023–2026) o ve todos los años combinados. Es un filtro server-side que recarga datos del año seleccionado.",
                side: "bottom",
            },
            {
                element: '[data-tour="ap-search"]',
                titleEN: "5. Search & Filters",
                titleES: "5. Búsqueda y Filtros",
                descriptionEN: "Search across all fields: provider name, description, invoice number, amount. Active column-level filters appear as badges — click the X to remove them.",
                descriptionES: "Busca en todos los campos: nombre de proveedor, descripción, número de factura, importe. Los filtros activos por columna aparecen como badges — haz clic en X para eliminarlos.",
                side: "bottom",
            },
            {
                element: '[data-tour="ap-table"]',
                titleEN: "6. Invoice Table",
                titleES: "6. Tabla de Facturas",
                descriptionEN: "The main table with inline editing. Click any cell to edit directly. Each row shows: status indicator (colored dot), dates, provider, description, amount, financial account, and more. Click the <b>pencil icon</b> to open full edit mode, or <b>Split</b> icon to split an invoice into parts.",
                descriptionES: "La tabla principal con edición inline. Haz clic en cualquier celda para editar directamente. Cada fila muestra: indicador de estado (punto de color), fechas, proveedor, descripción, importe, cuenta financiera y más. Haz clic en el <b>icono lápiz</b> para modo edición completo, o <b>Split</b> para dividir una factura.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  13. Accounts Receivable Invoices (Web Orders) Tour                 */
    /* ------------------------------------------------------------------ */
    {
        id: "ar-invoices",
        titleEN: "Accounts Receivable — Web Orders",
        titleES: "Cuentas por Cobrar — Web Orders",
        descriptionEN: "Navigate the AR invoices page with sync, filters, and statuses",
        descriptionES: "Navega la página de facturas CC con sincronización, filtros y estados",
        pagePath: "/accounts-receivable/invoices",
        steps: [
            {
                element: '[data-tour="ar-toolbar"]',
                titleEN: "1. Action Toolbar",
                titleES: "1. Barra de Acciones",
                descriptionEN: "Four key actions: <b>Sync</b> pulls the latest orders from HubSpot, <b>Export</b> downloads filtered data as Excel, <b>Upload Orders</b> imports Craft Commerce CSV data, and <b>New</b> creates a manual invoice entry.",
                descriptionES: "Cuatro acciones clave: <b>Sync</b> trae los últimos pedidos de HubSpot, <b>Export</b> descarga los datos filtrados como Excel, <b>Upload Orders</b> importa CSV de Craft Commerce, y <b>New</b> crea una entrada manual.",
                side: "bottom",
            },
            {
                element: '[data-tour="ar-search"]',
                titleEN: "2. Search & Status Filter",
                titleES: "2. Búsqueda y Filtro de Estado",
                descriptionEN: "Search by invoice number, client name, or email. Use the status dropdown to filter by: Draft, Pending, Sent, Paid, Partial, Overdue, or Cancelled.",
                descriptionES: "Busca por número de factura, nombre de cliente o email. Usa el dropdown de estado para filtrar por: Draft, Pending, Sent, Paid, Partial, Overdue o Cancelled.",
                side: "bottom",
            },
            {
                element: '[data-tour="ar-stats-bar"]',
                titleEN: "3. Summary Statistics",
                titleES: "3. Estadísticas Resumen",
                descriptionEN: "Five KPI badges: <b>Reconciled</b> (purple — matched with bank), <b>Total</b> (all invoices), <b>Paid</b> (green), <b>Pending</b> (yellow), and <b>Overdue</b> (red). Each shows amount and count.",
                descriptionES: "Cinco badges KPI: <b>Reconciliado</b> (púrpura — emparejado con banco), <b>Total</b> (todas las facturas), <b>Pagado</b> (verde), <b>Pendiente</b> (amarillo) y <b>Vencido</b> (rojo). Cada uno muestra importe y recuento.",
                side: "bottom",
            },
            {
                element: '[data-tour="ar-table"]',
                titleEN: "4. Orders Table",
                titleES: "4. Tabla de Pedidos",
                descriptionEN: "All web orders with sortable columns: Invoice #, Date, Client, Email, Amount, Currency, Source, Status, and Gateway. Click column headers to sort. Use the filter icon (🔍) on each column for inline filtering. Click any row to expand its details.",
                descriptionES: "Todos los pedidos web con columnas ordenables: Factura #, Fecha, Cliente, Email, Importe, Moneda, Fuente, Estado y Pasarela. Haz clic en los encabezados para ordenar. Usa el icono de filtro (🔍) en cada columna para filtrado inline. Haz clic en cualquier fila para expandir detalles.",
                side: "top",
            },
            {
                titleEN: "5. Order Detail & Actions",
                titleES: "5. Detalle de Pedido y Acciones",
                descriptionEN: "When you click a row, the expanded view shows all order metadata. Actions include: <b>View Details</b> (full order info with backend link), <b>Edit</b> (modify status, dates, amounts), and <b>Delete</b>. Reconciled orders show the matched bank transaction reference.",
                descriptionES: "Al hacer clic en una fila, la vista expandida muestra toda la metadata del pedido. Acciones incluyen: <b>Ver Detalles</b> (info completa con enlace al backend), <b>Editar</b> (modificar estado, fechas, importes), y <b>Eliminar</b>. Pedidos conciliados muestran la referencia de transacción bancaria emparejada.",
                side: "bottom",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  14. Payment Channels Tour                                          */
    /* ------------------------------------------------------------------ */
    {
        id: "payment-channels",
        titleEN: "Payment Channels",
        titleES: "Canales de Pago",
        descriptionEN: "Unified view of all payment gateways and their transactions",
        descriptionES: "Vista unificada de todas las pasarelas de pago y sus transacciones",
        pagePath: "/cash-management/payment-channels",
        steps: [
            {
                element: '[data-tour="channels-date-range"]',
                titleEN: "1. Date Range & Actions",
                titleES: "1. Rango de Fechas y Acciones",
                descriptionEN: "Set the date range to filter transactions. Click <b>Apply</b> to reload data. Use <b>Refresh</b> to re-fetch from the database, and <b>Export</b> to download as CSV.",
                descriptionES: "Establece el rango de fechas para filtrar transacciones. Haz clic en <b>Apply</b> para recargar datos. Usa <b>Refresh</b> para re-consultar la base de datos, y <b>Export</b> para descargar como CSV.",
                side: "bottom",
            },
            {
                element: '[data-tour="channels-filters"]',
                titleEN: "2. Search & Filters",
                titleES: "2. Búsqueda y Filtros",
                descriptionEN: "Search by customer name, email, order ID, or transaction ID. Filter by <b>Flow</b> (Inflows/Outflows), <b>Reconciliation Status</b> (Reconciled/Pending), and toggle the <b>Show/Hide Reconciled</b> button.",
                descriptionES: "Busca por nombre de cliente, email, ID de pedido o ID de transacción. Filtra por <b>Flujo</b> (Entradas/Salidas), <b>Estado de Conciliación</b> (Conciliado/Pendiente), y activa el botón <b>Show/Hide Recon.</b>",
                side: "bottom",
            },
            {
                element: '[data-tour="channels-gateway-tabs"]',
                titleEN: "3. Gateway Channel Tabs",
                titleES: "3. Pestañas de Canales de Pasarela",
                descriptionEN: "Toggle payment gateways on/off: Stripe, Braintree (EUR/USD/GBP/AUD), PayPal, GoCardless, and Pleo. Each tab shows the transaction count. <b>Double-click</b> to isolate a single gateway. Click <b>All</b> to select everything.",
                descriptionES: "Activa/desactiva pasarelas de pago: Stripe, Braintree (EUR/USD/GBP/AUD), PayPal, GoCardless y Pleo. Cada pestaña muestra el recuento de transacciones. <b>Doble clic</b> para aislar una sola pasarela. Haz clic en <b>All</b> para seleccionar todas.",
                side: "bottom",
            },
            {
                element: '[data-tour="channels-kpi-bar"]',
                titleEN: "4. KPI Summary Bar",
                titleES: "4. Barra de Resumen KPI",
                descriptionEN: "Six KPI cards: <b>Inflows</b> (green), <b>Outflows</b> (red), <b>Net</b> (blue), <b>Reconciled</b> (count + %), <b>Pending</b> (amber), and <b>Reconciled Value</b> (purple). Click Inflows, Outflows, Reconciled, or Pending to filter the transaction list.",
                descriptionES: "Seis tarjetas KPI: <b>Entradas</b> (verde), <b>Salidas</b> (rojo), <b>Neto</b> (azul), <b>Conciliado</b> (recuento + %), <b>Pendiente</b> (ámbar) y <b>Valor Conciliado</b> (púrpura). Haz clic en Entradas, Salidas, Conciliado o Pendiente para filtrar.",
                side: "bottom",
            },
            {
                element: '[data-tour="channels-txn-list"]',
                titleEN: "5. Transaction List",
                titleES: "5. Lista de Transacciones",
                descriptionEN: "Transactions grouped by date. Each date header shows a summary of debits and credits for that day. Expand/collapse groups with the chevron. Each row shows: description, customer name, amount (color-coded), gateway badge, and reconciliation status icon.",
                descriptionES: "Transacciones agrupadas por fecha. Cada encabezado de fecha muestra un resumen de débitos y créditos del día. Expande/colapsa grupos con el chevron. Cada fila muestra: descripción, nombre de cliente, importe (codificado por color), badge de pasarela e icono de estado de conciliación.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  15. Payroll Tour                                                   */
    /* ------------------------------------------------------------------ */
    {
        id: "payroll",
        titleEN: "Payroll Management",
        titleES: "Gestión de Nóminas",
        descriptionEN: "Upload, analyze, and manage payroll data",
        descriptionES: "Carga, analiza y gestiona datos de nóminas",
        pagePath: "/people/payroll",
        steps: [
            {
                element: '[data-tour="payroll-view-toggle"]',
                titleEN: "1. View Mode",
                titleES: "1. Modo de Vista",
                descriptionEN: "Switch between three views: <b>Employees</b> (individual breakdown with expandable detail rows), <b>Departments</b> (summary by department), and <b>Monthly</b> (historical month-by-month view).",
                descriptionES: "Cambia entre tres vistas: <b>Employees</b> (desglose individual con filas expandibles), <b>Departments</b> (resumen por departamento), y <b>Monthly</b> (vista histórica mes a mes).",
                side: "bottom",
            },
            {
                element: '[data-tour="payroll-year-toggle"]',
                titleEN: "2. Year Selector",
                titleES: "2. Selector de Año",
                descriptionEN: "Toggle between 2025 and 2026 payroll data. The system loads the latest uploaded payroll file for the selected year.",
                descriptionES: "Cambia entre datos de nómina de 2025 y 2026. El sistema carga el último archivo de nómina subido para el año seleccionado.",
                side: "bottom",
            },
            {
                element: '[data-tour="payroll-actions"]',
                titleEN: "3. Upload, Export & Clear",
                titleES: "3. Cargar, Exportar y Limpiar",
                descriptionEN: "Upload a new payroll <b>.xlsx</b> file (drag-and-drop or click), <b>Export</b> the current data as CSV/Excel, or <b>Clear</b> to remove all payroll data for the period.",
                descriptionES: "Sube un nuevo archivo de nómina <b>.xlsx</b> (arrastrar-soltar o clic), <b>Export</b> los datos actuales como CSV/Excel, o <b>Clear</b> para eliminar todos los datos del período.",
                side: "bottom",
            },
            {
                element: '[data-tour="payroll-search"]',
                titleEN: "4. Search & Department Filter",
                titleES: "4. Búsqueda y Filtro de Departamento",
                descriptionEN: "Search employees by name, ID, or department. Use the department dropdown to filter by specific teams.",
                descriptionES: "Busca empleados por nombre, ID o departamento. Usa el dropdown de departamento para filtrar por equipos específicos.",
                side: "bottom",
            },
            {
                element: '[data-tour="payroll-kpi-bar"]',
                titleEN: "5. Payroll KPIs",
                titleES: "5. KPIs de Nómina",
                descriptionEN: "Seven summary cards: <b>Employees</b> (headcount), <b>Gross Total</b>, <b>Deductions</b>, <b>Net (Liquid)</b>, <b>SS Company</b> (social security employer share), <b>IRPF Total</b> (income tax), and <b>Company Cost</b> (total employer cost).",
                descriptionES: "Siete tarjetas resumen: <b>Empleados</b> (headcount), <b>Bruto Total</b>, <b>Deducciones</b>, <b>Neto (Líquido)</b>, <b>SS Empresa</b> (cuota patronal), <b>IRPF Total</b> (impuesto sobre la renta), y <b>Coste Empresa</b> (coste total empleador).",
                side: "bottom",
            },
            {
                element: '[data-tour="payroll-table"]',
                titleEN: "6. Employee Table",
                titleES: "6. Tabla de Empleados",
                descriptionEN: "Each row shows: Employee ID, Name, Department, Gross, Deductions, IRPF, IRPF %, Net, and Company Cost. Click the <b>chevron</b> to expand and see the detailed breakdown of earnings and deductions per employee. The footer row shows grand totals.",
                descriptionES: "Cada fila muestra: ID Empleado, Nombre, Departamento, Bruto, Deducciones, IRPF, % IRPF, Neto y Coste Empresa. Haz clic en el <b>chevron</b> para expandir y ver el desglose detallado de devengos y deducciones. La fila de totales muestra los totales generales.",
                side: "top",
            },
        ],
    },

    /* ------------------------------------------------------------------ */
    /*  16. Workstream Home Tour                                           */
    /* ------------------------------------------------------------------ */
    {
        id: "workstream",
        titleEN: "DSD Workstream",
        titleES: "DSD Workstream",
        descriptionEN: "Your project management hub — tasks, projects, people, and quick actions",
        descriptionES: "Tu centro de gestión de proyectos — tareas, proyectos, personas y acciones rápidas",
        pagePath: "/workstream",
        steps: [
            {
                element: '[data-tour="ws-my-tasks"]',
                titleEN: "1. My Tasks",
                titleES: "1. Mis Tareas",
                descriptionEN: "Your personal task list. Tasks are organized in three tabs: <b>Upcoming</b> (due soon), <b>Overdue</b> (past due — shown in red), and <b>Completed</b>. Click the circle icon to toggle a task between done/not done. Each task shows its project color dot and due date.",
                descriptionES: "Tu lista personal de tareas. Las tareas se organizan en tres pestañas: <b>Upcoming</b> (próximas), <b>Overdue</b> (vencidas — en rojo), y <b>Completed</b>. Haz clic en el círculo para marcar/desmarcar tarea. Cada tarea muestra el color del proyecto y fecha de vencimiento.",
                side: "right",
            },
            {
                element: '[data-tour="ws-projects"]',
                titleEN: "2. Projects",
                titleES: "2. Proyectos",
                descriptionEN: "Your active projects in a card grid. Each card shows the project name, color, and type. Click any project to open its board (Kanban / List / Calendar views). Use the <b>+ Create project</b> card to start a new one.",
                descriptionES: "Tus proyectos activos en una cuadrícula de tarjetas. Cada tarjeta muestra el nombre, color y tipo del proyecto. Haz clic en cualquier proyecto para abrir su tablero (vistas Kanban / Lista / Calendario). Usa <b>+ Create project</b> para crear uno nuevo.",
                side: "left",
            },
            {
                element: '[data-tour="ws-people"]',
                titleEN: "3. People & Teams",
                titleES: "3. Personas y Equipos",
                descriptionEN: "Your frequent collaborators. Click <b>Invite</b> to add new team members. Click <b>View all teams</b> to see the full team directory with roles and permissions.",
                descriptionES: "Tus colaboradores frecuentes. Haz clic en <b>Invite</b> para añadir nuevos miembros del equipo. Haz clic en <b>View all teams</b> para ver el directorio completo con roles y permisos.",
                side: "right",
            },
            {
                element: '[data-tour="ws-quick-links"]',
                titleEN: "4. Quick Actions",
                titleES: "4. Acciones Rápidas",
                descriptionEN: "Four shortcuts: <b>Reporting</b> (progress across projects), <b>Goals</b> (team and company objectives), <b>Portfolios</b> (project health at a glance), and <b>Finance Hub</b> (jump to financial dashboards).",
                descriptionES: "Cuatro atajos: <b>Reporting</b> (progreso de todos los proyectos), <b>Goals</b> (objetivos de equipo y empresa), <b>Portfolios</b> (salud del proyecto de un vistazo), y <b>Finance Hub</b> (ir a dashboards financieros).",
                side: "left",
            },
        ],
    },
];
