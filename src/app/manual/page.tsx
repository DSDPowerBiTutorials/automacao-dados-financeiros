"use client";

import { useState } from "react";
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Database,
    CreditCard,
    FileText,
    ShoppingCart,
    Receipt,
    Zap,
    BarChart3,
    GitMerge,
    Settings,
    Server,
    Building2,
    Users,
    Package,
    Wallet,
    ArrowLeftRight,
    Search,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Upload,
    Globe,
    Play,
    ArrowDown,
    MousePointerClick,
    Eye,
    Link2,
    Compass,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Lang = "en" | "es";
function t(lang: Lang, en: string, es: string) { return lang === "en" ? en : es; }

interface Section {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function ManualSection({
    section,
    isOpen,
    onToggle,
}: {
    section: Section;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-black/40">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
                <span className="text-orange-500">{section.icon}</span>
                <span className="flex-1 font-semibold text-gray-900 dark:text-white text-base">
                    {section.title}
                </span>
                {isOpen ? (
                    <ChevronDown size={18} className="text-gray-400" />
                ) : (
                    <ChevronRight size={18} className="text-gray-400" />
                )}
            </button>
            {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
                    <div className="pt-4 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                        {section.content}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Reusable table                                                     */
/* ------------------------------------------------------------------ */

function InfoTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: string[][];
}) {
    return (
        <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th
                                key={h}
                                className="text-left px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-400"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Badge({ children, color = "orange" }: { children: React.ReactNode; color?: string }) {
    const colors: Record<string, string> = {
        orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.orange}`}>
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Section Contents                                                   */
/* ------------------------------------------------------------------ */

function ExecutiveSummary({ lang }: { lang: Lang }) {
    return (
        <>
            <p>
                {t(lang,
                    "FinanceFlow is an end-to-end financial reconciliation platform purpose-built for multi-entity, multi-currency businesses. It ingests data from banks, payment gateways, CRMs, and accounting systems, then automatically matches and reconciles transactions across all sources.",
                    "FinanceFlow es una plataforma integral de conciliación financiera diseñada para empresas multiempresa y multidivisa. Ingesta datos de bancos, pasarelas de pago, CRMs y sistemas contables, y luego empareja y concilia transacciones automáticamente entre todas las fuentes."
                )}
            </p>
            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Core Capabilities", "Capacidades Principales")}</h4>
            <InfoTable
                headers={[t(lang, "Capability", "Capacidad"), t(lang, "Description", "Descripción")]}
                rows={[
                    [t(lang, "Multi-Bank Reconciliation", "Conciliación Multi-Banco"), "Bankinter (EUR/USD), Sabadell (EUR), Chase (USD)"],
                    [t(lang, "Payment Gateway Consolidation", "Consolidación de Pasarelas de Pago"), "Braintree (5 currencies), Stripe (EUR/USD), GoCardless, PayPal, Pleo"],
                    [t(lang, "Automated Matching", "Emparejamiento Automático"), t(lang, "±3 days date proximity + ±€0.01 amount matching", "±3 días de proximidad + ±€0,01 de diferencia en importe")],
                    [t(lang, "Multi-Currency", "Multi-Divisa"), t(lang, "EUR, USD, GBP, AUD with automatic exchange rate tracking", "EUR, USD, GBP, AUD con seguimiento automático de tipo de cambio")],
                    [t(lang, "Accounts Payable", "Cuentas por Pagar"), t(lang, "Full invoice lifecycle from entry to bank reconciliation", "Ciclo completo de facturas desde la entrada hasta la conciliación bancaria")],
                    [t(lang, "Accounts Receivable", "Cuentas por Cobrar"), t(lang, "Customer invoice management with payment tracking", "Gestión de facturas de clientes con seguimiento de pagos")],
                    [t(lang, "Sales Analytics", "Análisis de Ventas"), t(lang, "Clinic MRR/churn, Lab product analytics, lifetime analysis", "MRR/churn de clínicas, análisis de productos Lab, análisis de ciclo de vida")],
                    [t(lang, "CRM Integration", "Integración CRM"), t(lang, "HubSpot deal sync via SQL Server data warehouse", "Sincronización de deals HubSpot vía SQL Server data warehouse")],
                    [t(lang, "Accounting Integration", "Integración Contable"), t(lang, "QuickBooks Online sync (invoices, bills, payments, vendors)", "Sincronización con QuickBooks Online (facturas, gastos, pagos, proveedores)")],
                    [t(lang, "Project Management", "Gestión de Proyectos"), t(lang, "Built-in Workstream module (Kanban, Timeline, Subtasks, Dependencies)", "Módulo Workstream integrado (Kanban, Timeline, Subtareas, Dependencias)")],
                ]}
            />
            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Who It's For", "¿Para Quién Es?")}</h4>
            <ul className="list-disc pl-5 space-y-1">
                <li>{t(lang, "Finance teams managing multiple bank accounts and payment processors across countries", "Equipos financieros que gestionan múltiples cuentas bancarias y procesadores de pago en varios países")}</li>
                <li>{t(lang, "Operations leaders tracking revenue, expenses, and cash flow in real time", "Líderes de operaciones que rastrean ingresos, gastos y flujo de caja en tiempo real")}</li>
                <li>{t(lang, "Companies with e-commerce selling through Braintree, Stripe, GoCardless, PayPal", "Empresas con e-commerce que venden a través de Braintree, Stripe, GoCardless, PayPal")}</li>
                <li>{t(lang, "Multi-entity businesses operating in different countries (e.g., Spain + US)", "Empresas multi-entidad operando en diferentes países (ej. España + EE.UU.)")}</li>
            </ul>
        </>
    );
}

function SystemArchitecture({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">{t(lang, "Technology Stack", "Stack Tecnológico")}</h4>
            <InfoTable
                headers={[t(lang, "Layer", "Capa"), t(lang, "Technology", "Tecnología")]}
                rows={[
                    ["Frontend", "Next.js 14 (App Router), React, TypeScript, Tailwind CSS"],
                    [t(lang, "UI Components", "Componentes UI"), "shadcn/ui, Lucide icons"],
                    [t(lang, "Database", "Base de Datos"), "Supabase (PostgreSQL) with Row Level Security"],
                    [t(lang, "File Storage", "Almacenamiento de Archivos"), "Supabase Storage (CSV/XLSX uploads)"],
                    [t(lang, "Authentication", "Autenticación"), "Supabase Auth (PKCE flow, session persistence)"],
                    ["Hosting", "Vercel (auto-deploy from Git)"],
                    ["External APIs", "Braintree SDK, Stripe API, GoCardless, QuickBooks OAuth, HubSpot SQL Server"],
                ]}
            />
            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Data Flow", "Flujo de Datos")}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-3">
                {[
                    { label: t(lang, "Input", "Entrada"), desc: t(lang, "Bank CSVs, Gateway CSVs, API Syncs, Manual Entry", "CSVs bancarios, CSVs de pasarelas, Sincronización API, Entrada manual"), icon: <Upload size={16} /> },
                    { label: t(lang, "Normalize", "Normalizar"), desc: t(lang, "EU/US number parsing, date ISO, currency detection, dedup", "Parseo numérico EU/US, fecha ISO, detección de divisa, dedup"), icon: <ArrowLeftRight size={16} /> },
                    { label: t(lang, "Store", "Almacenar"), desc: "csv_rows, invoices, ar_invoices, master data tables", icon: <Database size={16} /> },
                    { label: t(lang, "Report", "Informes"), desc: t(lang, "Dashboard, Bank/Gateway Reports, P&L, Sales Insights", "Dashboard, Informes Bancarios/Pasarelas, P&L, Análisis de Ventas"), icon: <BarChart3 size={16} /> },
                ].map((step) => (
                    <div key={step.label} className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-orange-500 mb-1">{step.icon}</span>
                        <span className="font-medium text-sm">{step.label}</span>
                        <span className="text-xs text-gray-500 mt-1">{step.desc}</span>
                    </div>
                ))}
            </div>
        </>
    );
}

function BankStatements({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang, "Bank statements are the foundation of reconciliation. Each bank has a dedicated import handler.", "Los extractos bancarios son la base de la conciliación. Cada banco tiene su propio importador dedicado.")}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Supported Banks", "Bancos Soportados")}</h4>
            <InfoTable
                headers={[t(lang, "Bank", "Banco"), "Source ID", t(lang, "Format", "Formato"), t(lang, "Number Format", "Formato Numérico")]}
                rows={[
                    ["Bankinter EUR", "bankinter-eur", "XLSX/XLS", t(lang, "European (1.000,50)", "Europeo (1.000,50)")],
                    ["Bankinter USD", "bankinter-usd", "XLSX/XLS", t(lang, "European (1.000,50)", "Europeo (1.000,50)")],
                    ["Sabadell EUR", "sabadell", t(lang, "CSV (semicolon)", "CSV (punto y coma)"), t(lang, "European (1.000,50)", "Europeo (1.000,50)")],
                    ["Chase USD", "chase-usd", t(lang, "CSV (comma)", "CSV (coma)"), "US ($1,000.50)"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 User Must Provide", "📋 El Usuario Debe Proporcionar")}</Badge>
            </h4>

            <p className="font-medium mt-3">Bankinter (EUR/USD):</p>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Example", "Ejemplo"), t(lang, "Notes", "Notas")]}
                rows={[
                    ["FECHA VALOR / FECHA CONTABLE", "15/03/2026", t(lang, "Transaction date", "Fecha de transacción")],
                    ["DESCRIPCIÓN", "TRANSFERENCIA SEPA", t(lang, "Description", "Descripción")],
                    [t(lang, "DEBE (debit)", "DEBE (débito)"), "1.250,00", t(lang, "Money going OUT", "Dinero que SALE")],
                    [t(lang, "HABER (credit)", "HABER (crédito)"), "4.500,75", t(lang, "Money coming IN", "Dinero que ENTRA")],
                ]}
            />
            <p className="text-xs text-gray-500 mb-3">{t(lang, "Amount = HABER − DEBE. If IMPORTE column present, used directly.", "Importe = HABER − DEBE. Si existe la columna IMPORTE, se usa directamente.")}</p>

            <p className="font-medium mt-3">Sabadell:</p>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Example", "Ejemplo")]}
                rows={[
                    ["FECHA", "15/03/2026"],
                    ["CONCEPTO / DESCRIPCION", "RECIBO DOMICILIADO"],
                    ["MOVIMIENTO / IMPORTE", "1.250,50"],
                ]}
            />

            <p className="font-medium mt-3">Chase USD:</p>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Example", "Ejemplo")]}
                rows={[
                    ["POSTING DATE", "03/15/2026 (MM/DD/YYYY)"],
                    ["DESCRIPTION", "STRIPE TRANSFER"],
                    ["AMOUNT", "$1,250.75"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">{t(lang, "🔄 Workflow", "🔄 Flujo de Trabajo")}</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>{t(lang, "Download statement from online banking (XLSX for Bankinter, CSV for Sabadell/Chase)", "Descargar extracto de la banca online (XLSX para Bankinter, CSV para Sabadell/Chase)")}</li>
                <li>{t(lang, "Navigate to Cash Management → Bank Statements → select the bank tab", "Navegar a Cash Management → Extractos Bancarios → seleccionar la pestaña del banco")}</li>
                <li>{t(lang, 'Click "Upload File" → select your downloaded file', 'Clic en "Subir Archivo" → seleccionar el archivo descargado')}</li>
                <li>{t(lang, 'Review parsed rows and verify totals → Click "Save"', 'Revisar las filas parseadas y verificar totales → Clic en "Guardar"')}</li>
                <li>{t(lang, "Check the corresponding report page (e.g., Reports → Bankinter EUR)", "Verificar la página de informe correspondiente (ej. Informes → Bankinter EUR)")}</li>
            </ol>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="blue">{t(lang, "📊 Feeds Into", "📊 Alimenta")}</Badge>
            </h4>
            <p>{t(lang, "Bank report pages, Dashboard (cash flow), Cash Management (bank position), Reconciliation Center", "Páginas de informes bancarios, Dashboard (flujo de caja), Cash Management (posición bancaria), Centro de Conciliación")}</p>

            <h4 className="font-semibold mt-4 mb-2">
                <Badge color="purple">{t(lang, "🎬 Video Tutorial", "🎬 Tutorial en Vídeo")}</Badge>
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(lang, "Watch how to download, upload, and review bank statements step-by-step.", "Mira cómo descargar, subir y revisar extractos bancarios paso a paso.")}
            </p>
            <p className="text-xs text-gray-500 mt-1">
                {t(lang, "Tip: Look for the ▶ icon in the page header for quick access to this video.", "Consejo: Busca el icono ▶ en el encabezado de la página para acceso rápido al vídeo.")}
            </p>
        </>
    );
}

function PaymentGateways({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang, "Payment gateway data can be imported via CSV upload or automated API sync.", "Los datos de pasarelas de pago pueden importarse mediante carga CSV o sincronización automática por API.")}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Supported Gateways", "Pasarelas Soportadas")}</h4>
            <InfoTable
                headers={[t(lang, "Gateway", "Pasarela"), t(lang, "Currencies", "Divisas"), t(lang, "Import Methods", "Métodos de Importación")]}
                rows={[
                    ["Braintree", "EUR, USD, GBP, AUD, AMEX", "CSV + API Sync"],
                    ["Stripe", "EUR, USD", "CSV + API Sync"],
                    ["GoCardless", "EUR (SEPA)", t(lang, "API Sync only", "Solo API Sync")],
                    ["PayPal", "EUR", t(lang, "CSV upload", "Carga CSV")],
                    ["Pleo", "EUR", "API Sync"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 Braintree CSV Columns", "📋 Columnas CSV de Braintree")}</Badge>
            </h4>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Maps To", "Mapea A")]}
                rows={[
                    ["Transaction ID", "transaction_id"],
                    ["Settlement Date", t(lang, "date (primary)", "date (principal)")],
                    ["Amount Submitted For Settlement", "amount"],
                    ["Service Fee", t(lang, "Separate fee row", "Fila de comisión separada")],
                    ["Customer First/Last Name", "customer_name"],
                    ["Customer Email", "customer_email"],
                    ["Order ID", t(lang, "order_id (e-commerce link)", "order_id (enlace e-commerce)")],
                    ["Settlement Batch ID", t(lang, "Groups transactions in bank deposits", "Agrupa transacciones en depósitos bancarios")],
                    ["Merchant Account", t(lang, "Currency detection (EUR/USD/GBP/AUD)", "Detección de divisa (EUR/USD/GBP/AUD)")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 API Setup (one-time)", "📋 Configuración API (una vez)")}</Badge>
            </h4>
            <InfoTable
                headers={[t(lang, "Integration", "Integración"), t(lang, "Required Environment Variables", "Variables de Entorno Requeridas")]}
                rows={[
                    ["Braintree", "BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY"],
                    ["Stripe", "STRIPE_SECRET_KEY"],
                    ["GoCardless", "GOCARDLESS_ACCESS_TOKEN, GOCARDLESS_ENVIRONMENT"],
                    ["Pleo", "PLEO_API_KEY"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">{t(lang, "🔄 API Sync Workflow", "🔄 Flujo de Sincronización API")}</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>{t(lang, "Navigate to the gateway report page (e.g., Reports → Braintree EUR)", "Navegar a la página de informe de la pasarela (ej. Informes → Braintree EUR)")}</li>
                <li>{t(lang, 'Click "Sync" button → choose date range or "Days Back"', 'Clic en "Sync" → elegir rango de fechas o "Días Atrás"')}</li>
                <li>{t(lang, "System automatically processes, deduplicates, and preserves reconciliation state", "El sistema procesa, deduplica y preserva el estado de conciliación automáticamente")}</li>
            </ol>

            <p className="mt-3 text-sm"><strong>{t(lang, "Key rules:", "Reglas clave:")}</strong> {t(lang, "Declined/voided/failed transactions skipped. Each Braintree transaction creates two rows (revenue + fee). Currency auto-detected from merchant account.", "Transacciones rechazadas/anuladas/fallidas se omiten. Cada transacción Braintree crea dos filas (ingreso + comisión). La divisa se auto-detecta desde la cuenta del comerciante.")}</p>
        </>
    );
}

function InvoiceOrders({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang, "Invoice orders represent revenue transactions from the invoicing system (Craft Commerce, Chargebee, etc.).", "Los pedidos de factura representan transacciones de ingresos del sistema de facturación (Craft Commerce, Chargebee, etc.).")}</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 Required Columns", "📋 Columnas Requeridas")}</Badge>
            </h4>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Accepted Headers", "Encabezados Aceptados"), t(lang, "Example", "Ejemplo")]}
                rows={[
                    ["Invoice ID", "ID, NUMBER", "INV-2026-0001"],
                    [t(lang, "Date", "Fecha"), "INVOICE DATE, DATE, FECHA", "2026-03-15"],
                    [t(lang, "Amount", "Importe"), "TOTAL, AMOUNT, VALOR", "1250.50"],
                ]}
            />

            <h4 className="font-semibold mt-3 mb-1">
                <Badge color="gray">{t(lang, "Optional (enriched if present)", "Opcional (enriquecido si presente)")}</Badge>
            </h4>
            <InfoTable
                headers={[t(lang, "Column", "Columna"), t(lang, "Headers", "Encabezados"), t(lang, "Purpose", "Propósito")]}
                rows={[
                    [t(lang, "Products", "Productos"), "PRODUCTS, DESCRIPTION", t(lang, "FA classification + description", "Clasificación FA + descripción")],
                    [t(lang, "Order Number", "Número de Pedido"), "ORDER", t(lang, "E-commerce cross-matching", "Cruce con e-commerce")],
                    [t(lang, "Currency", "Divisa"), "CURRENCY", t(lang, "Defaults EUR if absent", "Por defecto EUR si ausente")],
                    [t(lang, "Client", "Cliente"), "CLIENT, COMPANY", t(lang, "Customer identification", "Identificación del cliente")],
                    ["Email", "EMAIL", t(lang, "Cross-matching with gateways", "Cruce con pasarelas")],
                    [t(lang, "Country", "País"), "COUNTRY", t(lang, "Geographic segmentation", "Segmentación geográfica")],
                    [t(lang, "Payment Method", "Método de Pago"), "PAYMENT METHOD", "Braintree, Stripe, etc."],
                    [t(lang, "Charged", "Cobrado"), "CHARGED", t(lang, "Actual charged amount", "Importe realmente cobrado")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Automatic Financial Account Classification", "Clasificación Automática de Cuentas Financieras")}</h4>
            <InfoTable
                headers={[t(lang, "FA Account", "Cuenta FA"), t(lang, "Code", "Código"), t(lang, "Matched Products", "Productos Emparejados")]}
                rows={[
                    ["DSD Courses", "101.1", "DSD Provider, Designing Smiles, Case Acceptance"],
                    ["Mastership", "101.3", "Mastership, Residency"],
                    ["PC Membership", "101.4", "Provider Membership, Planning Center Membership"],
                    ["Partnerships", "101.5", "Sponsorship, Partnership, Exhibit Space"],
                    ["Consultancies", "102.5", "Clinic Transformation, Consultancy"],
                    ["Marketing Coaching", "102.6", "Fractional CMO, Growth Hub Onboarding"],
                    ["Planning Center", "103.0", "Smile Design, Prep Guide, Ortho Planning"],
                    ["LAB", "104.0", "Manufacture, Prosthesis, Crown, Veneer"],
                    ["Subscriptions", "105.1", "Growth Hub, Monthly Subscription"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">{t(lang, "🔄 Workflow", "🔄 Flujo de Trabajo")}</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>{t(lang, "Export invoices as CSV/XLSX from invoicing system", "Exportar facturas como CSV/XLSX del sistema de facturación")}</li>
                <li>{t(lang, "Navigate to Accounts Receivable → Invoice Orders", "Navegar a Cuentas por Cobrar → Pedidos de Factura")}</li>
                <li>{t(lang, 'Click "Upload CSV" → select file → system shows column mapping preview', 'Clic en "Subir CSV" → seleccionar archivo → el sistema muestra vista previa del mapeo')}</li>
                <li>{t(lang, "System checks for duplicate invoice_numbers (DB + within file) → duplicates skipped", "El sistema verifica invoice_numbers duplicados (BD + dentro del archivo) → duplicados omitidos")}</li>
                <li>{t(lang, "Rows parsed, FA auto-classified, inserted with source = invoice-orders", "Filas parseadas, FA auto-clasificada, insertadas con source = invoice-orders")}</li>
            </ol>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="blue">{t(lang, "📊 Feeds Into", "📊 Alimenta")}</Badge>
            </h4>
            <p>{t(lang, "AR Invoice Orders page, Braintree reports (cross-reference), Reconciliation Center, Sales Insights (Lab, Clinics), P&L revenue lines", "Página de Pedidos de Factura CC, informes Braintree (referencia cruzada), Centro de Conciliación, Análisis de Ventas (Lab, Clínicas), líneas de ingresos P&L")}</p>

            <h4 className="font-semibold mt-4 mb-2">
                <Badge color="purple">{t(lang, "🎬 Video Tutorial", "🎬 Tutorial en Vídeo")}</Badge>
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t(lang, "Watch how to upload invoice orders, review column mapping, and classify products by Financial Account.", "Mira cómo subir pedidos de factura, revisar el mapeo de columnas y clasificar productos por Cuenta Financiera.")}
            </p>
            <video
                src="https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773861812567-01_AC_-_Invoice_Orders_Upload_Flow.mp4"
                controls
                preload="metadata"
                className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-2">
                {t(lang, "Tip: Look for the ▶ icon in the page header for quick access to this video.", "Consejo: Busca el icono ▶ en el encabezado de la página para acceso rápido al vídeo.")}
            </p>
        </>
    );
}

function WebOrdersCRM({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">{t(lang, "HubSpot Deals (via SQL Server)", "Deals de HubSpot (vía SQL Server)")}</h4>
            <p>{t(lang, "Fully automated sync — no file uploads needed. System connects to SQL Server data warehouse with replicated HubSpot data.", "Sincronización totalmente automática — no se necesitan cargas de archivos. El sistema se conecta al data warehouse SQL Server con datos replicados de HubSpot.")}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>{t(lang, "Extracts: deal name, close date, amount, currency, contact, products, order number", "Extrae: nombre del deal, fecha de cierre, importe, divisa, contacto, productos, número de pedido")}</li>
                <li>{t(lang, "Auto-classifies to Financial Accounts (101.x–105.x)", "Auto-clasifica a Cuentas Financieras (101.x–105.x)")}</li>
                <li>{t(lang, "Dedup: by deal_id (primary) + ecomm_order_number (secondary)", "Dedup: por deal_id (primario) + ecomm_order_number (secundario)")}</li>
                <li>{t(lang, "Preserves reconciliation flags on update", "Preserva los flags de conciliación en actualizaciones")}</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Craft Commerce (E-Commerce)", "Craft Commerce (E-Commerce)")}</h4>
            <p>{t(lang, "Upload full orders CSV from Craft CMS admin panel.", "Subir CSV completo de pedidos desde el panel de administración de Craft CMS.")}</p>
            <InfoTable
                headers={[t(lang, "Key Column", "Columna Clave"), t(lang, "Description", "Descripción")]}
                rows={[
                    ["reference", t(lang, "Order reference number", "Número de referencia del pedido")],
                    ["storedTotalPrice", t(lang, "Total order value", "Valor total del pedido")],
                    ["email", t(lang, "Customer email", "Email del cliente")],
                    ["gatewayId", "2 = Braintree, 3 = Stripe, 1 = Manual"],
                    [t(lang, "couponCode", "couponCode"), t(lang, "Discount code applied", "Código de descuento aplicado")],
                ]}
            />
            <p className="mt-2 text-sm">{t(lang, "System auto-classifies each order into deal status and payment status categories.", "El sistema auto-clasifica cada pedido en categorías de estado de deal y estado de pago.")}</p>
        </>
    );
}

function AccountsPayable({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang, "AP invoices are entered manually through a comprehensive form interface tracking the full invoice lifecycle.", "Las facturas de CP se introducen manualmente a través de una interfaz de formulario completa que rastrea el ciclo de vida completo de la factura.")}</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 Required Fields (per invoice)", "📋 Campos Requeridos (por factura)")}</Badge>
            </h4>
            <InfoTable
                headers={[t(lang, "Field", "Campo"), t(lang, "Required?", "¿Requerido?"), t(lang, "Notes", "Notas")]}
                rows={[
                    [t(lang, "Invoice number", "Número de factura"), t(lang, "Yes", "Sí"), t(lang, "Unique identifier", "Identificador único")],
                    [t(lang, "Provider", "Proveedor"), t(lang, "Yes", "Sí"), t(lang, "From master data dropdown", "Del desplegable de datos maestros")],
                    [t(lang, "Invoice date / Benefit date / Due date", "Fecha factura / Fecha devengo / Vencimiento"), t(lang, "Yes", "Sí"), ""],
                    [t(lang, "Amount + Currency", "Importe + Divisa"), t(lang, "Yes", "Sí"), ""],
                    [t(lang, "Financial Account (GL code)", "Cuenta Financiera (código GL)"), t(lang, "Yes", "Sí"), t(lang, "Chart of accounts", "Plan de cuentas")],
                    [t(lang, "Cost Center", "Centro de Coste"), t(lang, "Yes", "Sí"), t(lang, "Department", "Departamento")],
                    [t(lang, "Payment method / Bank account", "Método de pago / Cuenta bancaria"), t(lang, "When paying", "Al pagar"), ""],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Invoice Types", "Tipos de Factura")}</h4>
            <InfoTable
                headers={[t(lang, "Type", "Tipo"), t(lang, "P&L Impact", "Impacto P&L"), t(lang, "Cash Impact", "Impacto Caja")]}
                rows={[
                    [t(lang, "INCURRED — Standard expense", "INCURRIDO — Gasto estándar"), t(lang, "Yes", "Sí"), t(lang, "Yes", "Sí")],
                    [t(lang, "BUDGET — Forecast only", "PRESUPUESTO — Solo previsión"), "No", "No"],
                    [t(lang, "ADJUSTMENT — Cash correction", "AJUSTE — Corrección de caja"), "No", t(lang, "Yes", "Sí")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Invoice Splitting", "División de Facturas")}</h4>
            <p>{t(lang, "Invoices can be split by installment, FA allocation, cost center, or departmental type. Parent-child relationships maintained.", "Las facturas pueden dividirse por cuotas, asignación FA, centro de coste o tipo departamental. Se mantienen las relaciones padre-hijo.")}</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 Master Data Required First", "📋 Datos Maestros Requeridos Primero")}</Badge>
            </h4>
            <ul className="list-disc pl-5 space-y-1">
                <li>{t(lang, "Providers (at least one vendor)", "Proveedores (al menos un proveedor)")}</li>
                <li>{t(lang, "Financial Accounts (chart of accounts populated)", "Cuentas Financieras (plan de cuentas rellenado)")}</li>
                <li>{t(lang, "Cost Centers (at least one department)", "Centros de Coste (al menos un departamento)")}</li>
                <li>{t(lang, "Bank Accounts (at least one for payment recording)", "Cuentas Bancarias (al menos una para registro de pagos)")}</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">
                <Badge color="purple">{t(lang, "🎬 Video Tutorial", "🎬 Tutorial en Vídeo")}</Badge>
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t(lang, "Watch how to enter an AP invoice, set up master data (providers, cost centers), and process payments.", "Mira cómo ingresar una factura de CP, configurar datos maestros (proveedores, centros de coste) y procesar pagos.")}
            </p>
            <video
                src="https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773865549393-02_AP_-_Invoices_creation_and_reconciliation.mp4"
                controls
                preload="metadata"
                className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-2">
                {t(lang, "Tip: Look for the ▶ icon in the page header for quick access to this video.", "Consejo: Busca el icono ▶ en el encabezado de la página para acceso rápido al vídeo.")}
            </p>
        </>
    );
}

function APIIntegrations({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">QuickBooks Online</h4>
            <p>{t(lang, "OAuth 2.0 authentication — user authorizes once, tokens auto-refresh.", "Autenticación OAuth 2.0 — el usuario autoriza una vez, los tokens se renuevan automáticamente.")}</p>

            <InfoTable
                headers={[t(lang, "Sync Type", "Tipo de Sincronización"), "Source ID", t(lang, "Content", "Contenido")]}
                rows={[
                    [t(lang, "Invoices", "Facturas"), "quickbooks-invoices", t(lang, "Customer invoices, due dates, line items", "Facturas de clientes, vencimientos, líneas de detalle")],
                    [t(lang, "Payments", "Pagos"), "quickbooks-payments", t(lang, "Payment receipts, methods, references", "Recibos de pago, métodos, referencias")],
                    [t(lang, "Bills", "Facturas de proveedor"), "quickbooks-bills", t(lang, "Vendor bills, amounts", "Facturas de proveedores, importes")],
                    [t(lang, "Expenses", "Gastos"), "quickbooks-expenses", t(lang, "Direct expenses, categories", "Gastos directos, categorías")],
                    [t(lang, "Customers", "Clientes"), t(lang, "Master data", "Datos maestros"), t(lang, "Customer list", "Lista de clientes")],
                    [t(lang, "Vendors", "Proveedores"), t(lang, "Master data", "Datos maestros"), t(lang, "Vendor list", "Lista de proveedores")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">{t(lang, "📋 Setup", "📋 Configuración")}</Badge>
            </h4>
            <p>{t(lang, "QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REALM_ID → then complete OAuth flow via Settings → Integrations → QuickBooks → Connect", "QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REALM_ID → luego completar el flujo OAuth en Configuración → Integraciones → QuickBooks → Conectar")}</p>
        </>
    );
}

function ReportsSection({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">{t(lang, "Executive", "Ejecutivo")}</h4>
            <InfoTable
                headers={[t(lang, "Report", "Informe"), t(lang, "Content", "Contenido")]}
                rows={[
                    ["Dashboard", t(lang, "KPIs: revenue, expenses, net result, reconciliation rate, pending, bank balance", "KPIs: ingresos, gastos, resultado neto, tasa de conciliación, pendientes, saldo bancario")],
                    ["P&L", t(lang, "Profit & Loss with monthly columns, budget vs actual, drilldown", "Profit & Loss con columnas mensuales, presupuesto vs real, desglose")],
                    [t(lang, "Cashflow (Bank)", "Flujo de Caja (Banco)"), t(lang, "Bank-level cashflow with gateway reconciliation", "Flujo de caja a nivel de banco con conciliación de pasarelas")],
                    [t(lang, "Cashflow (Consolidated)", "Flujo de Caja (Consolidado)"), t(lang, "Revenue cashflow by FA groups vs bank inflows", "Flujo de caja de ingresos por grupos FA vs entradas bancarias")],
                    [t(lang, "Departmental P&L", "P&L Departamental"), t(lang, "P&L by department/cost center", "P&L por departamento/centro de coste")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Bank Reports (4 banks)", "Informes Bancarios (4 bancos)")}</h4>
            <p>{t(lang, "Each with: inline editing, one-click reconciliation toggle, payment source badges (Braintree/Stripe/GoCardless auto-detected), date range filter, export, intercompany matching.", "Cada uno con: edición inline, toggle de conciliación con un clic, badges de fuente de pago (Braintree/Stripe/GoCardless auto-detectados), filtro por rango de fechas, exportación, cruce intercompañía.")}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Payment Gateway Reports (13 pages)", "Informes de Pasarelas de Pago (13 páginas)")}</h4>
            <p>{t(lang, "Braintree Hub + 5 currencies + Transactions, Stripe + EUR/USD, GoCardless, PayPal, Pleo. Each with sync controls, fee breakdown, status history.", "Braintree Hub + 5 divisas + Transacciones, Stripe + EUR/USD, GoCardless, PayPal, Pleo. Cada uno con controles de sincronización, desglose de comisiones, historial de estados.")}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Sales Insights", "Análisis de Ventas")}</h4>
            <InfoTable
                headers={[t(lang, "Report", "Informe"), t(lang, "Key Metrics", "Métricas Clave")]}
                rows={[
                    [t(lang, "Clinic Analytics", "Análisis de Clínicas"), t(lang, "MRR, churn rate, lifecycle events, consecutive months, YTD revenue", "MRR, tasa de churn, eventos del ciclo de vida, meses consecutivos, ingresos YTD")],
                    [t(lang, "Lab Analysis", "Análisis Lab"), t(lang, "Revenue, quantities, avg ticket, product breakdown, Natural Restorations", "Ingresos, cantidades, ticket medio, desglose de productos, Natural Restorations")],
                    [t(lang, "DSD Courses", "Cursos DSD"), t(lang, "Course revenue by FA 101.x", "Ingresos por curso por FA 101.x")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">AR / AP</h4>
            <p>{t(lang, "AR: Overview KPIs, Invoice Orders browser, Web Orders, Insights, Customer/Product master data. AP: Overview, Invoices (25+ columns, splitting), Insights, Provider/FA/Cost Center master data.", "CC: KPIs resumen, explorador de Pedidos de Factura, Pedidos Web, Insights, datos maestros de Clientes/Productos. CP: Resumen, Facturas (25+ columnas, división), Insights, datos maestros de Proveedores/FA/Centro de Coste.")}</p>
        </>
    );
}

/* ------------------------------------------------------------------ */
/*  Flow Diagram Components                                            */
/* ------------------------------------------------------------------ */

function FlowStep({ icon, title, subtitle, color = "orange" }: { icon: React.ReactNode; title: string; subtitle?: string; color?: string }) {
    const colors: Record<string, string> = {
        orange: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
        blue: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
        green: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
        purple: "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30",
    };
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[color] || colors.orange}`}>
            <span className="text-gray-500 dark:text-gray-400">{icon}</span>
            <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">{title}</p>
                {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function FlowArrow() {
    return (
        <div className="flex justify-center py-1">
            <ArrowDown size={18} className="text-gray-400" />
        </div>
    );
}

function FlowDiagram({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="my-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
            {title && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{title}</p>}
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function VideoPlaceholder({ titleEN, titleES, lang }: { titleEN: string; titleES: string; lang: Lang }) {
    return (
        <div className="my-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-6 flex flex-col items-center gap-2">
            <Play size={32} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t(lang, titleEN, titleES)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
                {t(lang, "Video coming soon", "Vídeo en breve")}
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  5.1 AR Reconciliation                                              */
/* ------------------------------------------------------------------ */

function ARReconciliation({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang,
                "Accounts Receivable reconciliation ensures every payment received in the bank is matched to the correct customer invoice. The system provides three manual workflows plus an automatic background process.",
                "La conciliación de Cuentas por Cobrar asegura que cada pago recibido en el banco se empareja con la factura correcta del cliente. El sistema ofrece tres flujos manuales más un proceso automático en segundo plano."
            )}</p>

            {/* Flow 1: Bank Match */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Flow 1: Bank Match (Invoice Orders)", "Flujo 1: Bank Match (Pedidos de Factura)")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                'Navigate to AR → Invoice Orders, select a bank account and date range, then click the "Bank Match" button. The system runs a dry-run preview before applying any changes.',
                'Navegue a CC → Pedidos de Factura, seleccione una cuenta bancaria y rango de fechas, luego haga clic en el botón "Bank Match". El sistema ejecuta una vista previa antes de aplicar cambios.'
            )}</p>
            <FlowDiagram title={t(lang, "Bank Match Flow", "Flujo Bank Match")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Select bank account + date range", "1. Seleccionar cuenta bancaria + rango de fechas")} subtitle={t(lang, "Filter unreconciled credits from bank statement", "Filtrar créditos no conciliados del extracto bancario")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<MousePointerClick size={16} />} title={t(lang, '2. Click "Bank Match" button', '2. Clic en botón "Bank Match"')} subtitle={t(lang, "System runs dry-run preview — no changes yet", "El sistema ejecuta vista previa — sin cambios aún")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Eye size={16} />} title={t(lang, "3. Review match proposals", "3. Revisar propuestas de emparejamiento")} subtitle={t(lang, "Each proposal shows: bank amount, invoice amount, date distance, confidence score", "Cada propuesta muestra: importe banco, importe factura, distancia de fechas, puntuación de confianza")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, '4. Confirm matches → status updates to "Reconciled"', '4. Confirmar coincidencias → estado se actualiza a "Conciliado"')} subtitle={t(lang, "Both bank row and AR invoice are linked with matched_with ID", "Tanto la fila del banco como la factura CC se vinculan con ID matched_with")} color="green" />
            </FlowDiagram>
            <VideoPlaceholder titleEN="Bank Match walkthrough" titleES="Recorrido por Bank Match" lang={lang} />

            {/* Flow 2: Settlement Batch */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Flow 2: Settlement Batch Matching", "Flujo 2: Emparejamiento por Lote de Liquidación")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                "Payment gateways (Braintree, Stripe, GoCardless) deposit funds as settlement batches. A single bank credit may contain dozens of transactions. This flow reveals the individual payments inside each batch.",
                "Las pasarelas de pago (Braintree, Stripe, GoCardless) depositan fondos como lotes de liquidación. Un único crédito bancario puede contener decenas de transacciones. Este flujo revela los pagos individuales dentro de cada lote."
            )}</p>
            <FlowDiagram title={t(lang, "Settlement Batch Flow", "Flujo Lote de Liquidación")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Open bank statement → identify gateway deposit (color badge)", "1. Abrir extracto bancario → identificar depósito de pasarela (badge de color)")} subtitle={t(lang, "Braintree = purple, Stripe = blue, GoCardless = teal", "Braintree = morado, Stripe = azul, GoCardless = verde azulado")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Link2 size={16} />} title={t(lang, "2. Click badge → expand settlement batch details", "2. Clic en badge → expandir detalles del lote de liquidación")} subtitle={t(lang, "Shows all individual transactions in the batch with amounts and statuses", "Muestra todas las transacciones individuales del lote con importes y estados")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<Eye size={16} />} title={t(lang, "3. Review each transaction → verify amounts and dates", "3. Revisar cada transacción → verificar importes y fechas")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "4. Toggle reconciled per transaction or mark batch as reconciled", "4. Activar conciliación por transacción o marcar lote como conciliado")} color="green" />
            </FlowDiagram>

            {/* Flow 3: Smart Disbursement Chain */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Flow 3: Smart Disbursement Chain", "Flujo 3: Cadena Inteligente de Desembolsos")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                "The most powerful AR flow. When a bank credit is identified as a gateway deposit, the system traces the full chain via the gateway API: bank → settlement batch → individual transactions → linked AR invoices. Provides end-to-end visibility from bank statement to customer invoice.",
                "El flujo CC más potente. Cuando un crédito bancario se identifica como depósito de pasarela, el sistema rastrea la cadena completa vía API de la pasarela: banco → lote de liquidación → transacciones individuales → facturas CC vinculadas. Proporciona visibilidad extremo a extremo."
            )}</p>
            <FlowDiagram title={t(lang, "Smart Disbursement Chain", "Cadena Inteligente de Desembolsos")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Bank credit with gateway badge detected", "1. Crédito bancario con badge de pasarela detectado")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Zap size={16} />} title={t(lang, "2. System calls gateway API (e.g., Braintree settlementBatchSummary)", "2. Sistema llama API de la pasarela (ej: Braintree settlementBatchSummary)")} subtitle={t(lang, "Fetches batch details + individual disbursement transactions", "Obtiene detalles del lote + transacciones de desembolso individuales")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<Link2 size={16} />} title={t(lang, "3. Each transaction linked to AR invoice via Order ID", "3. Cada transacción vinculada a factura CC vía Order ID")} subtitle={t(lang, "Automatically creates matched_with references in both directions", "Crea automáticamente referencias matched_with en ambas direcciones")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "4. Full chain reconciled: Bank ↔ Batch ↔ Transactions ↔ AR Invoices", "4. Cadena completa conciliada: Banco ↔ Lote ↔ Transacciones ↔ Facturas CC")} color="green" />
            </FlowDiagram>
            <VideoPlaceholder titleEN="Smart Disbursement Chain demo" titleES="Demo de Cadena Inteligente de Desembolsos" lang={lang} />

            {/* Auto-reconciliation (brief) */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="green">{t(lang, "Auto-Reconciliation (Background)", "Auto-Conciliación (Segundo Plano)")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                "The system also runs automatic matching in the background using a 3-level hierarchy. This complements the manual flows above — it handles high-confidence matches so you can focus on exceptions.",
                "El sistema también ejecuta emparejamiento automático en segundo plano usando una jerarquía de 3 niveles. Complementa los flujos manuales — gestiona coincidencias de alta confianza para que puedas enfocarte en excepciones."
            )}</p>
            <InfoTable
                headers={[t(lang, "Level", "Nivel"), t(lang, "Criteria", "Criterios"), t(lang, "Confidence", "Confianza")]}
                rows={[
                    [t(lang, "1 — Order ID", "1 — Order ID"), t(lang, "Exact Order ID match between bank and invoice", "Coincidencia exacta de Order ID entre banco y factura"), "100%"],
                    [t(lang, "2 — Email + Amount", "2 — Email + Importe"), t(lang, "Same email + amount ±€1 + date ±30 days", "Mismo email + importe ±€1 + fecha ±30 días"), "85%"],
                    [t(lang, "3 — Domain + Amount", "3 — Dominio + Importe"), t(lang, "Same email domain + amount ±€1 + date ±3 days", "Mismo dominio de email + importe ±€1 + fecha ±3 días"), "70%"],
                ]}
            />

            {/* Reconciliation fields */}
            <h4 className="font-semibold mt-5 mb-2">{t(lang, "Reconciliation Fields (per row)", "Campos de Conciliación (por fila)")}</h4>
            <InfoTable
                headers={[t(lang, "Field", "Campo"), t(lang, "Type", "Tipo"), t(lang, "Description", "Descripción")]}
                rows={[
                    ["reconciled", "Boolean", t(lang, "Whether matched successfully", "Si se emparejó correctamente")],
                    ["matched_with", "String", t(lang, "ID of the matched row", "ID de la fila emparejada")],
                    ["matched_source", "String", t(lang, "Source of matched row (e.g., braintree-eur)", "Fuente de la fila emparejada (ej: braintree-eur)")],
                    ["match_confidence", "Number", t(lang, "Score 0–1 (1 = certain)", "Puntuación 0–1 (1 = seguro)")],
                    ["match_details", "JSON", t(lang, "Breakdown of match criteria used", "Desglose de los criterios de emparejamiento usados")],
                ]}
            />
        </>
    );
}

/* ------------------------------------------------------------------ */
/*  5.2 AP Reconciliation                                              */
/* ------------------------------------------------------------------ */

function APReconciliation({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang,
                "Accounts Payable reconciliation matches bank debits (outgoing payments) to supplier invoices and revenue-related orders. The system supports two main manual flows.",
                "La conciliación de Cuentas por Pagar empareja débitos bancarios (pagos salientes) con facturas de proveedores y pedidos de ingresos. El sistema soporta dos flujos manuales principales."
            )}</p>

            {/* Flow 1: Expense → AP Invoice */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Flow 1: Expense → AP Invoice Matching", "Flujo 1: Gasto → Emparejamiento con Factura CP")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                "For outgoing payments (bank debits), the system suggests matching AP invoices using fuzzy text matching on descriptions. The algorithm uses Sørensen-Dice similarity with a threshold of ≥60%.",
                "Para pagos salientes (débitos bancarios), el sistema sugiere facturas CP coincidentes usando coincidencia difusa de texto en las descripciones. El algoritmo usa similitud Sørensen-Dice con un umbral de ≥60%."
            )}</p>
            <FlowDiagram title={t(lang, "Expense → AP Invoice Flow", "Flujo Gasto → Factura CP")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Open bank statement → select a debit (outgoing payment)", "1. Abrir extracto bancario → seleccionar un débito (pago saliente)")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Receipt size={16} />} title={t(lang, '2. Click "Reconcile" → system searches AP invoices', '2. Clic en "Conciliar" → sistema busca facturas CP')} subtitle={t(lang, "Fuzzy matching: Sørensen-Dice ≥60% on provider name + description", "Coincidencia difusa: Sørensen-Dice ≥60% en nombre proveedor + descripción")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Eye size={16} />} title={t(lang, "3. Review suggestions ranked by similarity score", "3. Revisar sugerencias ordenadas por puntuación de similitud")} subtitle={t(lang, "Each shows: provider, amount, date, similarity %, invoice number", "Cada una muestra: proveedor, importe, fecha, % similitud, número de factura")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "4. Select correct match → link bank debit to AP invoice", "4. Seleccionar coincidencia correcta → vincular débito bancario a factura CP")} color="green" />
            </FlowDiagram>
            <VideoPlaceholder titleEN="Expense to AP Invoice matching" titleES="Emparejamiento de Gasto con Factura CP" lang={lang} />

            {/* Flow 2: Revenue Order Matching */}
            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Flow 2: Revenue → Web Orders (P&L + Installments)", "Flujo 2: Ingreso → Pedidos Web (P&L + Cuotas)")}</Badge>
            </h4>
            <p className="text-sm mb-2">{t(lang,
                "For bank credits identified as revenue, this flow opens a P&L classification popup where you assign the payment to an income account, handle installment plans, and optionally create a fee invoice for gateway commissions.",
                "Para créditos bancarios identificados como ingresos, este flujo abre un popup de clasificación P&L donde asigna el pago a una cuenta de ingresos, gestiona planes de cuotas, y opcionalmente crea una factura de comisión por la pasarela."
            )}</p>
            <FlowDiagram title={t(lang, "Revenue → Web Order Flow", "Flujo Ingreso → Pedido Web")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Bank credit identified as revenue (not a gateway batch)", "1. Crédito bancario identificado como ingreso (no lote de pasarela)")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<MousePointerClick size={16} />} title={t(lang, '2. Click "Revenue Match" → P&L Classification Popup opens', '2. Clic en "Revenue Match" → se abre Popup de Clasificación P&L')} subtitle={t(lang, "Select Financial Account (income code), description, notes", "Seleccionar Cuenta Financiera (código de ingresos), descripción, notas")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CreditCard size={16} />} title={t(lang, "3. Installment handling (if applicable)", "3. Gestión de cuotas (si aplica)")} subtitle={t(lang, "Split payment across multiple months: define # installments, start date", "Dividir pago en varios meses: definir nº cuotas, fecha inicio")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<Receipt size={16} />} title={t(lang, "4. Fee invoice creation (optional)", "4. Creación de factura de comisión (opcional)")} subtitle={t(lang, "Auto-generate AP invoice for gateway fees (Braintree ~2.4%, Stripe ~1.4%)", "Auto-generar factura CP para comisiones de pasarela (Braintree ~2.4%, Stripe ~1.4%)")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "5. Confirm → bank credit reconciled + AR invoice created/linked", "5. Confirmar → crédito bancario conciliado + factura CC creada/vinculada")} color="green" />
            </FlowDiagram>
            <VideoPlaceholder titleEN="Revenue reconciliation with P&L popup" titleES="Conciliación de ingresos con popup P&L" lang={lang} />

            {/* Matching thresholds */}
            <h4 className="font-semibold mt-5 mb-2">{t(lang, "AP Matching Thresholds", "Umbrales de Emparejamiento CP")}</h4>
            <InfoTable
                headers={[t(lang, "Parameter", "Parámetro"), t(lang, "Value", "Valor"), t(lang, "Notes", "Notas")]}
                rows={[
                    [t(lang, "Text Similarity", "Similitud Texto"), "≥ 60% (Sørensen-Dice)", t(lang, "Provider name + description vs bank description", "Nombre proveedor + descripción vs descripción banco")],
                    [t(lang, "Amount Tolerance", "Tolerancia Importe"), "±€0.01", t(lang, "Exact match after rounding", "Coincidencia exacta tras redondeo")],
                    [t(lang, "Date Window", "Ventana Fechas"), t(lang, "±3 calendar days", "±3 días naturales"), t(lang, "Extended to ±5 days for cross-border transfers", "Se extiende a ±5 días para transferencias internacionales")],
                ]}
            />

            {/* Data freshness */}
            <h4 className="font-semibold mt-5 mb-2">{t(lang, "Data Freshness Monitoring", "Monitorización de Frescura de Datos")}</h4>
            <div className="flex flex-wrap gap-3 my-2">
                {[
                    { color: "bg-green-500", label: t(lang, "≤ 2 days — Fresh", "≤ 2 días — Fresco") },
                    { color: "bg-yellow-500", label: t(lang, "≤ 4 days — Slightly Stale", "≤ 4 días — Ligeramente Antiguo") },
                    { color: "bg-orange-500", label: t(lang, "≤ 7 days — Attention", "≤ 7 días — Atención") },
                    { color: "bg-red-500", label: t(lang, "> 7 days — Action Required", "> 7 días — Acción Requerida") },
                ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded-full ${b.color}`} />
                        {b.label}
                    </div>
                ))}
            </div>
        </>
    );
}

/* ------------------------------------------------------------------ */
/*  5.3 Intercompany Reconciliation                                    */
/* ------------------------------------------------------------------ */

function IntercompanyReconciliation({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang,
                "Intercompany reconciliation matches transactions between different bank accounts of the same organization (e.g., EUR account → USD account transfers). Critical for multi-entity businesses with cross-currency flows.",
                "La conciliación intercompañía empareja transacciones entre diferentes cuentas bancarias de la misma organización (ej: transferencias cuenta EUR → cuenta USD). Crucial para empresas multi-entidad con flujos multi-divisa."
            )}</p>

            <h4 className="font-semibold mt-5 mb-2">
                <Badge color="blue">{t(lang, "Manual Intercompany Flow", "Flujo Intercompañía Manual")}</Badge>
            </h4>
            <FlowDiagram title={t(lang, "Intercompany Matching Flow", "Flujo de Emparejamiento Intercompañía")}>
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "1. Open bank statement → identify intercompany transfer (debit)", "1. Abrir extracto bancario → identificar transferencia intercompañía (débito)")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<ArrowLeftRight size={16} />} title={t(lang, '2. Click "Intercompany" → system searches other bank accounts', '2. Clic en "Intercompañía" → sistema busca en otras cuentas bancarias')} subtitle={t(lang, "Looks for matching credit in target bank account within date tolerance", "Busca crédito coincidente en cuenta bancaria destino dentro de la tolerancia de fechas")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Eye size={16} />} title={t(lang, "3. Review proposed match: source debit ↔ target credit", "3. Revisar coincidencia propuesta: débito origen ↔ crédito destino")} subtitle={t(lang, "Verify: amount (after FX if applicable), dates, description", "Verificar: importe (tras cambio divisa si aplica), fechas, descripción")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "4. Confirm → both rows marked reconciled with cross-reference IDs", "4. Confirmar → ambas filas marcadas conciliadas con IDs de referencia cruzada")} color="green" />
            </FlowDiagram>
            <VideoPlaceholder titleEN="Intercompany reconciliation demo" titleES="Demo de conciliación intercompañía" lang={lang} />

            <h4 className="font-semibold mt-5 mb-2">{t(lang, "Date Tolerance Rules", "Reglas de Tolerancia de Fechas")}</h4>
            <InfoTable
                headers={[t(lang, "Scenario", "Escenario"), t(lang, "Tolerance", "Tolerancia"), t(lang, "Reason", "Razón")]}
                rows={[
                    [t(lang, "Same-bank transfer", "Transferencia mismo banco"), t(lang, "±1 calendar day", "±1 día natural"), t(lang, "Intraday or next-day settlement", "Liquidación intradía o al día siguiente")],
                    [t(lang, "Cross-bank (weekday)", "Inter-banco (día laboral)"), t(lang, "±3 calendar days", "±3 días naturales"), t(lang, "Standard SEPA/SWIFT processing", "Procesamiento estándar SEPA/SWIFT")],
                    [t(lang, "Cross-bank (weekend/holiday)", "Inter-banco (fin de semana/festivo)"), t(lang, "±5 calendar days", "±5 días naturales"), t(lang, "Weekend/holiday buffer added", "Buffer de fin de semana/festivo añadido")],
                ]}
            />

            <h4 className="font-semibold mt-5 mb-2">{t(lang, "Multi-Currency Handling", "Gestión Multi-Divisa")}</h4>
            <p className="text-sm">{t(lang,
                "When matching across currencies (e.g., EUR debit ↔ USD credit), the system uses the ECB reference rate for the transaction date ±2%. This accounts for bank exchange rate spreads. The FX rate used is logged in the match_details JSON field for audit purposes.",
                "Al emparejar entre divisas (ej: débito EUR ↔ crédito USD), el sistema usa el tipo de referencia BCE para la fecha de transacción ±2%. Esto tiene en cuenta los spreads de tipo de cambio bancario. El tipo FX usado se registra en el campo JSON match_details para auditoría."
            )}</p>
        </>
    );
}

function MasterDataSection({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang, "Master data must be populated before using AP invoices or advanced analytics.", "Los datos maestros deben estar rellenados antes de usar facturas CP o análisis avanzado.")}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Setup Order", "Orden de Configuración")}</h4>
            <InfoTable
                headers={["#", t(lang, "Data", "Datos"), t(lang, "Location", "Ubicación")]}
                rows={[
                    ["1", t(lang, "Financial Accounts (Chart of Accounts)", "Cuentas Financieras (Plan de Cuentas)"), "AP → Master Data → Financial Accounts"],
                    ["2", t(lang, "Cost Centers (Departments)", "Centros de Coste (Departamentos)"), "AP → Master Data → Departmental Accounts"],
                    ["3", t(lang, "Providers (Vendors)", "Proveedores"), "AP → Master Data → Providers"],
                    ["4", t(lang, "Bank Accounts", "Cuentas Bancarias"), "Cash Management → Bank Accounts"],
                    ["5", t(lang, "Products", "Productos"), "AR → Master Data → Products"],
                    ["6", t(lang, "Customers", "Clientes"), "AR → Master Data → Customers"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Revenue Account Structure", "Estructura de Cuentas de Ingresos")}</h4>
            <InfoTable
                headers={[t(lang, "Code Range", "Rango de Códigos"), t(lang, "Category", "Categoría"), t(lang, "Examples", "Ejemplos")]}
                rows={[
                    ["101.x", t(lang, "Growth (Education)", "Crecimiento (Educación)"), "Courses, Mastership, Memberships, Partnerships"],
                    ["102.x", t(lang, "Delight (Clinic Services)", "Delight (Servicios Clínicos)"), "Consultancies, Marketing Coaching"],
                    ["103.x", "Planning Center", "Smile Design, Prep Guide, Ortho Planning"],
                    ["104.x", t(lang, "LAB (Manufacturing)", "LAB (Fabricación)"), "Prosthesis, Crown, Veneer"],
                    ["105.x", t(lang, "Other Income", "Otros Ingresos"), "Subscriptions, Licensing"],
                ]}
            />
        </>
    );
}

function SettingsAdmin({ lang }: { lang: Lang }) {
    return (
        <>
            <InfoTable
                headers={[t(lang, "Page", "Página"), t(lang, "Purpose", "Propósito")]}
                rows={[
                    [t(lang, "Profile", "Perfil"), t(lang, "User name, avatar, preferences", "Nombre de usuario, avatar, preferencias")],
                    [t(lang, "Security", "Seguridad"), t(lang, "Password, 2FA, active sessions", "Contraseña, 2FA, sesiones activas")],
                    [t(lang, "Users", "Usuarios"), t(lang, "Create, deactivate, assign roles", "Crear, desactivar, asignar roles")],
                    [t(lang, "Roles & Permissions", "Roles y Permisos"), t(lang, "Permission configuration", "Configuración de permisos")],
                    [t(lang, "Notifications", "Notificaciones"), t(lang, "Alert preferences", "Preferencias de alertas")],
                    [t(lang, "Integrations", "Integraciones"), t(lang, "External service connections (Braintree, Stripe, QuickBooks, HubSpot)", "Conexiones de servicios externos (Braintree, Stripe, QuickBooks, HubSpot)")],
                    [t(lang, "System", "Sistema"), t(lang, "Company name, timezone, language, date/currency formats", "Nombre de empresa, zona horaria, idioma, formatos de fecha/divisa")],
                    [t(lang, "Audit Log", "Registro de Auditoría"), t(lang, "Complete trail of all system actions", "Registro completo de todas las acciones del sistema")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Initial Setup Checklist", "Lista de Verificación Inicial")}</h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>{t(lang, "Create admin user account", "Crear cuenta de usuario administrador")}</li>
                <li>{t(lang, "Configure company settings (timezone, language, formats)", "Configurar ajustes de empresa (zona horaria, idioma, formatos)")}</li>
                <li>{t(lang, "Set up Financial Accounts + Cost Centers", "Configurar Cuentas Financieras + Centros de Coste")}</li>
                <li>{t(lang, "Add Providers/Vendors + Bank Accounts", "Añadir Proveedores + Cuentas Bancarias")}</li>
                <li>{t(lang, "Configure API integrations (Braintree, Stripe, etc.)", "Configurar integraciones API (Braintree, Stripe, etc.)")}</li>
                <li>{t(lang, "Import first bank statement", "Importar primer extracto bancario")}</li>
                <li>{t(lang, "Sync first payment gateway", "Sincronizar primera pasarela de pago")}</li>
                <li>{t(lang, "Enter first AP invoice or upload first Invoice Order CSV", "Introducir primera factura CP o subir primer CSV de Pedidos de Factura")}</li>
            </ol>
        </>
    );
}

function TechSpecs({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">{t(lang, "Database Schema (Key Tables)", "Esquema de Base de Datos (Tablas Principales)")}</h4>
            <InfoTable
                headers={[t(lang, "Table", "Tabla"), t(lang, "Purpose", "Propósito"), t(lang, "Scale", "Escala")]}
                rows={[
                    ["csv_rows", t(lang, "All imported transactions (unified)", "Todas las transacciones importadas (unificadas)"), "30,000+ rows"],
                    ["invoices", t(lang, "Accounts Payable", "Cuentas por Pagar"), "5,000+"],
                    ["ar_invoices", t(lang, "Accounts Receivable", "Cuentas por Cobrar"), "10,000+"],
                    ["providers / customers", t(lang, "Master data", "Datos maestros"), "200+ / 2,000+"],
                    ["financial_accounts / cost_centers", t(lang, "Chart of Accounts / Departments", "Plan de Cuentas / Departamentos"), "50+ / 20+"],
                    ["ws_projects / ws_tasks", "Workstream PM", "50+ / 500+"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Security", "Seguridad")}</h4>
            <InfoTable
                headers={[t(lang, "Feature", "Característica"), t(lang, "Implementation", "Implementación")]}
                rows={[
                    [t(lang, "Authentication", "Autenticación"), "Supabase Auth with PKCE flow"],
                    [t(lang, "Authorization", "Autorización"), "Row Level Security (RLS) on all tables"],
                    [t(lang, "API Security", "Seguridad API"), t(lang, "Service role key (server-only), anon key (client-side)", "Clave de rol de servicio (solo servidor), clave anon (lado cliente)")],
                    [t(lang, "Data Isolation", "Aislamiento de Datos"), t(lang, "Multi-scope filtering (ES/US/GLOBAL)", "Filtrado multi-scope (ES/US/GLOBAL)")],
                    ["Webhooks", t(lang, "Signature verification (Braintree)", "Verificación de firma (Braintree)")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Multi-Currency & Multi-Entity", "Multi-Divisa y Multi-Entidad")}</h4>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="font-medium text-sm">{t(lang, "Currencies", "Divisas")}</p>
                    <p className="text-sm text-gray-500">EUR (Bankinter, Sabadell, Braintree, Stripe, GoCardless, PayPal)</p>
                    <p className="text-sm text-gray-500">USD (Bankinter, Chase, Braintree, Stripe)</p>
                    <p className="text-sm text-gray-500">GBP, AUD (Braintree only)</p>
                </div>
                <div>
                    <p className="font-medium text-sm">{t(lang, "Entity Scopes", "Ámbitos de Entidad")}</p>
                    <p className="text-sm text-gray-500">ES — {t(lang, "Spanish operations", "Operaciones España")}</p>
                    <p className="text-sm text-gray-500">US — {t(lang, "US operations", "Operaciones EE.UU.")}</p>
                    <p className="text-sm text-gray-500">GLOBAL — {t(lang, "Combined view", "Vista combinada")}</p>
                </div>
            </div>
        </>
    );
}

function QuickReference({ lang }: { lang: Lang }) {
    return (
        <InfoTable
            headers={[t(lang, "Feature", "Funcionalidad"), t(lang, "What User Must Have Ready", "Lo que el Usuario Debe Tener Preparado")]}
            rows={[
                [t(lang, "Bank Import (Bankinter)", "Importación Bancaria (Bankinter)"), "XLSX from portal: FECHA VALOR, DESCRIPCIÓN, DEBE/HABER"],
                [t(lang, "Bank Import (Sabadell)", "Importación Bancaria (Sabadell)"), "CSV (semicolon): FECHA, CONCEPTO, MOVIMIENTO"],
                [t(lang, "Bank Import (Chase)", "Importación Bancaria (Chase)"), "CSV: POSTING DATE, DESCRIPTION, AMOUNT"],
                ["Braintree CSV", t(lang, "Transaction Search CSV from Control Panel", "CSV de búsqueda de transacciones del Panel de Control")],
                ["Braintree API", t(lang, "Merchant ID + public/private keys configured", "Merchant ID + claves pública/privada configuradas")],
                ["Stripe", "STRIPE_SECRET_KEY configured"],
                ["GoCardless", t(lang, "Access token configured", "Token de acceso configurado")],
                [t(lang, "Invoice Orders", "Pedidos de Factura"), t(lang, "CSV/XLSX: ID/NUMBER, DATE, TOTAL (+ optional CLIENT, EMAIL, ORDER)", "CSV/XLSX: ID/NUMBER, DATE, TOTAL (+ opcional CLIENT, EMAIL, ORDER)")],
                ["HubSpot Sync", t(lang, "SQL Server DW connection configured", "Conexión SQL Server DW configurada")],
                ["QuickBooks", t(lang, "OAuth completed (client ID, secret, realm ID)", "OAuth completado (client ID, secret, realm ID)")],
                [t(lang, "AP Invoices", "Facturas CP"), t(lang, "Master data first: providers, FA, cost centers, bank accounts", "Primero datos maestros: proveedores, FA, centros de coste, cuentas bancarias")],
                [t(lang, "Reconciliation", "Conciliación"), t(lang, "Both sides loaded: bank statement + gateway/invoice data", "Ambos lados cargados: extracto bancario + datos de pasarela/factura")],
                [t(lang, "P&L Report", "Informe P&L"), t(lang, "AP invoices (expenses) + AR data (revenue) imported", "Facturas CP (gastos) + datos CC (ingresos) importados")],
            ]}
        />
    );
}

function GuidedToursSection({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang,
                "The system includes interactive guided tours that highlight key UI elements and explain workflows step by step. Tours are available in English and Spanish.",
                "El sistema incluye tours guiados interactivos que resaltan elementos clave de la interfaz y explican los flujos de trabajo paso a paso. Los tours están disponibles en inglés y español."
            )}</p>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "How to Start a Tour", "Cómo Iniciar un Tour")}</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>{t(lang, "Click the compass icon (🧭) in the top header bar", "Haz clic en el icono de brújula (🧭) en la barra superior")}</li>
                <li>{t(lang, "Choose a tour from the dropdown — available tours depend on which page you're on", "Elige un tour del desplegable — los tours disponibles dependen de la página en la que estés")}</li>
                <li>{t(lang, 'Follow the highlighted steps. Click "Next" to advance or "X" to exit at any time', 'Sigue los pasos resaltados. Haz clic en "Siguiente" para avanzar o "X" para salir en cualquier momento')}</li>
            </ol>

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Available Tours", "Tours Disponibles")}</h4>
            <InfoTable
                headers={[t(lang, "Tour", "Tour"), t(lang, "Available On", "Disponible En"), t(lang, "What You'll Learn", "Lo que Aprenderás")]}
                rows={[
                    [t(lang, "Welcome Tour", "Tour de Bienvenida"), t(lang, "Any page", "Cualquier página"), t(lang, "Main interface: navigation, scope selector, search, data freshness, notifications", "Interfaz principal: navegación, selector de ámbito, búsqueda, frescura de datos, notificaciones")],
                    [t(lang, "Bank Statement Import", "Importación de Extractos"), t(lang, "Bank Statements page", "Página de Extractos Bancarios"), t(lang, "Upload CSV, filter dates, use 5 reconciliation modes", "Subir CSV, filtrar fechas, usar 5 modos de conciliación")],
                    [t(lang, "Payment Gateway Sync", "Sinc. Pasarelas de Pago"), t(lang, "Braintree hub page", "Página hub de Braintree"), t(lang, "Sync data, review settlement batches, understand gateway stats", "Sincronizar datos, revisar lotes de liquidación, entender estadísticas de pasarela")],
                    [t(lang, "Invoice Orders (AR)", "Pedidos de Factura (CC)"), t(lang, "Invoice Orders page", "Página de Pedidos de Factura"), t(lang, "AR summary cards, Bank Match tool, invoice table with inline editing", "Tarjetas resumen CC, herramienta Bank Match, tabla de facturas con edición inline")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "First-Visit Banner", "Banner de Primera Visita")}</h4>
            <p className="text-sm">{t(lang,
                "When you visit the platform for the first time, a welcome banner appears at the bottom of the screen offering to start the Welcome Tour. You can start it immediately or dismiss it — the compass icon in the header is always available to launch tours later.",
                "Cuando visitas la plataforma por primera vez, un banner de bienvenida aparece en la parte inferior de la pantalla ofreciendo iniciar el Tour de Bienvenida. Puedes iniciarlo inmediatamente o descartarlo — el icono de brújula en la cabecera siempre está disponible para lanzar tours después."
            )}</p>
        </>
    );
}

/* ------------------------------------------------------------------ */
/*  7. End-to-End Data Flows                                           */
/* ------------------------------------------------------------------ */

function DataFlows({ lang }: { lang: Lang }) {
    return (
        <>
            <p>{t(lang,
                "This section details the complete data journeys through the system — from raw uploads to final reports. Each flow shows exactly which tables, APIs, and transformations are involved.",
                "Esta sección detalla los recorridos completos de datos a través del sistema — desde archivos crudos hasta informes finales. Cada flujo muestra exactamente qué tablas, APIs y transformaciones están involucradas."
            )}</p>

            {/* Flow 1: Revenue → P&L */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.1 Revenue → P&L Statement", "7.1 Ingresos → Estado de P&L")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "Revenue flows from payment gateways and invoice orders into the P&L report via financial account classification.",
                "Los ingresos fluyen desde pasarelas de pago y pedidos de facturación hacia el informe P&L a través de la clasificación por cuenta financiera."
            )}</p>
            <FlowDiagram title={t(lang, "Revenue → P&L Data Flow", "Flujo de Datos Ingresos → P&L")}>
                <FlowStep icon={<Upload size={16} />} title={t(lang, "1. Upload gateway CSVs (Braintree, Stripe, GoCardless)", "1. Subir CSVs de pasarelas (Braintree, Stripe, GoCardless)")} subtitle={t(lang, "Each gateway file uploaded via Reports → [gateway] page", "Cada archivo de pasarela subido vía Reportes → página de [pasarela]")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Database size={16} />} title={t(lang, "2. Parsed into csv_rows (source='braintree-eur', etc.)", "2. Parseado a csv_rows (source='braintree-eur', etc.)")} subtitle={t(lang, "Column mapping: date, description, amount + custom_data (order_id, customer)", "Mapeo columnas: date, description, amount + custom_data (order_id, customer)")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<FileText size={16} />} title={t(lang, "3. Invoice Orders link to financial_account_code", "3. Invoice Orders vinculan a financial_account_code")} subtitle={t(lang, "csv_rows (source='invoice-orders') provide FA code per order", "csv_rows (source='invoice-orders') proveen código FA por pedido")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Wallet size={16} />} title={t(lang, "4. /api/pnl/revenue aggregates by FA hierarchy", "4. /api/pnl/revenue agrega por jerarquía FA")} subtitle={t(lang, "Groups revenue by financial account tree (1xx codes)", "Agrupa ingresos por árbol de cuentas financieras (códigos 1xx)")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<BarChart3 size={16} />} title={t(lang, "5. P&L page displays Revenue − Expenses = Net Income", "5. Página P&L muestra Ingresos − Gastos = Resultado Neto")} subtitle={t(lang, "Combined with /api/pnl/expenses (invoices table, codes 4xx-6xx)", "Combinado con /api/pnl/expenses (tabla invoices, códigos 4xx-6xx)")} color="green" />
            </FlowDiagram>
            <InfoTable
                headers={[t(lang, "Data Source", "Fuente de Datos"), t(lang, "Table", "Tabla"), t(lang, "Role", "Rol")]}
                rows={[
                    [t(lang, "Gateway CSVs", "CSVs de Pasarelas"), "csv_rows", t(lang, "Transaction-level revenue data", "Datos de ingresos a nivel de transacción")],
                    [t(lang, "Invoice Orders", "Pedidos Facturación"), "csv_rows (source='invoice-orders')", t(lang, "Maps orders to financial accounts", "Mapea pedidos a cuentas financieras")],
                    [t(lang, "AP Invoices", "Facturas CP"), "invoices", t(lang, "Expense data with cost center allocation", "Datos de gastos con asignación de centro de coste")],
                    [t(lang, "Financial Accounts", "Cuentas Financieras"), "financial_accounts", t(lang, "Account hierarchy for P&L classification", "Jerarquía de cuentas para clasificación P&L")],
                ]}
            />

            {/* Flow 2: Bank Statement → Cashflow */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.2 Bank Statement → Cashflow", "7.2 Extracto Bancario → Flujo de Caja")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "Bank statements feed the three cashflow views: bank, real, and consolidated.",
                "Los extractos bancarios alimentan las tres vistas de flujo de caja: bancario, real y consolidado."
            )}</p>
            <FlowDiagram title={t(lang, "Bank → Cashflow Data Flow", "Flujo de Datos Banco → Cashflow")}>
                <FlowStep icon={<Upload size={16} />} title={t(lang, "1. Upload bank CSV (Bankinter, Sabadell, Chase)", "1. Subir CSV bancario (Bankinter, Sabadell, Chase)")} subtitle={t(lang, "European number format for Spanish banks, US format for Chase", "Formato numérico europeo para bancos españoles, formato US para Chase")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Database size={16} />} title={t(lang, "2. Parsed into csv_rows with source tag", "2. Parseado a csv_rows con etiqueta de fuente")} subtitle={t(lang, "date=FECHA VALOR, amount=HABER−DEBE, source='bankinter-eur'", "date=FECHA VALOR, amount=HABER−DEBE, source='bankinter-eur'")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<ArrowLeftRight size={16} />} title={t(lang, "3. Inflow/Outflow classification", "3. Clasificación Ingreso/Egreso")} subtitle={t(lang, "amount > 0 = inflow (credit), amount < 0 = outflow (debit)", "amount > 0 = ingreso (haber), amount < 0 = egreso (debe)")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<BarChart3 size={16} />} title={t(lang, "4. API aggregation → daily/monthly cashflow", "4. Agregación API → flujo de caja diario/mensual")} subtitle={t(lang, "/api/executive/cashflow/* endpoints consolidate all bank sources", "/api/executive/cashflow/* endpoints consolidan todas las fuentes bancarias")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<Globe size={16} />} title={t(lang, "5. Currency conversion → Consolidated view", "5. Conversión divisa → Vista Consolidada")} subtitle={t(lang, "EUR + USD accounts unified with exchange rate", "Cuentas EUR + USD unificadas con tipo de cambio")} color="green" />
            </FlowDiagram>

            {/* Flow 3: Web Orders → AR Reconciliation */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.3 Web Orders → AR Reconciliation", "7.3 Pedidos Web → Conciliación CC")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "Web orders from HubSpot are linked to Braintree transactions, then matched against bank deposits for full reconciliation.",
                "Los pedidos web de HubSpot se vinculan a transacciones Braintree, luego se emparejan contra depósitos bancarios para conciliación completa."
            )}</p>
            <FlowDiagram title={t(lang, "Web Order → Bank Reconciliation Chain", "Cadena Pedido Web → Conciliación Bancaria")}>
                <FlowStep icon={<ShoppingCart size={16} />} title={t(lang, "1. HubSpot deal created (order placed online)", "1. Deal HubSpot creado (pedido online)")} subtitle={t(lang, "Contains order_id, customer, deal_amount, braintree_transaction_ids", "Contiene order_id, customer, deal_amount, braintree_transaction_ids")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Database size={16} />} title={t(lang, "2. HubSpot CSV uploaded → csv_rows (source='hubspot')", "2. CSV HubSpot subido → csv_rows (source='hubspot')")} subtitle={t(lang, "~50 fields stored in custom_data JSONB column", "~50 campos almacenados en columna JSONB custom_data")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Link2 size={16} />} title={t(lang, "3. Braintree transaction_ids link to gateway uploads", "3. Los transaction_ids de Braintree vinculan a subidas de pasarelas")} subtitle={t(lang, "csv_rows (source='hubspot').custom_data.braintree_transaction_ids → csv_rows (source='braintree-*')", "csv_rows (source='hubspot').custom_data.braintree_transaction_ids → csv_rows (source='braintree-*')")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<CreditCard size={16} />} title={t(lang, "4. Braintree settlement batches matched to bank deposits", "4. Lotes de liquidación Braintree emparejados con depósitos bancarios")} subtitle={t(lang, "Settlement amount ≈ bank credit (±€0.01) within ±3 days", "Monto liquidación ≈ crédito bancario (±€0.01) dentro de ±3 días")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<CheckCircle2 size={16} />} title={t(lang, "5. Full chain reconciled: Order → Payment → Bank", "5. Cadena completa conciliada: Pedido → Pago → Banco")} subtitle={t(lang, "reconciled=true, matched_with links both directions", "reconciled=true, matched_with vincula en ambas direcciones")} color="green" />
            </FlowDiagram>

            {/* Flow 4: AP Invoice → Departmental PnL */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.4 AP Invoice → Departmental P&L", "7.4 Factura CP → P&L Departamental")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "AP invoices are the sole source for expense tracking, linking through cost centers to produce departmental profit and loss reports.",
                "Las facturas CP son la única fuente de seguimiento de gastos, vinculándose a través de centros de coste para producir informes de P&L departamental."
            )}</p>
            <FlowDiagram title={t(lang, "AP → Dept P&L Data Flow", "Flujo AP → P&L Departamental")}>
                <FlowStep icon={<Receipt size={16} />} title={t(lang, "1. Enter invoice in AP → Invoices", "1. Ingresar factura en CP → Facturas")} subtitle={t(lang, "Provider, amount, date + cost_center + financial_account", "Proveedor, monto, fecha + cost_center + financial_account")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Database size={16} />} title={t(lang, "2. Stored in invoices table", "2. Almacenado en tabla invoices")} subtitle={t(lang, "Links to: providers, cost_centers, sub_departments, financial_accounts, bank_accounts", "Vinculado a: providers, cost_centers, sub_departments, financial_accounts, bank_accounts")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Users size={16} />} title={t(lang, "3. Grouped by cost_center → sub_department", "3. Agrupado por cost_center → sub_department")} subtitle={t(lang, "Each invoice contributes to its department's expense total", "Cada factura contribuye al total de gastos de su departamento")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<BarChart3 size={16} />} title={t(lang, "4. Departmental PnL calculates monthly comparison", "4. PnL Departamental calcula comparación mensual")} subtitle={t(lang, "Month-over-month, budget vs actual, drill-down by sub-department", "Mes a mes, presupuesto vs real, desglose por sub-departamento")} color="green" />
            </FlowDiagram>
            <InfoTable
                headers={[t(lang, "Master Data Table", "Tabla Datos Maestros"), t(lang, "Purpose", "Propósito")]}
                rows={[
                    ["providers", t(lang, "Supplier registry (name, NIF, payment terms)", "Registro proveedores (nombre, NIF, condiciones de pago)")],
                    ["cost_centers", t(lang, "Department-level cost groups", "Grupos de coste a nivel departamental")],
                    ["sub_departments", t(lang, "Granular breakdown within cost centers", "Desglose granular dentro de centros de coste")],
                    ["financial_accounts", t(lang, "Account chart (4xx-6xx = expenses)", "Plan contable (4xx-6xx = gastos)")],
                    ["bank_accounts", t(lang, "Payment bank details for scheduling", "Datos bancarios de pago para programación")],
                ]}
            />

            {/* Flow 5: Gateway CSV → Revenue Tracking */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.5 Gateway CSV → Revenue Tracking", "7.5 CSV Pasarela → Seguimiento de Ingresos")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "Each payment gateway has a dedicated upload flow that standardizes data into csv_rows for tracking and reconciliation.",
                "Cada pasarela de pago tiene un flujo de carga dedicado que estandariza datos en csv_rows para seguimiento y conciliación."
            )}</p>
            <FlowDiagram title={t(lang, "Gateway → Revenue Tracking", "Pasarela → Seguimiento de Ingresos")}>
                <FlowStep icon={<CreditCard size={16} />} title={t(lang, "1. Export settlement/payout report from gateway", "1. Exportar informe de liquidación/pago de pasarela")} subtitle={t(lang, "Braintree: Settlement Batch report | Stripe: Payout report | GoCardless: Payment export", "Braintree: Informe lote liquidación | Stripe: Informe payout | GoCardless: Exportación pagos")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Upload size={16} />} title={t(lang, "2. Upload via Reports → [Gateway] page", "2. Subir vía Reportes → página [Pasarela]")} subtitle={t(lang, "API route /api/csv/save validates format + inserts", "Ruta API /api/csv/save valida formato + inserta")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Database size={16} />} title={t(lang, "3. csv_rows created with source tag + custom_data", "3. csv_rows creados con etiqueta source + custom_data")} subtitle={t(lang, "custom_data: { settlement_batch_id, order_id, customer_name, ... }", "custom_data: { settlement_batch_id, order_id, customer_name, ... }")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<GitMerge size={16} />} title={t(lang, "4. Available for reconciliation matching", "4. Disponible para matching de conciliación")} subtitle={t(lang, "Reconciliation Center matches gateway rows ↔ bank rows", "Centro de Conciliación empareja filas pasarela ↔ filas banco")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<BarChart3 size={16} />} title={t(lang, "5. Revenue tracked in KPIs + Performance + P&L", "5. Ingresos rastreados en KPIs + Rendimiento + P&L")} color="green" />
            </FlowDiagram>
            <InfoTable
                headers={[t(lang, "Gateway", "Pasarela"), t(lang, "Source Tag", "Etiqueta Source"), t(lang, "Currencies", "Divisas")]}
                rows={[
                    ["Braintree", "braintree-eur, braintree-usd, braintree-gbp, braintree-aud, braintree-amex", "EUR, USD, GBP, AUD"],
                    ["Stripe", "stripe-eur, stripe-usd", "EUR, USD"],
                    ["GoCardless", "gocardless", "EUR"],
                    ["PayPal", "paypal", "EUR"],
                    ["Pleo", "pleo", "EUR"],
                ]}
            />

            {/* Flow 6: Products → Sales Insights */}
            <h4 className="font-semibold mt-6 mb-2">{t(lang, "7.6 Products → Sales Insights", "7.6 Productos → Insights de Ventas")}</h4>
            <p className="text-sm mb-2">{t(lang,
                "Invoice orders combined with product master data and PnL mappings produce segmented sales insights for clinics, lab, and courses.",
                "Los pedidos de facturación combinados con datos maestros de productos y mapeos PnL producen insights de ventas segmentados para clínicas, laboratorio y cursos."
            )}</p>
            <FlowDiagram title={t(lang, "Products → Sales Insights", "Productos → Insights de Ventas")}>
                <FlowStep icon={<FileText size={16} />} title={t(lang, "1. Invoice orders uploaded (source='invoice-orders')", "1. Pedidos facturación subidos (source='invoice-orders')")} subtitle={t(lang, "Each order has financial_account_code in custom_data", "Cada pedido tiene financial_account_code en custom_data")} color="blue" />
                <FlowArrow />
                <FlowStep icon={<Package size={16} />} title={t(lang, "2. Products linked via product_pnl_mappings", "2. Productos vinculados vía product_pnl_mappings")} subtitle={t(lang, "Maps product → financial_account → business segment", "Mapea producto → cuenta_financiera → segmento de negocio")} color="orange" />
                <FlowArrow />
                <FlowStep icon={<Building2 size={16} />} title={t(lang, "3. Segmentation by FA code range", "3. Segmentación por rango de código FA")} subtitle={t(lang, "102.x = Clinics | 104.x = Lab | Other = Courses/Training", "102.x = Clínicas | 104.x = Lab | Otro = Cursos/Formación")} color="purple" />
                <FlowArrow />
                <FlowStep icon={<BarChart3 size={16} />} title={t(lang, "4. Sales Insights pages show revenue breakdown", "4. Páginas Sales Insights muestran desglose de ingresos")} subtitle={t(lang, "Product-level, trend analysis, top performers per segment", "Por producto, análisis de tendencias, top performers por segmento")} color="green" />
            </FlowDiagram>
            <InfoTable
                headers={[t(lang, "Segment", "Segmento"), t(lang, "FA Code Range", "Rango Código FA"), t(lang, "Page", "Página")]}
                rows={[
                    [t(lang, "Clinics", "Clínicas"), "102.x", "/sales-insights/clinics"],
                    [t(lang, "Lab", "Laboratorio"), "104.x", "/sales-insights/lab"],
                    [t(lang, "Courses", "Cursos"), t(lang, "Other codes", "Otros códigos"), "/sales-insights/courses"],
                ]}
            />
        </>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ManualPage() {
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(["executive"]));
    const [searchQuery, setSearchQuery] = useState("");
    const [lang, setLang] = useState<Lang>("en");

    const sections: Section[] = [
        { id: "executive", title: t(lang, "1. Executive Summary", "1. Resumen Ejecutivo"), icon: <BookOpen size={18} />, content: <ExecutiveSummary lang={lang} /> },
        { id: "architecture", title: t(lang, "2. System Architecture", "2. Arquitectura del Sistema"), icon: <Server size={18} />, content: <SystemArchitecture lang={lang} /> },
        { id: "banks", title: t(lang, "3.1 Bank Statements", "3.1 Extractos Bancarios"), icon: <Building2 size={18} />, content: <BankStatements lang={lang} /> },
        { id: "gateways", title: t(lang, "3.2 Payment Gateways", "3.2 Pasarelas de Pago"), icon: <CreditCard size={18} />, content: <PaymentGateways lang={lang} /> },
        { id: "invoices", title: t(lang, "3.3 Invoice Orders (AR)", "3.3 Pedidos de Factura (CC)"), icon: <FileText size={18} />, content: <InvoiceOrders lang={lang} /> },
        { id: "weborders", title: t(lang, "3.4 Web Orders & CRM", "3.4 Pedidos Web y CRM"), icon: <ShoppingCart size={18} />, content: <WebOrdersCRM lang={lang} /> },
        { id: "ap", title: t(lang, "3.5 Accounts Payable", "3.5 Cuentas por Pagar"), icon: <Receipt size={18} />, content: <AccountsPayable lang={lang} /> },
        { id: "api", title: t(lang, "3.6 API Integrations", "3.6 Integraciones API"), icon: <Zap size={18} />, content: <APIIntegrations lang={lang} /> },
        { id: "reports", title: t(lang, "4. Reports & Dashboards", "4. Informes y Cuadros de Mando"), icon: <BarChart3 size={18} />, content: <ReportsSection lang={lang} /> },
        { id: "ar-recon", title: t(lang, "5.1 AR Reconciliation", "5.1 Conciliación de CC"), icon: <GitMerge size={18} />, content: <ARReconciliation lang={lang} /> },
        { id: "ap-recon", title: t(lang, "5.2 AP Reconciliation", "5.2 Conciliación de CP"), icon: <ArrowLeftRight size={18} />, content: <APReconciliation lang={lang} /> },
        { id: "ic-recon", title: t(lang, "5.3 Intercompany Reconciliation", "5.3 Conciliación Intercompañía"), icon: <Building2 size={18} />, content: <IntercompanyReconciliation lang={lang} /> },
        { id: "masterdata", title: t(lang, "6. Master Data Management", "6. Gestión de Datos Maestros"), icon: <Database size={18} />, content: <MasterDataSection lang={lang} /> },
        { id: "dataflows", title: t(lang, "7. End-to-End Data Flows", "7. Flujos de Datos End-to-End"), icon: <GitMerge size={18} />, content: <DataFlows lang={lang} /> },
        { id: "settings", title: t(lang, "9. Settings & Administration", "9. Configuración y Administración"), icon: <Settings size={18} />, content: <SettingsAdmin lang={lang} /> },
        { id: "tech", title: t(lang, "10. Technical Specifications", "10. Especificaciones Técnicas"), icon: <Server size={18} />, content: <TechSpecs lang={lang} /> },
        { id: "tours", title: t(lang, "11. Guided Tours", "11. Tours Guiados"), icon: <Compass size={18} />, content: <GuidedToursSection lang={lang} /> },
        { id: "quickref", title: t(lang, "Quick Reference — What to Prepare", "Referencia Rápida — Qué Preparar"), icon: <CheckCircle2 size={18} />, content: <QuickReference lang={lang} /> },
    ];

    const toggleSection = (id: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => setOpenSections(new Set(sections.map((s) => s.id)));
    const collapseAll = () => setOpenSections(new Set());

    const filteredSections = searchQuery.trim()
        ? sections.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : sections;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
            {/* Header */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                    <div className="flex items-center gap-3 mb-1">
                        <BookOpen size={28} className="text-orange-500" />
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t(lang, "Product Manual", "Manual del Producto")}</h1>
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
                            v2.0
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t(lang,
                            "Multi-Currency Financial Reconciliation & Reporting Platform — Complete reference guide",
                            "Plataforma de Conciliación Financiera Multi-Divisa y Reporting — Guía de referencia completa"
                        )}
                    </p>
                </div>
            </div>

            {/* Tools */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t(lang, "Search sections...", "Buscar secciones...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => setLang("en")}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${lang === "en" ? "bg-orange-500 text-white" : "hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400"}`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLang("es")}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${lang === "es" ? "bg-orange-500 text-white" : "hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400"}`}
                        >
                            ES
                        </button>
                    </div>
                    <button
                        onClick={expandAll}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        {t(lang, "Expand All", "Expandir Todo")}
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        {t(lang, "Collapse All", "Colapsar Todo")}
                    </button>
                </div>
            </div>

            {/* Sections */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 space-y-3">
                {filteredSections.map((section) => (
                    <ManualSection
                        key={section.id}
                        section={section}
                        isOpen={openSections.has(section.id)}
                        onToggle={() => toggleSection(section.id)}
                    />
                ))}

                {filteredSections.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {t(lang, `No sections match "${searchQuery}"`, `Ninguna sección coincide con "${searchQuery}"`)}
                    </div>
                )}
            </div>
        </div>
    );
}
