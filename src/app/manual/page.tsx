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

function ExecutiveSummary() {
    return (
        <>
            <p>
                FinanceFlow is an end-to-end financial reconciliation platform purpose-built for multi-entity,
                multi-currency businesses. It ingests data from banks, payment gateways, CRMs, and accounting
                systems, then automatically matches and reconciles transactions across all sources.
            </p>
            <h4 className="font-semibold mt-4 mb-2">Core Capabilities</h4>
            <InfoTable
                headers={["Capability", "Description"]}
                rows={[
                    ["Multi-Bank Reconciliation", "Bankinter (EUR/USD), Sabadell (EUR), Chase (USD)"],
                    ["Payment Gateway Consolidation", "Braintree (5 currencies), Stripe (EUR/USD), GoCardless, PayPal, Pleo"],
                    ["Automated Matching", "±3 days date proximity + ±€0.01 amount matching"],
                    ["Multi-Currency", "EUR, USD, GBP, AUD with automatic exchange rate tracking"],
                    ["Accounts Payable", "Full invoice lifecycle from entry to bank reconciliation"],
                    ["Accounts Receivable", "Customer invoice management with payment tracking"],
                    ["Sales Analytics", "Clinic MRR/churn, Lab product analytics, lifetime analysis"],
                    ["CRM Integration", "HubSpot deal sync via SQL Server data warehouse"],
                    ["Accounting Integration", "QuickBooks Online sync (invoices, bills, payments, vendors)"],
                    ["Project Management", "Built-in Workstream module (Kanban, Timeline, Subtasks, Dependencies)"],
                ]}
            />
            <h4 className="font-semibold mt-4 mb-2">Who It&apos;s For</h4>
            <ul className="list-disc pl-5 space-y-1">
                <li>Finance teams managing multiple bank accounts and payment processors across countries</li>
                <li>Operations leaders tracking revenue, expenses, and cash flow in real time</li>
                <li>Companies with e-commerce selling through Braintree, Stripe, GoCardless, PayPal</li>
                <li>Multi-entity businesses operating in different countries (e.g., Spain + US)</li>
            </ul>
        </>
    );
}

function SystemArchitecture() {
    return (
        <>
            <h4 className="font-semibold mb-2">Technology Stack</h4>
            <InfoTable
                headers={["Layer", "Technology"]}
                rows={[
                    ["Frontend", "Next.js 14 (App Router), React, TypeScript, Tailwind CSS"],
                    ["UI Components", "shadcn/ui, Lucide icons"],
                    ["Database", "Supabase (PostgreSQL) with Row Level Security"],
                    ["File Storage", "Supabase Storage (CSV/XLSX uploads)"],
                    ["Authentication", "Supabase Auth (PKCE flow, session persistence)"],
                    ["Hosting", "Vercel (auto-deploy from Git)"],
                    ["External APIs", "Braintree SDK, Stripe API, GoCardless, QuickBooks OAuth, HubSpot SQL Server"],
                ]}
            />
            <h4 className="font-semibold mt-4 mb-2">Data Flow</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-3">
                {[
                    { label: "Input", desc: "Bank CSVs, Gateway CSVs, API Syncs, Manual Entry", icon: <Upload size={16} /> },
                    { label: "Normalize", desc: "EU/US number parsing, date ISO, currency detection, dedup", icon: <ArrowLeftRight size={16} /> },
                    { label: "Store", desc: "csv_rows, invoices, ar_invoices, master data tables", icon: <Database size={16} /> },
                    { label: "Report", desc: "Dashboard, Bank/Gateway Reports, P&L, Sales Insights", icon: <BarChart3 size={16} /> },
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

function BankStatements() {
    return (
        <>
            <p>Bank statements are the foundation of reconciliation. Each bank has a dedicated import handler.</p>

            <h4 className="font-semibold mt-4 mb-2">Supported Banks</h4>
            <InfoTable
                headers={["Bank", "Source ID", "Format", "Number Format"]}
                rows={[
                    ["Bankinter EUR", "bankinter-eur", "XLSX/XLS", "European (1.000,50)"],
                    ["Bankinter USD", "bankinter-usd", "XLSX/XLS", "European (1.000,50)"],
                    ["Sabadell EUR", "sabadell", "CSV (semicolon)", "European (1.000,50)"],
                    ["Chase USD", "chase-usd", "CSV (comma)", "US ($1,000.50)"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 User Must Provide</Badge>
            </h4>

            <p className="font-medium mt-3">Bankinter (EUR/USD):</p>
            <InfoTable
                headers={["Column", "Example", "Notes"]}
                rows={[
                    ["FECHA VALOR / FECHA CONTABLE", "15/03/2026", "Transaction date"],
                    ["DESCRIPCIÓN", "TRANSFERENCIA SEPA", "Description"],
                    ["DEBE (debit)", "1.250,00", "Money going OUT"],
                    ["HABER (credit)", "4.500,75", "Money coming IN"],
                ]}
            />
            <p className="text-xs text-gray-500 mb-3">Amount = HABER − DEBE. If IMPORTE column present, used directly.</p>

            <p className="font-medium mt-3">Sabadell:</p>
            <InfoTable
                headers={["Column", "Example"]}
                rows={[
                    ["FECHA", "15/03/2026"],
                    ["CONCEPTO / DESCRIPCION", "RECIBO DOMICILIADO"],
                    ["MOVIMIENTO / IMPORTE", "1.250,50"],
                ]}
            />

            <p className="font-medium mt-3">Chase USD:</p>
            <InfoTable
                headers={["Column", "Example"]}
                rows={[
                    ["POSTING DATE", "03/15/2026 (MM/DD/YYYY)"],
                    ["DESCRIPTION", "STRIPE TRANSFER"],
                    ["AMOUNT", "$1,250.75"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">🔄 Workflow</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Download statement from online banking (XLSX for Bankinter, CSV for Sabadell/Chase)</li>
                <li>Navigate to <strong>Cash Management → Bank Statements</strong> → select the bank tab</li>
                <li>Click &quot;Upload File&quot; → select your downloaded file</li>
                <li>Review parsed rows and verify totals → Click &quot;Save&quot;</li>
                <li>Check the corresponding report page (e.g., Reports → Bankinter EUR)</li>
            </ol>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="blue">📊 Feeds Into</Badge>
            </h4>
            <p>Bank report pages, Dashboard (cash flow), Cash Management (bank position), Reconciliation Center</p>
        </>
    );
}

function PaymentGateways() {
    return (
        <>
            <p>Payment gateway data can be imported via CSV upload or automated API sync.</p>

            <h4 className="font-semibold mt-4 mb-2">Supported Gateways</h4>
            <InfoTable
                headers={["Gateway", "Currencies", "Import Methods"]}
                rows={[
                    ["Braintree", "EUR, USD, GBP, AUD, AMEX", "CSV + API Sync"],
                    ["Stripe", "EUR, USD", "CSV + API Sync"],
                    ["GoCardless", "EUR (SEPA)", "API Sync only"],
                    ["PayPal", "EUR", "CSV upload"],
                    ["Pleo", "EUR", "API Sync"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 Braintree CSV Columns</Badge>
            </h4>
            <InfoTable
                headers={["Column", "Maps To"]}
                rows={[
                    ["Transaction ID", "transaction_id"],
                    ["Settlement Date", "date (primary)"],
                    ["Amount Submitted For Settlement", "amount"],
                    ["Service Fee", "Separate fee row"],
                    ["Customer First/Last Name", "customer_name"],
                    ["Customer Email", "customer_email"],
                    ["Order ID", "order_id (e-commerce link)"],
                    ["Settlement Batch ID", "Groups transactions in bank deposits"],
                    ["Merchant Account", "Currency detection (EUR/USD/GBP/AUD)"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 API Setup (one-time)</Badge>
            </h4>
            <InfoTable
                headers={["Integration", "Required Environment Variables"]}
                rows={[
                    ["Braintree", "BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY"],
                    ["Stripe", "STRIPE_SECRET_KEY"],
                    ["GoCardless", "GOCARDLESS_ACCESS_TOKEN, GOCARDLESS_ENVIRONMENT"],
                    ["Pleo", "PLEO_API_KEY"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">🔄 API Sync Workflow</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Navigate to the gateway report page (e.g., Reports → Braintree EUR)</li>
                <li>Click &quot;Sync&quot; button → choose date range or &quot;Days Back&quot;</li>
                <li>System automatically processes, deduplicates, and preserves reconciliation state</li>
            </ol>

            <p className="mt-3 text-sm"><strong>Key rules:</strong> Declined/voided/failed transactions skipped. Each Braintree transaction creates two rows (revenue + fee). Currency auto-detected from merchant account.</p>
        </>
    );
}

function InvoiceOrders() {
    return (
        <>
            <p>Invoice orders represent revenue transactions from the invoicing system (Craft Commerce, Chargebee, etc.).</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 Required Columns</Badge>
            </h4>
            <InfoTable
                headers={["Column", "Accepted Headers", "Example"]}
                rows={[
                    ["Invoice ID", "ID, NUMBER", "INV-2026-0001"],
                    ["Date", "INVOICE DATE, DATE, FECHA", "2026-03-15"],
                    ["Amount", "TOTAL, AMOUNT, VALOR", "1250.50"],
                ]}
            />

            <h4 className="font-semibold mt-3 mb-1">
                <Badge color="gray">Optional (enriched if present)</Badge>
            </h4>
            <InfoTable
                headers={["Column", "Headers", "Purpose"]}
                rows={[
                    ["Products", "PRODUCTS, DESCRIPTION", "FA classification + description"],
                    ["Order Number", "ORDER", "E-commerce cross-matching"],
                    ["Currency", "CURRENCY", "Defaults EUR if absent"],
                    ["Client", "CLIENT, COMPANY", "Customer identification"],
                    ["Email", "EMAIL", "Cross-matching with gateways"],
                    ["Country", "COUNTRY", "Geographic segmentation"],
                    ["Payment Method", "PAYMENT METHOD", "Braintree, Stripe, etc."],
                    ["Charged", "CHARGED", "Actual charged amount"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Automatic Financial Account Classification</h4>
            <InfoTable
                headers={["FA Account", "Code", "Matched Products"]}
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
                <Badge color="green">🔄 Workflow</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Export invoices as CSV/XLSX from invoicing system</li>
                <li>Navigate to <strong>Accounts Receivable → Invoice Orders</strong></li>
                <li>Click &quot;Upload CSV&quot; → select file → system shows column mapping preview</li>
                <li>System checks for duplicate invoice_numbers (DB + within file) → duplicates skipped</li>
                <li>Rows parsed, FA auto-classified, inserted with source = invoice-orders</li>
            </ol>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="blue">📊 Feeds Into</Badge>
            </h4>
            <p>AR Invoice Orders page, Braintree reports (cross-reference), Reconciliation Center, Sales Insights (Lab, Clinics), P&L revenue lines</p>
        </>
    );
}

function WebOrdersCRM() {
    return (
        <>
            <h4 className="font-semibold mb-2">HubSpot Deals (via SQL Server)</h4>
            <p>Fully automated sync — no file uploads needed. System connects to SQL Server data warehouse with replicated HubSpot data.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Extracts: deal name, close date, amount, currency, contact, products, order number</li>
                <li>Auto-classifies to Financial Accounts (101.x–105.x)</li>
                <li>Dedup: by deal_id (primary) + ecomm_order_number (secondary)</li>
                <li>Preserves reconciliation flags on update</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Craft Commerce (E-Commerce)</h4>
            <p>Upload full orders CSV from Craft CMS admin panel.</p>
            <InfoTable
                headers={["Key Column", "Description"]}
                rows={[
                    ["reference", "Order reference number"],
                    ["storedTotalPrice", "Total order value"],
                    ["email", "Customer email"],
                    ["gatewayId", "2 = Braintree, 3 = Stripe, 1 = Manual"],
                    ["couponCode", "Discount code applied"],
                ]}
            />
            <p className="mt-2 text-sm">System auto-classifies each order into deal status and payment status categories.</p>
        </>
    );
}

function AccountsPayable() {
    return (
        <>
            <p>AP invoices are entered manually through a comprehensive form interface tracking the full invoice lifecycle.</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 Required Fields (per invoice)</Badge>
            </h4>
            <InfoTable
                headers={["Field", "Required?", "Notes"]}
                rows={[
                    ["Invoice number", "Yes", "Unique identifier"],
                    ["Provider", "Yes", "From master data dropdown"],
                    ["Invoice date / Benefit date / Due date", "Yes", ""],
                    ["Amount + Currency", "Yes", ""],
                    ["Financial Account (GL code)", "Yes", "Chart of accounts"],
                    ["Cost Center", "Yes", "Department"],
                    ["Payment method / Bank account", "When paying", ""],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Invoice Types</h4>
            <InfoTable
                headers={["Type", "P&L Impact", "Cash Impact"]}
                rows={[
                    ["INCURRED — Standard expense", "Yes", "Yes"],
                    ["BUDGET — Forecast only", "No", "No"],
                    ["ADJUSTMENT — Cash correction", "No", "Yes"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Invoice Splitting</h4>
            <p>Invoices can be split by installment, FA allocation, cost center, or departmental type. Parent-child relationships maintained.</p>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 Master Data Required First</Badge>
            </h4>
            <ul className="list-disc pl-5 space-y-1">
                <li>Providers (at least one vendor)</li>
                <li>Financial Accounts (chart of accounts populated)</li>
                <li>Cost Centers (at least one department)</li>
                <li>Bank Accounts (at least one for payment recording)</li>
            </ul>
        </>
    );
}

function APIIntegrations() {
    return (
        <>
            <h4 className="font-semibold mb-2">QuickBooks Online</h4>
            <p>OAuth 2.0 authentication — user authorizes once, tokens auto-refresh.</p>

            <InfoTable
                headers={["Sync Type", "Source ID", "Content"]}
                rows={[
                    ["Invoices", "quickbooks-invoices", "Customer invoices, due dates, line items"],
                    ["Payments", "quickbooks-payments", "Payment receipts, methods, references"],
                    ["Bills", "quickbooks-bills", "Vendor bills, amounts"],
                    ["Expenses", "quickbooks-expenses", "Direct expenses, categories"],
                    ["Customers", "Master data", "Customer list"],
                    ["Vendors", "Master data", "Vendor list"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="orange">📋 Setup</Badge>
            </h4>
            <p>QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REALM_ID → then complete OAuth flow via Settings → Integrations → QuickBooks → Connect</p>
        </>
    );
}

function ReportsSection() {
    return (
        <>
            <h4 className="font-semibold mb-2">Executive</h4>
            <InfoTable
                headers={["Report", "Content"]}
                rows={[
                    ["Dashboard", "KPIs: revenue, expenses, net result, reconciliation rate, pending, bank balance"],
                    ["P&L", "Profit & Loss with monthly columns, budget vs actual, drilldown"],
                    ["Cashflow (Bank)", "Bank-level cashflow with gateway reconciliation"],
                    ["Cashflow (Consolidated)", "Revenue cashflow by FA groups vs bank inflows"],
                    ["Departmental P&L", "P&L by department/cost center"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Bank Reports (4 banks)</h4>
            <p>Each with: inline editing, one-click reconciliation toggle, payment source badges (Braintree/Stripe/GoCardless auto-detected), date range filter, export, intercompany matching.</p>

            <h4 className="font-semibold mt-4 mb-2">Payment Gateway Reports (13 pages)</h4>
            <p>Braintree Hub + 5 currencies + Transactions, Stripe + EUR/USD, GoCardless, PayPal, Pleo. Each with sync controls, fee breakdown, status history.</p>

            <h4 className="font-semibold mt-4 mb-2">Sales Insights</h4>
            <InfoTable
                headers={["Report", "Key Metrics"]}
                rows={[
                    ["Clinic Analytics", "MRR, churn rate, lifecycle events, consecutive months, YTD revenue"],
                    ["Lab Analysis", "Revenue, quantities, avg ticket, product breakdown, Natural Restorations"],
                    ["DSD Courses", "Course revenue by FA 101.x"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">AR / AP</h4>
            <p>AR: Overview KPIs, Invoice Orders browser, Web Orders, Insights, Customer/Product master data. AP: Overview, Invoices (25+ columns, splitting), Insights, Provider/FA/Cost Center master data.</p>
        </>
    );
}

function ReconciliationEngine() {
    return (
        <>
            <h4 className="font-semibold mb-2">Matching Rules</h4>
            <InfoTable
                headers={["Rule", "Threshold", "Description"]}
                rows={[
                    ["Date Proximity", "±3 calendar days", "Transactions must fall within a 3-day window"],
                    ["Amount Matching", "±€0.01", "Amounts must be within 1 cent"],
                    ["Cross-Source", "Automatic", "Bank ↔ Gateway ↔ Invoice ↔ CRM Deal"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Reconciliation Fields (per row)</h4>
            <InfoTable
                headers={["Field", "Type", "Description"]}
                rows={[
                    ["reconciled", "Boolean", "Whether matched"],
                    ["matched_with", "String", "ID of matched row"],
                    ["matched_source", "String", "Source of matched row"],
                    ["match_confidence", "Number", "Score 0-1"],
                    ["match_details", "JSON", "Match criteria breakdown"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Data Freshness Monitoring</h4>
            <div className="flex flex-wrap gap-3 my-2">
                {[
                    { color: "bg-green-500", label: "≤ 2 days — Fresh", icon: <CheckCircle2 size={14} /> },
                    { color: "bg-yellow-500", label: "≤ 4 days — Slightly Stale", icon: <AlertTriangle size={14} /> },
                    { color: "bg-orange-500", label: "≤ 7 days — Attention", icon: <AlertTriangle size={14} /> },
                    { color: "bg-red-500", label: "> 7 days — Action Required", icon: <Clock size={14} /> },
                ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded-full ${b.color}`} />
                        {b.label}
                    </div>
                ))}
            </div>

            <h4 className="font-semibold mt-4 mb-1">
                <Badge color="green">🔄 Workflow</Badge>
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Import bank statement</li>
                <li>Import/sync corresponding payment gateway</li>
                <li>Open bank report → system auto-detects gateway deposits with color badges</li>
                <li>Click badge to expand matches → verify → toggle &quot;Reconciled&quot;</li>
                <li>Check Reconciliation Center for overall health</li>
            </ol>
        </>
    );
}

function MasterDataSection() {
    return (
        <>
            <p>Master data must be populated <strong>before</strong> using AP invoices or advanced analytics.</p>

            <h4 className="font-semibold mt-4 mb-2">Setup Order</h4>
            <InfoTable
                headers={["#", "Data", "Location"]}
                rows={[
                    ["1", "Financial Accounts (Chart of Accounts)", "AP → Master Data → Financial Accounts"],
                    ["2", "Cost Centers (Departments)", "AP → Master Data → Departmental Accounts"],
                    ["3", "Providers (Vendors)", "AP → Master Data → Providers"],
                    ["4", "Bank Accounts", "Cash Management → Bank Accounts"],
                    ["5", "Products", "AR → Master Data → Products"],
                    ["6", "Customers", "AR → Master Data → Customers"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Revenue Account Structure</h4>
            <InfoTable
                headers={["Code Range", "Category", "Examples"]}
                rows={[
                    ["101.x", "Growth (Education)", "Courses, Mastership, Memberships, Partnerships"],
                    ["102.x", "Delight (Clinic Services)", "Consultancies, Marketing Coaching"],
                    ["103.x", "Planning Center", "Smile Design, Prep Guide, Ortho Planning"],
                    ["104.x", "LAB (Manufacturing)", "Prosthesis, Crown, Veneer"],
                    ["105.x", "Other Income", "Subscriptions, Licensing"],
                ]}
            />
        </>
    );
}

function SettingsAdmin() {
    return (
        <>
            <InfoTable
                headers={["Page", "Purpose"]}
                rows={[
                    ["Profile", "User name, avatar, preferences"],
                    ["Security", "Password, 2FA, active sessions"],
                    ["Users", "Create, deactivate, assign roles"],
                    ["Roles & Permissions", "Permission configuration"],
                    ["Notifications", "Alert preferences"],
                    ["Integrations", "External service connections (Braintree, Stripe, QuickBooks, HubSpot)"],
                    ["System", "Company name, timezone, language, date/currency formats"],
                    ["Audit Log", "Complete trail of all system actions"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Initial Setup Checklist</h4>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Create admin user account</li>
                <li>Configure company settings (timezone, language, formats)</li>
                <li>Set up Financial Accounts + Cost Centers</li>
                <li>Add Providers/Vendors + Bank Accounts</li>
                <li>Configure API integrations (Braintree, Stripe, etc.)</li>
                <li>Import first bank statement</li>
                <li>Sync first payment gateway</li>
                <li>Enter first AP invoice or upload first Invoice Order CSV</li>
            </ol>
        </>
    );
}

function TechSpecs() {
    return (
        <>
            <h4 className="font-semibold mb-2">Database Schema (Key Tables)</h4>
            <InfoTable
                headers={["Table", "Purpose", "Scale"]}
                rows={[
                    ["csv_rows", "All imported transactions (unified)", "30,000+ rows"],
                    ["invoices", "Accounts Payable", "5,000+"],
                    ["ar_invoices", "Accounts Receivable", "10,000+"],
                    ["providers / customers", "Master data", "200+ / 2,000+"],
                    ["financial_accounts / cost_centers", "Chart of Accounts / Departments", "50+ / 20+"],
                    ["ws_projects / ws_tasks", "Workstream PM", "50+ / 500+"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Security</h4>
            <InfoTable
                headers={["Feature", "Implementation"]}
                rows={[
                    ["Authentication", "Supabase Auth with PKCE flow"],
                    ["Authorization", "Row Level Security (RLS) on all tables"],
                    ["API Security", "Service role key (server-only), anon key (client-side)"],
                    ["Data Isolation", "Multi-scope filtering (ES/US/GLOBAL)"],
                    ["Webhooks", "Signature verification (Braintree)"],
                ]}
            />

            <h4 className="font-semibold mt-4 mb-2">Multi-Currency & Multi-Entity</h4>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="font-medium text-sm">Currencies</p>
                    <p className="text-sm text-gray-500">EUR (Bankinter, Sabadell, Braintree, Stripe, GoCardless, PayPal)</p>
                    <p className="text-sm text-gray-500">USD (Bankinter, Chase, Braintree, Stripe)</p>
                    <p className="text-sm text-gray-500">GBP, AUD (Braintree only)</p>
                </div>
                <div>
                    <p className="font-medium text-sm">Entity Scopes</p>
                    <p className="text-sm text-gray-500">ES — Spanish operations</p>
                    <p className="text-sm text-gray-500">US — US operations</p>
                    <p className="text-sm text-gray-500">GLOBAL — Combined view</p>
                </div>
            </div>
        </>
    );
}

function QuickReference() {
    return (
        <InfoTable
            headers={["Feature", "What User Must Have Ready"]}
            rows={[
                ["Bank Import (Bankinter)", "XLSX from portal: FECHA VALOR, DESCRIPCIÓN, DEBE/HABER"],
                ["Bank Import (Sabadell)", "CSV (semicolon): FECHA, CONCEPTO, MOVIMIENTO"],
                ["Bank Import (Chase)", "CSV: POSTING DATE, DESCRIPTION, AMOUNT"],
                ["Braintree CSV", "Transaction Search CSV from Control Panel"],
                ["Braintree API", "Merchant ID + public/private keys configured"],
                ["Stripe", "STRIPE_SECRET_KEY configured"],
                ["GoCardless", "Access token configured"],
                ["Invoice Orders", "CSV/XLSX: ID/NUMBER, DATE, TOTAL (+ optional CLIENT, EMAIL, ORDER)"],
                ["HubSpot Sync", "SQL Server DW connection configured"],
                ["QuickBooks", "OAuth completed (client ID, secret, realm ID)"],
                ["AP Invoices", "Master data first: providers, FA, cost centers, bank accounts"],
                ["Reconciliation", "Both sides loaded: bank statement + gateway/invoice data"],
                ["P&L Report", "AP invoices (expenses) + AR data (revenue) imported"],
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

    const sections: Section[] = [
        { id: "executive", title: "1. Executive Summary", icon: <BookOpen size={18} />, content: <ExecutiveSummary /> },
        { id: "architecture", title: "2. System Architecture", icon: <Server size={18} />, content: <SystemArchitecture /> },
        { id: "banks", title: "3.1 Bank Statements", icon: <Building2 size={18} />, content: <BankStatements /> },
        { id: "gateways", title: "3.2 Payment Gateways", icon: <CreditCard size={18} />, content: <PaymentGateways /> },
        { id: "invoices", title: "3.3 Invoice Orders (AR)", icon: <FileText size={18} />, content: <InvoiceOrders /> },
        { id: "weborders", title: "3.4 Web Orders & CRM", icon: <ShoppingCart size={18} />, content: <WebOrdersCRM /> },
        { id: "ap", title: "3.5 Accounts Payable", icon: <Receipt size={18} />, content: <AccountsPayable /> },
        { id: "api", title: "3.6 API Integrations", icon: <Zap size={18} />, content: <APIIntegrations /> },
        { id: "reports", title: "4. Reports & Dashboards", icon: <BarChart3 size={18} />, content: <ReportsSection /> },
        { id: "reconciliation", title: "5. Reconciliation Engine", icon: <GitMerge size={18} />, content: <ReconciliationEngine /> },
        { id: "masterdata", title: "6. Master Data Management", icon: <Database size={18} />, content: <MasterDataSection /> },
        { id: "settings", title: "9. Settings & Administration", icon: <Settings size={18} />, content: <SettingsAdmin /> },
        { id: "tech", title: "10. Technical Specifications", icon: <Server size={18} />, content: <TechSpecs /> },
        { id: "quickref", title: "Quick Reference — What to Prepare", icon: <CheckCircle2 size={18} />, content: <QuickReference /> },
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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Manual</h1>
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
                            v2.0
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Multi-Currency Financial Reconciliation &amp; Reporting Platform — Complete reference guide
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
                            placeholder="Search sections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={expandAll}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        Expand All
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        Collapse All
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
                        No sections match &quot;{searchQuery}&quot;
                    </div>
                )}
            </div>
        </div>
    );
}
