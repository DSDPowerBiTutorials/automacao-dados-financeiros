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

function ReconciliationEngine({ lang }: { lang: Lang }) {
    return (
        <>
            <h4 className="font-semibold mb-2">{t(lang, "Matching Rules", "Reglas de Emparejamiento")}</h4>
            <InfoTable
                headers={[t(lang, "Rule", "Regla"), t(lang, "Threshold", "Umbral"), t(lang, "Description", "Descripción")]}
                rows={[
                    [t(lang, "Date Proximity", "Proximidad de Fecha"), t(lang, "±3 calendar days", "±3 días naturales"), t(lang, "Transactions must fall within a 3-day window", "Las transacciones deben estar dentro de una ventana de 3 días")],
                    [t(lang, "Amount Matching", "Emparejamiento de Importe"), "±€0.01", t(lang, "Amounts must be within 1 cent", "Los importes deben estar dentro de 1 céntimo")],
                    [t(lang, "Cross-Source", "Cruce entre Fuentes"), t(lang, "Automatic", "Automático"), t(lang, "Bank ↔ Gateway ↔ Invoice ↔ CRM Deal", "Banco ↔ Pasarela ↔ Factura ↔ Deal CRM")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Reconciliation Fields (per row)", "Campos de Conciliación (por fila)")}</h4>
            <InfoTable
                headers={[t(lang, "Field", "Campo"), t(lang, "Type", "Tipo"), t(lang, "Description", "Descripción")]}
                rows={[
                    ["reconciled", "Boolean", t(lang, "Whether matched", "Si está emparejado")],
                    ["matched_with", "String", t(lang, "ID of matched row", "ID de la fila emparejada")],
                    ["matched_source", "String", t(lang, "Source of matched row", "Fuente de la fila emparejada")],
                    ["match_confidence", "Number", t(lang, "Score 0-1", "Puntuación 0-1")],
                    ["match_details", "JSON", t(lang, "Match criteria breakdown", "Desglose de criterios de emparejamiento")],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">{t(lang, "Data Freshness Monitoring", "Monitorización de Frescura de Datos")}</h4>
            <div className="flex flex-wrap gap-3 my-2">
                {[
                    { color: "bg-green-500", label: t(lang, "≤ 2 days — Fresh", "≤ 2 días — Fresco"), icon: <CheckCircle2 size={14} /> },
                    { color: "bg-yellow-500", label: t(lang, "≤ 4 days — Slightly Stale", "≤ 4 días — Ligeramente Antiguo"), icon: <AlertTriangle size={14} /> },
                    { color: "bg-orange-500", label: t(lang, "≤ 7 days — Attention", "≤ 7 días — Atención"), icon: <AlertTriangle size={14} /> },
                    { color: "bg-red-500", label: t(lang, "> 7 days — Action Required", "> 7 días — Acción Requerida"), icon: <Clock size={14} /> },
                ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded-full ${b.color}`} />
                        {b.label}
                    </div>
                ))}
            </div>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">{t(lang, "🔄 Workflow", "🔄 Flujo de Trabajo")}</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>{t(lang, "Import bank statement", "Importar extracto bancario")}</li>
                <li>{t(lang, "Import/sync corresponding payment gateway", "Importar/sincronizar la pasarela de pago correspondiente")}</li>
                <li>{t(lang, "Open bank report → system auto-detects gateway deposits with color badges", "Abrir informe bancario → el sistema auto-detecta depósitos de pasarelas con badges de color")}</li>
                <li>{t(lang, 'Click badge to expand matches → verify → toggle "Reconciled"', 'Clic en el badge para expandir coincidencias → verificar → activar "Conciliado"')}</li>
                <li>{t(lang, "Check Reconciliation Center for overall health", "Verificar el Centro de Conciliación para el estado general")}</li>
            </ol>
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
        { id: "reconciliation", title: t(lang, "5. Reconciliation Engine", "5. Motor de Conciliación"), icon: <GitMerge size={18} />, content: <ReconciliationEngine lang={lang} /> },
        { id: "masterdata", title: t(lang, "6. Master Data Management", "6. Gestión de Datos Maestros"), icon: <Database size={18} />, content: <MasterDataSection lang={lang} /> },
        { id: "settings", title: t(lang, "9. Settings & Administration", "9. Configuración y Administración"), icon: <Settings size={18} />, content: <SettingsAdmin lang={lang} /> },
        { id: "tech", title: t(lang, "10. Technical Specifications", "10. Especificaciones Técnicas"), icon: <Server size={18} />, content: <TechSpecs lang={lang} /> },
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
