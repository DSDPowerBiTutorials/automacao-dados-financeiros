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
                titleEN: "7. Transaction Detail Panel",
                titleES: "7. Panel de Detalle de Transacción",
                descriptionEN: "Click any transaction row to open the detail panel on the right side. It shows: full transaction info (date, amount, description, bank, custom fields), gateway reconciliation status with payment source details, revenue breakdown with individual customer transactions, linked orders with invoice numbers, and for expenses — matched AP invoices.",
                descriptionES: "Haz clic en cualquier fila de transacción para abrir el panel de detalle a la derecha. Muestra: información completa (fecha, importe, descripción, banco, campos personalizados), estado de conciliación de pasarela con detalles de fuente de pago, desglose de ingresos con transacciones individuales de clientes, pedidos vinculados con números de factura, y para gastos — facturas CP emparejadas.",
                side: "bottom",
            },
            /* Step 8 — Manual Reconcile (centered popover) */
            {
                titleEN: "8. Manual Reconciliation",
                titleES: "8. Conciliación Manual",
                descriptionEN: "From the detail panel, click 'Manual Reconcile' to open the Smart Matching dialog. For expenses, the system suggests AP invoices matched by provider name and amount. For revenues, it shows disbursement chains, payment source matches, and order matches. Select one or more suggestions and confirm.",
                descriptionES: "Desde el panel de detalle, haz clic en 'Manual Reconcile' para abrir el diálogo de Emparejamiento Inteligente. Para gastos, el sistema sugiere facturas CP por nombre de proveedor e importe. Para ingresos, muestra cadenas de desembolsos, coincidencias de fuente de pago y coincidencias de pedidos. Selecciona una o más sugerencias y confirma.",
                side: "bottom",
            },
            /* Step 9 — Reconciliation Dialog tabs (centered popover) */
            {
                titleEN: "9. Matching Dialog Tabs",
                titleES: "9. Pestañas del Diálogo de Emparejamiento",
                descriptionEN: "The reconciliation dialog has four tabs: (1) Suggestions — AI-powered matches ranked by confidence score, (2) All Invoices/Orders — browse every unreconciled item with search, (3) Manual — enter a custom match by searching provider or invoice number, (4) Intercompany — match transfers between DSD Spain and DSD USA. Each match shows a confidence percentage badge.",
                descriptionES: "El diálogo de conciliación tiene cuatro pestañas: (1) Sugerencias — coincidencias con IA ordenadas por puntuación de confianza, (2) Todas las Facturas/Pedidos — navega cada item no conciliado con búsqueda, (3) Manual — introduce un emparejamiento custom buscando proveedor o número de factura, (4) Intercompañía — empareja transferencias entre DSD Spain y DSD USA. Cada coincidencia muestra un badge de porcentaje de confianza.",
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
];
