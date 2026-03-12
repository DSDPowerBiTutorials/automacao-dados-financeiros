/**
 * Tour definitions for the interactive guided tour system.
 * Each tour is bilingual (EN/ES) and references elements via data-tour attributes.
 */

export type TourLang = "en" | "es";

export interface TourStep {
    element: string;          // CSS selector (preferably [data-tour="..."])
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
    /*  2. Bank Statement Import Tour                                      */
    /* ------------------------------------------------------------------ */
    {
        id: "bank-import",
        titleEN: "Bank Statement Import",
        titleES: "Importación de Extractos Bancarios",
        descriptionEN: "Learn how to import and process bank statement CSV files",
        descriptionES: "Aprende a importar y procesar archivos CSV de extractos bancarios",
        pagePath: "/cash-management/bank-statements",
        steps: [
            {
                element: '[data-tour="bank-selector"]',
                titleEN: "Select Bank Account",
                titleES: "Seleccionar Cuenta Bancaria",
                descriptionEN: "Choose which bank account to work with. Each account has its own statement history and reconciliation status.",
                descriptionES: "Elige con qué cuenta bancaria trabajar. Cada cuenta tiene su propio historial de extractos y estado de conciliación.",
                side: "bottom",
            },
            {
                element: '[data-tour="upload-csv"]',
                titleEN: "Upload CSV",
                titleES: "Subir CSV",
                descriptionEN: "Upload a bank statement CSV file. The system auto-detects the bank format (Bankinter, Sabadell, etc.) and parses it using European number formatting.",
                descriptionES: "Sube un archivo CSV del extracto bancario. El sistema auto-detecta el formato del banco (Bankinter, Sabadell, etc.) y lo procesa con formato numérico europeo.",
                side: "bottom",
            },
            {
                element: '[data-tour="date-filter"]',
                titleEN: "Date Range Filter",
                titleES: "Filtro de Rango de Fechas",
                descriptionEN: "Filter transactions by date range. Useful for reconciling a specific month or quarter.",
                descriptionES: "Filtra transacciones por rango de fechas. Útil para conciliar un mes o trimestre específico.",
                side: "bottom",
            },
            {
                element: '[data-tour="reconciliation-modes"]',
                titleEN: "Reconciliation Modes",
                titleES: "Modos de Conciliación",
                descriptionEN: "Five different modes to match bank transactions: Expense→AP Invoice, Credit→Gateway Settlement, Smart Disbursement Chain, Revenue→Web Orders, and Intercompany. Each uses different matching logic.",
                descriptionES: "Cinco modos diferentes para emparejar transacciones bancarias: Gasto→Factura CP, Crédito→Lote de Liquidación, Cadena de Desembolsos, Ingreso→Pedidos Web, e Intercompañía. Cada uno usa lógica de emparejamiento diferente.",
                side: "top",
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
