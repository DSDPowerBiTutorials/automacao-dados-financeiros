# FinanceFlow — Product Manual

**Multi-Currency Financial Reconciliation & Reporting Platform**

Version 2.0 · March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Data Input Methods](#3-data-input-methods)
   - 3.1 [Bank Statements](#31-bank-statements)
   - 3.2 [Payment Gateway Imports](#32-payment-gateway-imports)
   - 3.3 [Invoice Orders (Accounts Receivable)](#33-invoice-orders-accounts-receivable)
   - 3.4 [Web Orders (CRM & E-Commerce)](#34-web-orders-crm--e-commerce)
   - 3.5 [Accounts Payable Invoices](#35-accounts-payable-invoices)
   - 3.6 [API Integrations (Automated Sync)](#36-api-integrations-automated-sync)
4. [Reports & Dashboards](#4-reports--dashboards)
   - 4.1 [DSD B-i (Business Intelligence)](#41-dsd-b-i-business-intelligence)
5. [Reconciliation Engine](#5-reconciliation-engine)
6. [Master Data Management](#6-master-data-management)
7. [Integrations](#7-integrations)
8. [Project Management (Workstream)](#8-project-management-workstream)
9. [Settings & Administration](#9-settings--administration)
10. [Technical Specifications](#10-technical-specifications)

---

## 1. Executive Summary

FinanceFlow is an end-to-end financial reconciliation platform purpose-built for multi-entity, multi-currency businesses. It ingests data from banks, payment gateways, CRMs, and accounting systems, then automatically matches and reconciles transactions across all sources.

### Core Capabilities

| Capability | Description |
|---|---|
| **Multi-Bank Reconciliation** | Import statements from Bankinter (EUR/USD), Sabadell (EUR), and Chase (USD) in native formats |
| **Payment Gateway Consolidation** | Braintree (5 currencies), Stripe (EUR/USD), GoCardless (SEPA), PayPal, and Pleo expense cards |
| **Automated Matching** | Cross-source reconciliation using date proximity (±3 days) and amount matching (±€0.01) |
| **Multi-Currency Support** | EUR, USD, GBP, AUD with automatic exchange rate tracking |
| **Accounts Payable** | Full invoice lifecycle from entry to payment reconciliation with invoice splitting |
| **Accounts Receivable** | Customer invoice management with payment tracking across all gateways |
| **Sales Analytics** | Clinic MRR/churn tracking, lab product analytics, customer lifetime analysis |
| **CRM Integration** | HubSpot deal sync via SQL Server data warehouse |
| **Accounting Integration** | QuickBooks Online sync (invoices, bills, payments, customers, vendors) |
| **Project Management** | Built-in Workstream module with Kanban boards, timelines, subtasks, and dependencies |

### Who It's For

- **Finance teams** managing multiple bank accounts and payment processors across countries
- **Operations leaders** tracking revenue, expenses, and cash flow in real time
- **Companies with e-commerce** selling through Braintree, Stripe, GoCardless, or PayPal who need to reconcile gateway payouts against bank deposits
- **Multi-entity businesses** operating in different countries (e.g., Spain + US) with intercompany transactions

---

## 2. System Architecture

### Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui component library, Lucide icons |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **File Storage** | Supabase Storage (CSV/XLSX uploads) |
| **Authentication** | Supabase Auth (PKCE flow, session persistence) |
| **Hosting** | Vercel (auto-deploy from Git) |
| **External APIs** | Braintree SDK, Stripe API, GoCardless API, QuickBooks OAuth, HubSpot SQL Server |

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA INPUT LAYER                            │
├──────────────┬──────────────┬───────────────┬──────────────────────┤
│  Bank CSVs   │ Payment CSVs │  API Syncs    │  Manual Entry        │
│  (XLSX/CSV)  │  (CSV)       │  (REST/SDK)   │  (Forms)             │
│  Bankinter   │  Braintree   │  Braintree    │  AP Invoices         │
│  Sabadell    │  Stripe      │  Stripe       │  AR Invoices         │
│  Chase       │  PayPal      │  GoCardless   │  Customers           │
│              │  Pleo        │  HubSpot      │  Providers           │
│              │              │  QuickBooks   │  Products            │
└──────┬───────┴──────┬───────┴───────┬───────┴──────────┬───────────┘
       │              │               │                  │
       ▼              ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NORMALIZATION LAYER                              │
│                                                                     │
│  • European number parsing (1.000,50 → 1000.50)                    │
│  • US number parsing ($1,000.50 → 1000.50)                         │
│  • Date standardization → ISO 8601 (YYYY-MM-DD)                    │
│  • Currency detection (from merchant account or ISO code)           │
│  • Deduplication (by invoice_number, deal_id, transaction_id)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                                  │
│                                                                     │
│  csv_rows         Unified transaction table (all imports)           │
│  invoices         Accounts Payable master invoices                  │
│  ar_invoices      Accounts Receivable customer invoices             │
│  providers        Vendor master data                                │
│  customers        Customer master data                              │
│  products         Product catalog                                   │
│  financial_accts  Chart of Accounts (GL)                            │
│  cost_centers     Departmental cost allocation                      │
│  bank_accounts    Bank account master data                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   RECONCILIATION ENGINE                             │
│                                                                     │
│  • Date matching: |date1 − date2| ≤ 3 days                        │
│  • Amount matching: |amount1 − amount2| < 0.01                    │
│  • Cross-source linking (bank ↔ gateway ↔ invoice ↔ CRM deal)     │
│  • Confidence scoring and match details tracking                    │
│  • Preserves reconciliation state across data refreshes             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REPORTING LAYER                                   │
│                                                                     │
│  Dashboard        Executive KPIs, cash flow, channel revenue        │
│  Bank Reports     Per-bank statement views with inline editing      │
│  Gateway Reports  Per-gateway transaction reconciliation            │
│  Sales Insights   Clinic MRR, Lab analytics, product breakdown      │
│  AP/AR Reports    Invoice lifecycle, aging, payment tracking        │
│  Cash Management  Multi-bank position, payment channel hub          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Input Methods

FinanceFlow supports six categories of data input, each with specialized parsing, validation, and normalization logic.

> **Legend:** Sections marked with 📋 **USER MUST PROVIDE** indicate what the user needs to prepare before using the feature. Sections marked with 🔄 **WORKFLOW** describe the step-by-step process.

---

### 3.1 Bank Statements

Bank statements are the foundation of the reconciliation process. Each bank has a dedicated import handler that understands its specific file format, column structure, and number conventions.

---

#### 3.1.1 Bankinter EUR (Spanish Bank — Euro Account)

| Property | Detail |
|---|---|
| **Upload Point** | Cash Management → Bank Statements → Bankinter EUR |
| **File Format** | XLSX or XLS (Microsoft Excel) |
| **Source ID** | `bankinter-eur` |
| **Number Format** | European: `.` = thousands separator, `,` = decimal (e.g., `4.250,75` = €4,250.75) |

📋 **USER MUST PROVIDE:**

The user must download the bank statement in XLSX format from the Bankinter online banking portal. The file **must** contain the following columns:

| Required Column | Example Value | Notes |
|---|---|---|
| `FECHA VALOR` or `FECHA CONTABLE` | `15/03/2026` | Transaction value date or accounting date |
| `DESCRIPCIÓN` | `TRANSFERENCIA SEPA` | Transaction description text |
| `DEBE` (debit) | `1.250,00` | European format — money going OUT |
| `HABER` (credit) | `4.500,75` | European format — money coming IN |

**OR alternatively:**

| Required Column | Example Value | Notes |
|---|---|---|
| `FECHA VALOR` | `15/03/2026` | Transaction date |
| `DESCRIPCIÓN` | `TRANSFERENCIA SEPA` | Description |
| `IMPORTE` | `-1.250,00` | Single amount column (negative = debit) |

**Optional Columns (enriched if present):** `SALDO` (running balance), `REFERENCIA`, `CLAVE`, `CATEGORÍA`

**Amount Calculation:**
- If both `DEBE` and `HABER` are present: `amount = HABER - DEBE`
- If `IMPORTE` is present: `amount = IMPORTE` directly
- Positive = credits (money in), Negative = debits (money out)

**European Number Parsing (Critical):**
```
Input:  "4.250,75"
Step 1: Remove dots → "4250,75"
Step 2: Replace comma with dot → "4250.75"
Result: 4250.75
```

🔄 **WORKFLOW:**

1. **Download:** Log into Bankinter online banking → Accounts → Export movements → Choose XLSX format → Select date range
2. **Upload:** Navigate to **Cash Management → Bank Statements** → Select "Bankinter EUR" tab → Click "Upload File" → Select the downloaded XLSX
3. **Review:** System parses all rows, showing a preview with parsed amounts → Verify totals match bank statement
4. **Confirm:** Click "Save" → Rows are inserted into the database with `source = bankinter-eur`
5. **Verify:** Go to **Reports → Bankinter EUR** to see all imported transactions. System auto-detects payment sources (Braintree, Stripe, GoCardless) from transaction descriptions and adds color-coded badges

**After Import Feeds:** `/reports/bankinter-eur` (inline editing, reconciliation marking, payment source badges), Dashboard (cash flow), Cash Management (bank position), Reconciliation Center (auto-matching)

---

#### 3.1.2 Bankinter USD (Dollar Account)

| Property | Detail |
|---|---|
| **File Format** | XLSX or XLS |
| **Source ID** | `bankinter-usd` |
| **Column Structure** | Identical to Bankinter EUR |
| **Number Format** | European format (same bank, different currency) |

📋 **USER MUST PROVIDE:** Same file structure as Bankinter EUR. Download from the USD account section of Bankinter online banking.

🔄 **WORKFLOW:** Same as Bankinter EUR, but select the "Bankinter USD" tab in the upload area.

**After Import Feeds:** `/reports/bankinter-usd` with Braintree/Stripe USD payout identification badges.

---

#### 3.1.3 Sabadell EUR (Spanish Bank — Euro Account)

| Property | Detail |
|---|---|
| **File Format** | CSV with semicolon separator (`;`) |
| **Source ID** | `sabadell` |
| **Number Format** | European |
| **Separator** | Semicolon (`;`) — Spanish banking CSV standard |

📋 **USER MUST PROVIDE:**

Download CSV from Sabadell online banking. The file **must** contain:

| Required Column | Example Value | Notes |
|---|---|---|
| `FECHA` | `15/03/2026` | Format `DD/MM/YYYY` |
| `CONCEPTO` or `DESCRIPCION` | `RECIBO DOMICILIADO` | Description |
| `MOVIMIENTO` or `IMPORTE` | `1.250,50` | European format amount |

**Optional Columns:** `SALDO`, `REFERENCIA`, `CATEGORIA`

🔄 **WORKFLOW:**

1. **Download:** Sabadell online banking → Export account movements → Choose CSV format → Date range
2. **Upload:** Cash Management → Bank Statements → "Sabadell" tab → Upload File
3. **Review & Confirm:** Preview parsed rows → Save
4. **Verify:** Reports → Sabadell to see imported transactions

**After Import Feeds:** `/reports/sabadell`, Dashboard, Cash Management, Reconciliation Center.

---

#### 3.1.4 Chase USD (US Bank — Dollar Account)

| Property | Detail |
|---|---|
| **File Format** | CSV (comma-separated) |
| **Source ID** | `chase-usd` |
| **Number Format** | US format: `,` = thousands, `.` = decimal (e.g., `$1,250.75`) |

📋 **USER MUST PROVIDE:**

Download CSV from Chase online banking. The file **must** contain:

| Required Column | Example Value | Notes |
|---|---|---|
| `POSTING DATE` | `03/15/2026` | Format `MM/DD/YYYY` (US format) |
| `DESCRIPTION` | `STRIPE TRANSFER` | Transaction description |
| `AMOUNT` | `$1,250.75` or `1250.75` | US number format, negative = debit |

**Optional Columns:** `DETAILS`, `TYPE`, `BALANCE`, `CHECK/SLIP #`

**US Number Parsing:**
```
Input:  "$1,250.75"
Step 1: Remove $ and commas → "1250.75"
Result: 1250.75
```

🔄 **WORKFLOW:**

1. **Download:** Chase.com → Account Activity → Download → CSV
2. **Upload:** Cash Management → Bank Statements → "Chase USD" tab → Upload
3. **Review & Confirm:** Verify amounts → Save
4. **Verify:** Reports → Chase USD

**After Import Feeds:** `/reports/chase-usd` with intercompany routing and Stripe payout tracking.

---

### 3.2 Payment Gateway Imports

Payment gateway data can be imported via **CSV upload** or **automated API sync**. Each gateway has a dedicated report page with transaction-level detail and reconciliation controls.

---

#### 3.2.1 Braintree (Multi-Currency Payment Processor)

| Property | Detail |
|---|---|
| **Import Methods** | CSV upload **OR** API sync (Braintree SDK) |
| **Currencies** | EUR, USD, GBP, AUD, AMEX |
| **Source IDs** | `braintree-eur`, `braintree-usd`, `braintree-gbp`, `braintree-aud`, `braintree-amex` |
| **Fee Source IDs** | `braintree-api-fees` |
| **Revenue Source IDs** | `braintree-api-revenue` |

##### Method A: CSV Import

📋 **USER MUST PROVIDE:**

Export the **Transaction Search** CSV from the Braintree Control Panel. The file contains 120+ columns — the system auto-extracts the relevant ones:

| Braintree Column | Maps To | Notes |
|---|---|---|
| `Transaction ID` | `custom_data.transaction_id` | Unique identifier |
| `Settlement Date` | `date` (primary) | Preferred over Created Datetime |
| `Created Datetime` | `date` (fallback) | Used when settlement date is absent |
| `Amount Submitted For Settlement` | `amount` | Preferred over Amount Authorized |
| `Service Fee` | Separate fee row | Creates a **second** `csv_rows` entry |
| `Customer First Name` + `Last Name` | `customer_name` | Concatenated |
| `Customer Email` | `customer_email` | Used for cross-matching |
| `Order ID` | `custom_data.order_id` | Links to e-commerce order |
| `Settlement Batch ID` | `custom_data.settlement_batch_id` | Groups transactions in bank deposits |
| `Merchant Account` | Currency detection | Determines EUR/USD/GBP/AUD source |
| `Card Type` | `custom_data.card_type` | Visa, Mastercard, AMEX, etc. |
| `Subscription ID` | `custom_data.subscription_id` | Recurring payment tracking |
| `Refunded Transaction ID` | `custom_data.refunded_transaction_id` | Links refunds to originals |
| `Disbursement Date` | `custom_data.disbursement_date` | When Braintree pays out to bank |

🔄 **WORKFLOW (CSV):**

1. **Export:** Log into Braintree Control Panel → Transactions → Search → Set date range → Click "Download → CSV" (includes all fields)
2. **Upload:** Cash Management → Payment Channels → "Braintree CSV" → Upload File
3. **Auto-Processing:** System skips declined/voided/failed transactions, creates two rows per transaction (revenue + fee), auto-detects currency from merchant account
4. **Verify:** Reports → Braintree (currency) to see transactions organized by currency

##### Method B: API Sync (Real-Time)

📋 **USER MUST PROVIDE (one-time setup):**

Environment variables in the server configuration:
- `BRAINTREE_MERCHANT_ID` — From Braintree Control Panel → Settings
- `BRAINTREE_PUBLIC_KEY` — API key from Braintree
- `BRAINTREE_PRIVATE_KEY` — API secret from Braintree
- `BRAINTREE_ENVIRONMENT` — `production` or `sandbox`

🔄 **WORKFLOW (API):**

1. **Navigate:** Reports → Braintree EUR (or any currency)
2. **Click Sync:** Use the "Sync" button at the top of the page → Choose date range or "Days Back"
3. **Auto-Processing:** System uses Braintree Node SDK to search transactions, extracts full status history including settlement timestamps, generates settlement batch IDs
4. **Safe Update:** Preserves existing reconciliation flags — already-reconciled rows are not overwritten

**Key Processing Rules:**
- Declined, voided, and failed transactions are automatically skipped
- Each transaction creates **two rows**: one for revenue, one for the processing fee
- Currency is auto-detected from the merchant account ID or `Currency ISO Code` column
- Settlement Batch ID enables grouping transactions that arrive as a single bank deposit

**After Import Feeds:** `/reports/braintree-eur`, `/reports/braintree-usd`, `/reports/braintree-gbp`, `/reports/braintree-aud`, `/reports/braintree-amex`, Braintree Dashboard (`/reports/braintree`), Reconciliation Center, Sales Insights.

---

#### 3.2.2 Stripe (EUR & USD)

| Property | Detail |
|---|---|
| **Import Methods** | CSV upload OR API sync |
| **Source IDs** | `stripe`, `stripe-eur`, `stripe-usd` |

📋 **USER MUST PROVIDE (one-time setup for API):**
- `STRIPE_SECRET_KEY` — From Stripe Dashboard → Developers → API Keys

📋 **USER MUST PROVIDE (CSV):**
Export from Stripe Dashboard → Payments → Export → CSV. Key columns: `id`, `Amount`, `Currency`, `Status`, `Created (UTC)`, `Customer Email`.

🔄 **WORKFLOW:**

1. **API Sync:** Reports → Stripe → Click "Sync" → System pulls charges (customer payments) and payouts (bank settlements), converts amounts from cents to decimals
2. **OR CSV Upload:** Cash Management → Payment Channels → Stripe → Upload CSV
3. **Verify:** Reports → Stripe EUR / Stripe USD

**After Import Feeds:** `/reports/stripe`, `/reports/stripe-eur`, `/reports/stripe-usd`, Dashboard, Reconciliation Center.

---

#### 3.2.3 GoCardless (SEPA Direct Debit)

| Property | Detail |
|---|---|
| **Import Method** | API sync only |
| **Source ID** | `gocardless` |

📋 **USER MUST PROVIDE (one-time setup):**
- `GOCARDLESS_ACCESS_TOKEN` — From GoCardless Dashboard → Developers → API Keys
- `GOCARDLESS_ENVIRONMENT` — `live` or `sandbox`

🔄 **WORKFLOW:**

1. **Navigate:** Reports → GoCardless → Click "Sync"
2. **Optionally** provide a `sinceDate` (e.g., `2025-01-01`) to limit the sync range
3. **Auto-Processing:** System fetches **Payouts** (bank deposits: `arrival_date`, `amount / 100`) and **Payments** (customer charges: `charge_date`, `amount / 100`)
4. **Deduplication:** IDs formatted as `gocardless_{id}` prevent duplicate imports
5. **Verify:** Reports → GoCardless

**After Import Feeds:** `/reports/gocardless`, Dashboard, Reconciliation Center.

---

#### 3.2.4 PayPal

| Property | Detail |
|---|---|
| **Source ID** | `paypal` |
| **Import Method** | CSV upload |

📋 **USER MUST PROVIDE:**
Export transaction history CSV from PayPal Business → Activity → Download. Key columns: Date, Description, Currency, Gross, Fee, Net, Transaction ID.

🔄 **WORKFLOW:** Cash Management → Payment Channels → PayPal → Upload → Review → Save.

**After Import Feeds:** `/reports/paypal`, Dashboard, Reconciliation Center.

---

#### 3.2.5 Pleo (Expense Cards)

| Property | Detail |
|---|---|
| **Source ID** | `pleo` |
| **Import Method** | API sync |

📋 **USER MUST PROVIDE (one-time setup):**
- `PLEO_API_KEY` — From Pleo admin panel

🔄 **WORKFLOW:** Cash Management → Expenses (Pleo) → Sync → System pulls employee expense transactions with merchant name, category, receipt URL, and approval status.

**After Import Feeds:** `/reports/pleo`.

---

### 3.3 Invoice Orders (Accounts Receivable)

Invoice orders represent individual transaction-level records from the company's invoicing system. These are the raw revenue records that need to be matched against payment gateway deposits and bank statement entries.

| Property | Detail |
|---|---|
| **Upload Point** | Accounts Receivable → Invoice Orders → Upload CSV |
| **Source ID** | `invoice-orders` |
| **Target Table** | `csv_rows` |
| **Accepted Formats** | CSV, XLSX, XLS |

📋 **USER MUST PROVIDE:**

A CSV or XLSX file exported from the invoicing system (e.g., Craft Commerce, Chargebee, or custom ERP). The system auto-detects columns from headers. The **minimum required columns** are:

| Required Column | Header Name(s) Accepted | Example | Notes |
|---|---|---|---|
| **Invoice Identifier** | `ID` or `NUMBER` | `INV-2026-0001` | Must be unique — used for deduplication |
| **Date** | `INVOICE DATE`, `DATE`, `FECHA` | `2026-03-15` or `15/03/2026` | ISO or DD/MM/YYYY or Excel serial |
| **Amount** | `TOTAL`, `AMOUNT`, `VALOR` | `1250.50` | Decimal or European format |

**Highly recommended columns (enriched if present):**

| Column | Header Name(s) | Purpose |
|---|---|---|
| **Products/Description** | `PRODUCTS`, `DESCRIPTION`, `NAME` | Maps to row description, used for FA classification |
| **Order Number** | `ORDER` | Links to e-commerce order for cross-matching |
| **Currency** | `CURRENCY` | Defaults to EUR if absent |
| **Client Name** | `CLIENT`, `COMPANY` | Customer identification |
| **Email** | `EMAIL` | Customer email for cross-matching with gateways |
| **Country** | `COUNTRY` | Geographic segmentation |
| **Payment Method** | `PAYMENT METHOD` | Braintree, Stripe, etc. |
| **Billing Entity** | `BILLING ENTITY` | Multi-entity scoping |
| **Charged Amount** | `CHARGED` | Actual amount charged (may differ from invoice total) |

**Automatic Financial Account Classification:**

The system automatically maps products to revenue GL accounts based on description keywords:

| Financial Account | Code | Matched Products |
|---|---|---|
| DSD Courses | 101.1 | "DSD Provider", "Designing Smiles", "Case Acceptance" |
| Mastership | 101.3 | "Mastership", "Residency" |
| PC Membership | 101.4 | "Provider Membership", "Planning Center Membership" |
| Partnerships | 101.5 | "Sponsorship", "Partnership", "Exhibit Space" |
| Consultancies | 102.5 | "Clinic Transformation", "Consultancy", "Monthly Fee" |
| Marketing Coaching | 102.6 | "Fractional CMO", "Growth Hub Onboarding" |
| Planning Center | 103.0 | "Smile Design", "Prep Guide", "Ortho Planning" |
| LAB | 104.0 | "Manufacture", "Prosthesis", "Crown", "Veneer" |
| Subscriptions | 105.1 | "Growth Hub", "Monthly Subscription" |

🔄 **WORKFLOW:**

1. **Export:** From your invoicing system, export all invoices as CSV or XLSX for the desired period
2. **Navigate:** Accounts Receivable → Invoice Orders
3. **Upload:** Click "Upload CSV" → Select file → System shows column mapping preview
4. **Deduplication:** System checks for duplicate `invoice_number` values against existing database records AND within the file itself. Duplicates are skipped (count reported)
5. **Processing:** Rows are parsed, financial accounts auto-classified, and inserted into `csv_rows` with `source = invoice-orders`
6. **Verify:** Scroll through the Invoice Orders table to verify imported data

**After Import Feeds:**
- `/accounts-receivable/invoice-orders` — Direct transaction browser with column customization
- `/reports/braintree-*` — Cross-referenced to identify which gateway transactions match invoices
- `/actions/reconciliation-center` — Matched against bank deposits
- `/sales-insights/lab` — Lab product analytics (FA 104.x)
- `/sales-insights/clinics` — Clinic MRR/churn tracking (FA 102.x, 103.x)
- `/pnl` — P&L report revenue lines

---

### 3.4 Web Orders (CRM & E-Commerce)

Web orders come from two sources: **HubSpot CRM deals** and **Craft Commerce** e-commerce orders. These represent the "demand side" of the revenue equation — what was sold to whom.

---

#### 3.4.1 HubSpot Deals (via SQL Server Data Warehouse)

| Property | Detail |
|---|---|
| **Source ID** | `hubspot` |
| **Data Source** | SQL Server Data Warehouse (HubSpot replicated data) |
| **Target Table** | `csv_rows` |
| **Sync Method** | API route triggered from UI |

📋 **USER MUST PROVIDE (one-time setup):**
- SQL Server connection credentials (host, database, user, password) configured in environment variables
- HubSpot data warehouse replication must be running (e.g., via Hevo, Fivetran, or custom ETL)

📋 **USER DOES NOT NEED TO PROVIDE:** The sync is fully automated — no file uploads needed.

🔄 **WORKFLOW:**

1. **Navigate:** Reports → HubSpot → Web Orders **OR** Integrations → HubSpot → Sync Settings
2. **Click "Sync":** System connects to SQL Server, executes enriched HubSpot query
3. **Data Extracted:**
   - Deal name, close date, amount, currency
   - Deal stage and pipeline status
   - Contact (name, email, company)
   - Product details (name, code, category, quantity, price)
   - E-commerce order number (`ecomm_order_number`)
4. **Financial Account Mapping:** Products auto-classified to FA codes:
   | Product Category | FA Code |
   |---|---|
   | DSD Core Products | 101.0 |
   | Planning Center | 102.0 |
   | Clinic Subscriptions | 103.x |
   | Lab Products | 104.x |
   | DSD Courses | 105.0 |
5. **Deduplication:** Uses `deal_id` as primary key + `ecomm_order_number` as secondary. Existing reconciliation flags preserved.
6. **Verify:** Reports → HubSpot shows all synced deals with order code linking

**After Import Feeds:** `/reports/hubspot`, `/reports/braintree-*` (cross-reference via order_id), `/sales-insights/clinics`, `/sales-insights/lab`.

---

#### 3.4.2 Craft Commerce (E-Commerce Platform)

| Property | Detail |
|---|---|
| **Source ID** | `craft-commerce` |
| **Target Table** | `ar_invoices` (directly into Accounts Receivable) |

📋 **USER MUST PROVIDE:**

Export the full orders CSV from Craft CMS admin panel. The export can contain ~200 columns — the system extracts the relevant ones:

| Key Columns | Description |
|---|---|
| `reference` | Order reference number |
| `dateOrdered` | Order timestamp |
| `storedTotalPrice` | Total order value |
| `storedTotalPaid` | Amount paid |
| `storedItemTotal` | Subtotal before tax/shipping |
| `storedTotalDiscount` | Discount applied |
| `storedTotalTax` | Tax amount |
| `storedTotalShipping` | Shipping cost |
| `currency` / `paymentCurrency` | Currency |
| `email` | Customer email |
| `gatewayId` | `2` = Braintree, `3` = Stripe, `1` = Manual |
| `couponCode` | Discount code |

🔄 **WORKFLOW:**

1. **Export:** Craft CMS → Commerce → Orders → Export All → CSV
2. **Upload:** Accounts Receivable → Web Orders → Upload Craft Commerce CSV
3. **Auto-Classification:** System maps each order to deal status ("Credit Order", "Subscription Payment", "Free Product", "Coupon Order", "Web Order") and payment status ("paid", "pending", "partial", "cancelled")
4. **Verify:** Accounts Receivable → Web Orders

**After Import Feeds:** `/accounts-receivable/invoices`, `/sales-insights/clinics`, `/sales-insights/lab`.

#### 🎬 Video Tutorial — Web Orders

Watch how to upload and manage Web Orders from Craft Commerce, including order classification and payment status tracking.

📹 **Video:** [06_Web_orders.mp4](https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773932248320-06_Web_orders.mp4)

> **Tip:** Look for the ▶ icon in the page header (`/accounts-receivable/invoices`) for quick access.

---

### 3.5 Accounts Payable Invoices

AP invoices are entered **manually** through a comprehensive form interface that tracks the full invoice lifecycle from receipt to payment to bank reconciliation.

| Property | Detail |
|---|---|
| **Entry Point** | Accounts Payable → Invoices |
| **URL** | `/accounts-payable/invoices` |
| **Target Table** | `invoices` |

📋 **USER MUST PROVIDE (per invoice):**

| Category | Fields | Required? |
|---|---|---|
| **Identity** | Invoice number, provider (dropdown from master data) | **Yes** |
| **Dates** | Invoice date, benefit date (accrual period), due date | **Yes** |
| **Amount** | Invoice amount, currency | **Yes** |
| **Classification** | Financial account (GL code), cost center | **Yes** |
| **Payment Info** | Payment method, bank account (dropdown) | When paying |
| **Optional** | Purchase order number, notes, EUR exchange rate | No |
| **Optional Dates** | Input date, schedule date, payment date | No |
| **Flags** | DRE impact (P&L), cash impact, intercompany, scope (ES/US/GLOBAL) | Defaults provided |

📋 **USER MUST HAVE SET UP FIRST (Master Data):**
- **Providers** — At least one vendor in the Providers master data
- **Financial Accounts** — Chart of accounts populated
- **Cost Centers** — At least one departmental account
- **Bank Accounts** — At least one bank account for payment recording

**Invoice Types:**

| Type | Description | P&L Impact | Cash Impact |
|---|---|---|---|
| **INCURRED** | Standard expense invoice | Yes | Yes |
| **BUDGET** | Forecasted expense (tracking only) | No | No |
| **ADJUSTMENT** | Cash-only correction | No | Yes |

🔄 **WORKFLOW:**

1. **Navigate:** Accounts Payable → Invoices
2. **Click "New Invoice":** Opens the invoice form
3. **Fill Required Fields:** Select provider, enter invoice number, set dates, enter amount, select financial account and cost center
4. **Set Invoice Type:** INCURRED (default), BUDGET, or ADJUSTMENT
5. **Set Scope:** ES (Spain), US, or GLOBAL
6. **Save:** Invoice is created in "Pending" status
7. **Later — Record Payment:** When the invoice is paid, update the payment date, paid amount, and bank account
8. **Later — Reconcile:** The bank report page will cross-reference this invoice against bank statement debits

**Invoice Splitting:**

Invoices can be split by installment payments, financial account allocation, cost center distribution, or departmental cost type. The system preserves parent-child relationships via `parent_invoice_id`, `split_number`, and `total_splits` fields.

🔄 **SPLIT WORKFLOW:**
1. Open an existing invoice → Click "Split"
2. Choose split type (installment, FA allocation, cost center, departmental)
3. Define split amounts/percentages → Each split creates a child invoice
4. Parent invoice links to all children for tracking

**After Entry Feeds:**
- `/accounts-payable/invoices` — Full invoice browser with 25+ customizable columns
- `/dashboard` — Expense KPIs, monthly totals, pending payment counts
- `/pnl` — P&L expense lines (for INCURRED type)
- `/reports/bankinter-*`, `/reports/sabadell`, `/reports/chase-usd` — Bank reports cross-match debits against recorded expenses
- `/cash-management` — Cash position calculations
- `/departmental/pnl` — Departmental P&L breakdown

---

### 3.6 API Integrations (Automated Sync)

#### 3.6.1 QuickBooks Online

| Property | Detail |
|---|---|
| **Authentication** | OAuth 2.0 (user authorizes once, tokens auto-refresh) |
| **Sync Types** | `all`, `invoices`, `payments`, `bills`, `expenses` |

📋 **USER MUST PROVIDE (one-time setup):**
- `QUICKBOOKS_CLIENT_ID` — From QuickBooks Developer portal → App settings
- `QUICKBOOKS_CLIENT_SECRET` — From QuickBooks Developer portal
- `QUICKBOOKS_REALM_ID` — Your company's QuickBooks ID
- Complete OAuth authorization flow via Settings → Integrations → QuickBooks → Connect

📋 **USER DOES NOT NEED TO PROVIDE:** After initial OAuth authorization, all syncs are automatic.

🔄 **WORKFLOW:**

1. **First-time:** Settings → Integrations → QuickBooks → Click "Connect" → Authorize in QuickBooks popup → Tokens stored securely
2. **Sync:** Integrations → QuickBooks → Dashboard → Click "Sync All" (or choose specific type: invoices, bills, payments, expenses)
3. **Sync Types:**

| Data Type | Source ID | Target | What It Contains |
|---|---|---|---|
| Invoices | `quickbooks-invoices` | `csv_rows` | Customer invoices, due dates, line items |
| Payments | `quickbooks-payments` | `csv_rows` | Payment receipts, methods, references |
| Bills | `quickbooks-bills` | `csv_rows` | Vendor bills, due dates, amounts |
| Expenses | `quickbooks-expenses` | `csv_rows` | Direct expenses, categories |
| Deposits | `quickbooks-deposits` | `csv_rows` | Bank deposits |
| Transfers | `quickbooks-transfers` | `csv_rows` | Inter-account transfers |
| Customers | Master data | `quickbooks_customers` | Customer list |
| Vendors | Master data | `quickbooks_vendors` | Vendor list |
| Chart of Accounts | Master data | `quickbooks_accounts` | GL accounts |

4. **Verify:** Integrations → QuickBooks → Dashboard shows sync timestamps and row counts

**After Sync Feeds:** `/reports/quickbooks-usd` (tabbed views: all transactions, invoices, payments, bills, expenses).

---

## 4. Reports & Dashboards

Every data import feeds into one or more report pages. Reports provide real-time views, inline editing, reconciliation controls, and export capabilities.

### 4.1 Executive Dashboard

**URL:** `/dashboard`

📋 **USER MUST HAVE:** At least one data source imported (bank statement, gateway, or invoices) to see meaningful KPIs.

**KPI Cards (6):**

| KPI | Source | Calculation |
|---|---|---|
| **Revenue (Month)** | `ar_invoices` + `csv_rows` (gateway sources) | Sum of positive amounts for current month |
| **Expenses (Month)** | `invoices` (AP) | Sum of invoice amounts for current month |
| **Net Result** | Computed | Revenue minus Expenses |
| **Reconciliation Rate** | `csv_rows` | % of rows where `reconciled = true` |
| **Pending Transactions** | `csv_rows` | Count where `reconciled = false` |
| **Total Bank Balance** | `bank_accounts` | Sum of latest balances |

**Charts:**
1. **Cash Flow Area Chart** — Daily/monthly cash position trends (inflow vs outflow)
2. **Revenue by Channel** — Stacked bar: Braintree (indigo), Stripe (purple), GoCardless (amber), PayPal (blue)
3. **Expenses by Cost Center** — Departmental breakdown
4. **Bank Balance Cards** — Multi-account per bank with current balance
5. **Reconciliation Status** — Health badges per source (green ≤2d, yellow ≤4d, orange ≤7d, red >7d)
6. **Recent Transactions** — Latest posted transactions

**Scope Filter:** Toggle between ES (Spain), US, or GLOBAL views.

---

### 4.2 Bank Statement Reports

Each bank has a dedicated report page. Common features across all:

| Feature | Description |
|---|---|
| **Inline Editing** | Click any field to edit description, category, or amounts |
| **Reconciliation Toggle** | One-click to mark `reconciled = true/false` |
| **Payment Source Badges** | Auto-detection of Braintree/Stripe/GoCardless deposits (color-coded) |
| **Date Range Filter** | Filter by custom date range |
| **Auto-Reconciliation** | System matches against gateways and AP invoices |
| **Export** | Download as Excel/CSV |
| **Row Management** | Add, edit, delete individual transactions |
| **Intercompany Matching** | Auto-suggest intercompany transfers between bank accounts |

| Report | URL | Special Features |
|---|---|---|
| **Bankinter EUR** | `/reports/bankinter-eur` | Revenue order matching, intercompany linking |
| **Bankinter USD** | `/reports/bankinter-usd` | USD gateway matching |
| **Sabadell EUR** | `/reports/sabadell` | SEPA transfer identification |
| **Chase USD** | `/reports/chase-usd` | Stripe payout tracking |

---

### 4.3 Payment Gateway Reports

| Report | URL | Key Features |
|---|---|---|
| **Braintree Hub** | `/reports/braintree` | Cross-currency metrics, sync controls, settlement tracking |
| **Braintree EUR** | `/reports/braintree-eur` | HubSpot deal matching, status history viewer, fee breakdown |
| **Braintree USD** | `/reports/braintree-usd` | Cross-source matching, AR invoice reconciliation |
| **Braintree GBP** | `/reports/braintree-gbp` | GBP transaction reconciliation |
| **Braintree AUD** | `/reports/braintree-aud` | AUD transaction reconciliation |
| **Braintree AMEX** | `/reports/braintree-amex` | AMEX card processing |
| **Braintree Txns** | `/reports/braintree-transactions` | Raw API data, up to 4 order IDs per transaction |
| **Stripe** | `/reports/stripe` | CSV upload, metrics, inline edit |
| **Stripe EUR** | `/reports/stripe-eur` | Euro-specific transactions |
| **Stripe USD** | `/reports/stripe-usd` | Dollar-specific transactions |
| **GoCardless** | `/reports/gocardless` | SEPA debit tracking, destination matching |
| **PayPal** | `/reports/paypal` | Bank cross-matching |
| **Pleo** | `/reports/pleo` | Employee expense cards |

---

### 4.4 Accounts Receivable Reports

| Report | URL | Purpose |
|---|---|---|
| **AR Overview** | `/accounts-receivable` | KPIs: total receivables, open invoices, active customers, overdue |
| **Invoice Orders** | `/accounts-receivable/invoice-orders` | Raw transaction viewer, column customization, CSV upload, bulk actions |
| **Web Orders** | `/accounts-receivable/invoices` | Customer invoice management, payment tracking |
| **AR Insights** | `/accounts-receivable/insights` | Revenue analytics and trends |
| **Customers** | `/accounts-receivable/master-data/customers` | Customer master with duplicate detection |
| **Products** | `/accounts-receivable/master-data/products` | Product catalog with FA linking |

---

### 4.5 Accounts Payable Reports

| Report | URL | Purpose |
|---|---|---|
| **AP Overview** | `/accounts-payable` | KPIs: total payables, pending, active vendors, overdue |
| **Invoices** | `/accounts-payable/invoices` | Full lifecycle, 25+ columns, splitting, reconciliation |
| **AP Insights** | `/accounts-payable/insights` | Expense analytics, payment schedule |
| **Payment Schedule** | `/accounts-payable/insights/schedule` | Calendar view of pending payments, collaborators, comments |

#### 🎬 Video Tutorial — Payment Schedule

Watch how to use the Payment Schedule to track due dates, manage collaborators, and process scheduled payments.

📹 **Video:** [05_Payment_Scheduled.mp4](https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/tutorial-videos/1773913795277-05_Payment_Scheduled.mp4)

> **Tip:** Look for the ▶ icon in the page header (`/accounts-payable/insights/schedule`) for quick access.

| **Providers** | `/accounts-payable/master-data/providers` | Supplier master data |
| **Financial Accounts** | `/accounts-payable/master-data/financial-accounts` | Chart of Accounts |
| **Departmental Accounts** | `/accounts-payable/master-data/departmental-accounts` | Cost centers |

---

### 4.6 Sales Insights

#### 4.6.1 Clinic Analytics

**URL:** `/sales-insights/clinics`

📋 **USER MUST HAVE:** Invoice Orders and/or HubSpot deals imported with clinic-related products (FA 102.x, 103.x).

**Metrics per Clinic:**

| Metric | Description |
|---|---|
| **Status** | Active, Paused, Churned, or New |
| **Current MRR** | This month's recurring revenue |
| **Previous MRR** | Last month's recurring revenue |
| **MRR Change %** | Month-over-month growth |
| **YTD Revenue** | Year-to-date total |
| **Transaction Count** | Number of orders |
| **Months Active** | Total months with revenue |
| **Consecutive Months** | Unbroken streak of activity |
| **Lifecycle Events** | Timeline of new/churn/pause/return events |

**Dashboard KPIs:** Total clinics by status, total MRR, avg MRR per clinic, YTD revenue, churn rate, net change.

**Features:** Year/month/region selectors, status filters, search, expandable detail with product breakdown.

---

#### 4.6.2 Lab Analysis

**URL:** `/sales-insights/lab`

📋 **USER MUST HAVE:** Invoice Orders imported with lab products (FA 104.x) — including quantity data for unit tracking.

**Metrics per Client:**

| Metric | Description |
|---|---|
| **Revenue** | Current vs previous month |
| **Quantity** | Physical units purchased (`calc_qty` field) |
| **Average Ticket** | Revenue per order |
| **Products Breakdown** | Revenue, count, and quantity per product |

**Dashboard KPIs:** Total units YTD, revenue YTD, orders YTD, avg revenue per unit, MoM unit growth.

**Features:** Timeline charts (revenue, orders, active clients, avg ticket), product ranking, Natural Restorations subsection.

---

#### 4.6.3 DSD Courses & Calendar

- `/sales-insights/courses` — Course revenue tracking by financial account 101.x
- `/calendar` — DSD event calendar with scheduling

---

### 4.7 Executive Reports

| Report | URL | Purpose |
|---|---|---|
| **P&L** | `/pnl` | Full Profit & Loss statement with monthly columns, budget vs actual, drilldown |
| **Cashflow Summary** | `/executive/cash-flow/bank` | Bank-level cashflow with gateway reconciliation breakdown |
| **Consolidated Cashflow** | `/executive/cash-flow/consolidated` | Revenue cashflow by FA groups vs bank inflows |
| **Departmental P&L** | `/departmental/pnl` | P&L broken down by department/cost center |
| **Contracts** | `/departmental/contracts` | Contract tracking and management |

---

### 4.8 Cash Management Hub

| Page | URL | Purpose |
|---|---|---|
| **Bank Statements** | `/cash-management/bank-statements` | Central upload hub for ALL bank files (Bankinter EUR/USD, Sabadell, Chase) |
| **Bank Accounts** | `/cash-management/bank-accounts` | Bank account master data (IBAN, SWIFT, currency) |
| **Payment Channels** | `/cash-management/payment-channels` | Central upload hub for ALL gateway files |
| **Expenses (Pleo)** | `/reports/pleo` | Employee expense card sync and reconciliation |

---

### 4.1 DSD B-i (BI Dashboard Builder)

**Routes:** `/bi/build` (new dashboard), `/bi/build/[id]` (edit), `/bi/view/[id]` (read-only)

DSD B-i is a full BI Dashboard Builder platform accessible via the **header icon** (BarChart). It allows users to create, customize, save, and share interactive dashboards with drag-and-drop measures, 14 chart types, and an AI assistant (DSD Intelligence).

**Access & Navigation:**
- Header icon → dropdown with: **Build Dashboard**, **Ours Dashboards** (public list), **My Dashboards** (private list)
- No longer in the sidebar navigation — accessible exclusively via the header icon

**Dashboard Canvas:**
- 4 horizontal slots, each configurable with layout options
- Standard layouts: 5 Cards, 4 Cards, 2 Cards + 1 Chart, 1 Card + 1 Chart
- Expanded layouts (double height): 5 Cards + 1/2 Charts, 4 Cards + 1 Chart, 3 Cards + 1 Chart, 2 Cards + 2 Charts
- Slots can be merged (expand to double size) for larger visualizations

**Chart Types (14):**
Bar, Bar Horizontal, Bar Stacked, Line, Area, Area Stacked, Pie, Donut, Combo (Bar + Line), Radar, Treemap, Funnel, Scatter, Waterfall

**Measure System (Power BI-style):**
- 40+ measures across 6 categories: Aggregation, Math, Time Intelligence, Comparison, Statistical, Logical
- Drag measures from right sidebar onto Cards or Charts
- Create custom measures via Measure Creator popup with configurable parameters
- Measures can be saved as public (shared) or private

**Sidebars:**

| Sidebar | Contents |
|---------|----------|
| Left — Actions | New, Clone, Save Private, Save Public, Close, Close & Save |
| Left — Comments | Nested comment threads per dashboard |
| Right — Variables & Measures | Catalog browse, search, drag-and-drop, create new |
| Right — Filters | Date Range, Currency, Scope, Source quick filters |
| Right — Data Sources | Available Supabase tables: csv_rows (by source), hubspot_deals, revenue_entries |
| Right — DSD Intelligence AI | AI chat: analyze data, suggest charts, create measures (OpenAI GPT-4o-mini) |

**Data Sources:**

| Data | Source Table | Filter |
|------|-------------|--------|
| Revenue | `csv_rows` | `source = invoice-orders / invoice-orders-usd` |
| Expenses | `invoices` | `dre_impact = true`, `invoice_type ≠ BUDGET` |
| Bankinter EUR/USD | `csv_rows` | `source = bankinter-eur / bankinter-usd` |
| Braintree EUR/USD | `csv_rows` | `source = braintree-eur / braintree-usd` |
| Stripe / GoCardless | `csv_rows` | `source = stripe / gocardless` |
| HubSpot | `hubspot_deals` | — |

**API Endpoints:**
- `GET/POST /api/bi/dashboards` — List/create dashboards
- `GET/PUT/DELETE /api/bi/dashboards/[id]` — Single dashboard CRUD
- `POST /api/bi/dashboards/[id]/clone` — Clone dashboard
- `GET/POST /api/bi/dashboards/[id]/comments` — Comment threads
- `GET/POST /api/bi/measures` — List/create measures
- `PUT/DELETE /api/bi/measures/[id]` — Update/delete measures
- `POST /api/bi/ai/chat` — DSD Intelligence AI chat

**Database Tables:**
- `bi_dashboards` — Dashboard metadata + slots (JSONB)
- `bi_measures` — User-created measures with config (JSONB)
- `bi_dashboard_comments` — Nested comments with parent_id

---

## 5. Reconciliation Engine

The reconciliation engine is the core intelligence of FinanceFlow. It automatically matches transactions across different data sources to verify that every payment received matches a bank deposit, and every expense recorded has a corresponding bank debit.

### 5.1 Matching Rules

| Rule | Threshold | Description |
|---|---|---|
| **Date Proximity** | ±3 calendar days | Transactions must fall within a 3-day window |
| **Amount Matching** | ±€0.01 | Amounts must be within 1 cent |
| **Cross-Source** | Automatic | Matches across bank ↔ gateway ↔ invoice ↔ CRM deal |

### 5.2 Reconciliation Flow

```
Bank Statement          Payment Gateway         Invoice/Order
(bankinter-eur)         (braintree-eur)         (invoice-orders)
     |                       |                       |
     └───────────┬───────────┘                       |
                 |                                   |
           Date ±3 days?  ──── YES ──→  Amount ±€0.01?
                 |                           |
                NO                      YES: MATCH!
                 |                           |
           Not matched              ┌────────┴────────┐
                                    |                  |
                               Mark both          Record link:
                             reconciled=true     matched_with=id
                                                 match_confidence
                                                 match_details
```

### 5.3 Reconciliation Fields (per row in csv_rows)

| Field | Type | Description |
|---|---|---|
| `reconciled` | Boolean | Whether this row has been matched |
| `matched_with` | String | ID of the matched row in another source |
| `matched_source` | String | Source name of the matched row |
| `match_confidence` | Number | Confidence score (0-1) |
| `match_details` | JSON | Detailed breakdown of match criteria |
| `matched_at` | Timestamp | When the match was created |

### 5.4 Reconciliation Monitoring

**URL:** `/actions/reconciliation-center`

The Reconciliation Center monitors data freshness across all sources:

| Badge Color | Threshold | Meaning |
|---|---|---|
| 🟢 Green | ≤ 2 days since last import | Data is current |
| 🟡 Yellow | ≤ 4 days | Slightly stale |
| 🟠 Orange | ≤ 7 days | Attention needed |
| 🔴 Red | > 7 days | Stale data — action required |

🔄 **RECONCILIATION WORKFLOW:**
1. Import bank statement (e.g., Bankinter EUR XLSX)
2. Import/sync payment gateway (e.g., Braintree API sync)
3. Navigate to the bank report page (e.g., `/reports/bankinter-eur`)
4. System auto-detects Braintree/Stripe/GoCardless deposits from description keywords and shows badges
5. Click badge to expand matched transactions → Verify match → Toggle "Reconciled"
6. Check Reconciliation Center for overall health across all sources

---

## 6. Master Data Management

Master data tables provide the lookup values used across all modules. **These must be populated before using AP invoices or advanced analytics.**

📋 **USER MUST SET UP (in this order):**

### 6.1 Financial Accounts (Chart of Accounts)

**URL:** `/accounts-payable/master-data/financial-accounts`

| Field | Description | Example |
|---|---|---|
| Code | Hierarchical code | `101.1`, `102.5`, `104.0` |
| Name | Account description | "DSD Courses", "Consultancies", "LAB" |
| Type | revenue / expense / asset / liability | `revenue` |
| Parent | Parent account code | `101.0` |
| Status | Active / Inactive | `Active` |

**Revenue Account Structure:**
- 101.x — Growth (Education): Courses, Mastership, Memberships, Partnerships
- 102.x — Delight (Clinic Services): Consultancies, Marketing Coaching
- 103.x — Planning Center (Design Services)
- 104.x — LAB (Manufacturing)
- 105.x — Other Income: Subscriptions, Licensing

---

### 6.2 Cost Centers (Departmental Accounts)

**URL:** `/accounts-payable/master-data/departmental-accounts`

| Field | Description |
|---|---|
| Code | Department code |
| Name | Department name |
| Budget | Annual budget allocation |
| Status | Active / Inactive |

---

### 6.3 Providers (Vendors)

**URL:** `/accounts-payable/master-data/providers`

| Field | Required? | Description |
|---|---|---|
| Code | Yes | Unique provider identifier |
| Name | Yes | Company/person name |
| Tax ID | No | NIF/CIF (Spanish) or EIN (US) |
| Email | No | Contact email |
| Country | No | Country code |
| Currency | No | Default invoice currency |
| Payment Terms | No | net_30, net_60, etc. |
| Is Active | Yes | Active / Inactive toggle |

---

### 6.4 Bank Accounts

**URL:** `/cash-management/bank-accounts`

| Field | Description |
|---|---|
| Code | Account identifier |
| Name | Display name |
| IBAN | International bank number |
| SWIFT/BIC | Bank identifier code |
| Currency | EUR / USD |
| Bank Name | Institution name |
| Country Scope | ES / US |
| Balance | Current balance (manual or auto-updated) |

---

### 6.5 Products

**URL:** `/accounts-receivable/master-data/products`

| Field | Description |
|---|---|
| Name | Product name |
| SKU | Stock Keeping Unit |
| Category | Planning, Guide Design, Implant Planning, Surgical Guide, Prosthesis, etc. |
| Type | Service / Product / Subscription |
| Default Price | Standard pricing |
| Currency | EUR / USD |
| Financial Account | Linked revenue GL code |
| Cost Center | Associated department |

---

### 6.6 Customers

**URL:** `/accounts-receivable/master-data/customers`

| Field | Description |
|---|---|
| Name | Customer/clinic name |
| Email | Contact email |
| Company | Company name |
| Country | Location |
| External IDs | Braintree ID, Stripe ID, HubSpot ID |

**Homogenization:** AI-powered duplicate detection identifies name/email variations across invoice data.

---

## 7. Integrations

### Integration Dashboard

**URL:** `/settings/integrations`

Displays connection status and last sync time for all integrations:

| Integration | Type | Status Indicators |
|---|---|---|
| **Braintree** | Payment Gateway | Active/Inactive, last sync timestamp, row count |
| **Stripe** | Payment Gateway | Active/Inactive, last sync timestamp |
| **GoCardless** | SEPA Direct Debit | Active/Inactive, last sync timestamp |
| **HubSpot** | CRM | Active/Inactive, last sync timestamp |
| **QuickBooks** | Accounting | OAuth status, last sync timestamp |
| **Slack** | Notifications | Active/Inactive |

📋 **USER MUST CONFIGURE:** API keys/secrets for each integration in the environment variables. See Section 3 for per-integration requirements.

### HubSpot Pages

| Page | URL |
|---|---|
| Web Orders | `/reports/hubspot` |
| Contacts | `/hubspot/contacts` |
| Companies | `/hubspot/companies` |
| Pipeline Analytics | `/hubspot/pipeline` |
| Sync Settings | `/hubspot/settings` |

### QuickBooks Pages

| Page | URL |
|---|---|
| Dashboard | `/reports/quickbooks-usd` |
| Invoices (A/R) | `/reports/quickbooks-usd?tab=invoices` |
| Payments Received | `/reports/quickbooks-usd?tab=payments` |
| Bills (A/P) | `/reports/quickbooks-usd?tab=bills` |
| Expenses | `/reports/quickbooks-usd?tab=expenses` |

---

## 8. Project Management (Workstream)

FinanceFlow includes a built-in project management module with Asana-level functionality.

**URL:** `/workstream`

### Core Features

| Feature | Description |
|---|---|
| **Projects** | Types: General, Financial, Engineering, Marketing, Operations, HR |
| **Views** | Board (Kanban), List, Calendar, Timeline (Gantt) |
| **Tasks** | Status (To Do, In Progress, Review, Done, Blocked), Priority (Low/Med/High/Urgent), assignees, due dates |
| **Subtasks** | Nested hierarchy with parent-child relationships |
| **Dependencies** | Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish |
| **Labels** | Color-coded, project-scoped categorization |
| **Custom Fields** | Dynamic: text, number, currency, date, select, URL, checkbox |
| **Comments** | Threaded discussions with @mentions, edit/delete |
| **Activity Log** | Complete audit trail of all changes |
| **Attachments** | File upload for tasks, comments, projects |
| **Sections** | Organize tasks into groups/columns |
| **Project Members** | Owner, Admin, Member, Viewer roles |

### Workstream Pages

| Page | URL | Purpose |
|---|---|---|
| Home | `/workstream` | Project overview, upcoming tasks, recent activity |
| Project Detail | `/workstream/[projectId]` | Full project with Board/List/Calendar/Timeline |
| My Tasks | `/workstream/my-tasks` | Personal task dashboard |
| Inbox | `/workstream/inbox` | Notification center |
| Goals | `/workstream/goals` | OKR tracking |
| Portfolios | `/workstream/portfolios` | Cross-project portfolio |
| Reporting | `/workstream/reporting` | Metrics and performance |
| Teams | `/workstream/teams` | Team management |

---

## 8.5 End-to-End Data Flows

This section details the complete data journeys through the system — from raw uploads to final reports.

### 8.5.1 Revenue → P&L Statement

Revenue flows from payment gateways and invoice orders into the P&L report via financial account classification.

```
Upload gateway CSVs (Braintree, Stripe, GoCardless)
    ↓
Parsed into csv_rows (source='braintree-eur', 'stripe-eur', etc.)
    ↓
Invoice Orders link to financial_account_code (csv_rows source='invoice-orders')
    ↓
/api/pnl/revenue aggregates by FA hierarchy (1xx codes)
    ↓
P&L page displays Revenue − Expenses = Net Income
```

| Data Source | Table | Role |
|---|---|---|
| Gateway CSVs | `csv_rows` | Transaction-level revenue data |
| Invoice Orders | `csv_rows` (source='invoice-orders') | Maps orders to financial accounts |
| AP Invoices | `invoices` | Expense data with cost center allocation |
| Financial Accounts | `financial_accounts` | Account hierarchy for P&L classification |

### 8.5.2 Bank Statement → Cashflow

Bank statements feed the three cashflow views: bank, real, and consolidated.

```
Upload bank CSV (Bankinter EUR/USD, Sabadell, Chase)
    ↓
Parsed into csv_rows (date=FECHA VALOR, amount=HABER−DEBE, source='bankinter-eur')
    ↓
Inflow/Outflow classification (amount > 0 = inflow, amount < 0 = outflow)
    ↓
API aggregation → daily/monthly cashflow (/api/executive/cashflow/*)
    ↓
Currency conversion → Consolidated view (EUR + USD unified)
```

### 8.5.3 Web Orders → AR Reconciliation

Web orders from HubSpot are linked to Braintree transactions, then matched against bank deposits.

```
HubSpot deal created (order_id, customer, deal_amount, braintree_transaction_ids)
    ↓
HubSpot CSV uploaded → csv_rows (source='hubspot', ~50 fields in custom_data)
    ↓
Braintree transaction_ids link to gateway rows (csv_rows source='braintree-*')
    ↓
Settlement batches matched to bank deposits (±€0.01 within ±3 days)
    ↓
Full chain reconciled: Order → Payment → Bank (reconciled=true)
```

### 8.5.4 AP Invoice → Departmental P&L

AP invoices are the sole source for expense tracking, linking through cost centers to departmental P&L.

```
Enter invoice in AP → Invoices (provider, amount, date + cost_center + financial_account)
    ↓
Stored in invoices table (links to: providers, cost_centers, sub_departments, financial_accounts)
    ↓
Grouped by cost_center → sub_department
    ↓
Departmental PnL: month-over-month, budget vs actual, drill-down by sub-department
```

| Master Data Table | Purpose |
|---|---|
| `providers` | Supplier registry (name, NIF, payment terms) |
| `cost_centers` | Department-level cost groups |
| `sub_departments` | Granular breakdown within cost centers |
| `financial_accounts` | Account chart (4xx-6xx = expenses) |
| `bank_accounts` | Payment bank details for scheduling |

### 8.5.5 Gateway CSV → Revenue Tracking

Each payment gateway has a dedicated upload flow that standardizes data into csv_rows.

```
Export settlement/payout report from gateway
    ↓
Upload via Reports → [Gateway] page (/api/csv/save validates + inserts)
    ↓
csv_rows created with source tag + custom_data (settlement_batch_id, order_id, ...)
    ↓
Available for reconciliation matching (Reconciliation Center)
    ↓
Revenue tracked in KPIs + Performance + P&L
```

| Gateway | Source Tags | Currencies |
|---|---|---|
| Braintree | braintree-eur, braintree-usd, braintree-gbp, braintree-aud, braintree-amex | EUR, USD, GBP, AUD |
| Stripe | stripe-eur, stripe-usd | EUR, USD |
| GoCardless | gocardless | EUR |
| PayPal | paypal | EUR |
| Pleo | pleo | EUR |

### 8.5.6 Products → Sales Insights

Invoice orders combined with product master data produce segmented sales insights.

```
Invoice orders uploaded (source='invoice-orders', financial_account_code in custom_data)
    ↓
Products linked via product_pnl_mappings (product → financial_account → segment)
    ↓
Segmentation by FA code range: 102.x = Clinics | 104.x = Lab | Other = Courses
    ↓
Sales Insights pages show revenue breakdown per segment
```

| Segment | FA Code Range | Page |
|---|---|---|
| Clinics | 102.x | `/sales-insights/clinics` |
| Lab | 104.x | `/sales-insights/lab` |
| Courses | Other codes | `/sales-insights/courses` |

---

## 9. Settings & Administration

| Page | URL | Purpose |
|---|---|---|
| **Profile** | `/settings/profile` | User name, avatar, preferences |
| **Security** | `/settings/security` | Password change, 2FA, active sessions |
| **Users** | `/settings/users` | Create, deactivate, assign roles |
| **Roles** | `/settings/roles` | Permission configuration |
| **Notifications** | `/settings/notifications` | Alert preferences |
| **Integrations** | `/settings/integrations` | External service connections |
| **System** | `/settings/system` | Company name, timezone, language, date/currency formats |
| **Audit Log** | `/settings/audit` | Complete trail of all system actions |
| **BOTella** | `/settings/botella` | AI assistant configuration |
| **Drive** | `/settings/drive` | File storage management |

📋 **INITIAL SETUP CHECKLIST:**

1. ✅ Create admin user account
2. ✅ Configure company settings (Settings → System)
3. ✅ Set up Financial Accounts (AP → Master Data → Financial Accounts)
4. ✅ Set up Cost Centers (AP → Master Data → Departmental Accounts)
5. ✅ Add Providers/Vendors (AP → Master Data → Providers)
6. ✅ Add Bank Accounts (Cash Management → Bank Accounts)
7. ✅ Configure Integrations (Settings → Integrations — API keys for Braintree, Stripe, etc.)
8. ✅ Import first bank statement
9. ✅ Sync first payment gateway
10. ✅ Enter first AP invoice or upload first Invoice Order CSV

---

## 10. Technical Specifications

### Database Schema (Key Tables)

| Table | Purpose | Typical Scale |
|---|---|---|
| `csv_rows` | All imported transactions (unified) | 30,000+ rows |
| `csv_files` | Upload metadata | 200+ files |
| `invoices` | Accounts Payable | 5,000+ invoices |
| `ar_invoices` | Accounts Receivable | 10,000+ invoices |
| `providers` | Vendor master | 200+ vendors |
| `customers` | Customer master | 2,000+ customers |
| `products` | Product catalog | 100+ products |
| `financial_accounts` | Chart of Accounts | 50+ accounts |
| `cost_centers` | Departments | 20+ centers |
| `bank_accounts` | Bank accounts | 10+ accounts |
| `system_users` | Application users | 10+ users |
| `ws_projects` | Workstream projects | 50+ projects |
| `ws_tasks` | Workstream tasks | 500+ tasks |

### Security

| Feature | Implementation |
|---|---|
| **Authentication** | Supabase Auth with PKCE flow |
| **Authorization** | Row Level Security (RLS) on all tables |
| **API Security** | Service role key for server-side only; anon key for client-side |
| **Data Isolation** | Multi-scope filtering (ES/US/GLOBAL) at query level |
| **Audit Trail** | Complete logging of all data modifications |
| **Webhook Security** | Signature verification for Braintree webhooks |

### Multi-Currency Support

| Currency | Banks | Gateways | Invoicing |
|---|---|---|---|
| **EUR** | Bankinter, Sabadell | Braintree, Stripe, GoCardless, PayPal | Full support |
| **USD** | Bankinter USD, Chase | Braintree, Stripe | Full support |
| **GBP** | — | Braintree | Full support |
| **AUD** | — | Braintree | Full support |

### Multi-Entity / Country Scope

| Scope | Coverage | Example |
|---|---|---|
| **ES** | Spanish operations | Planning Center SL, DSD ESP |
| **US** | US operations | DSD US LLC |
| **GLOBAL** | Cross-entity combined view | All entities |

### Deployment

| Component | Platform |
|---|---|
| **Application** | Vercel (auto-deploy from Git push) |
| **Database** | Supabase (managed PostgreSQL) |
| **File Storage** | Supabase Storage |
| **CI/CD** | Git push → lint + type check → auto deploy |

---

## Appendix: Quick Reference — What to Prepare Before Using Each Feature

| Feature | What User Must Have Ready |
|---|---|
| **Bank Import (Bankinter)** | XLSX file from Bankinter portal with FECHA VALOR, DESCRIPCIÓN, DEBE/HABER columns |
| **Bank Import (Sabadell)** | CSV (semicolon-separated) from Sabadell with FECHA, CONCEPTO, MOVIMIENTO |
| **Bank Import (Chase)** | CSV from Chase with POSTING DATE, DESCRIPTION, AMOUNT |
| **Braintree CSV** | Transaction Search CSV from Braintree Control Panel |
| **Braintree API Sync** | Braintree API credentials configured (merchant ID, public/private keys) |
| **Stripe Sync** | Stripe secret key configured |
| **GoCardless Sync** | GoCardless access token configured |
| **PayPal Import** | Activity download CSV from PayPal Business |
| **Pleo Sync** | Pleo API key configured |
| **Invoice Orders** | CSV/XLSX with columns: ID/NUMBER, DATE, TOTAL (plus optional CLIENT, EMAIL, ORDER, CURRENCY) |
| **HubSpot Sync** | SQL Server DW connection configured with HubSpot replicated data |
| **Craft Commerce** | Craft CMS orders export CSV |
| **QuickBooks Sync** | QuickBooks OAuth completed (client ID, secret, realm ID) |
| **AP Invoices** | Master data set up first: providers, financial accounts, cost centers, bank accounts |
| **Reconciliation** | Both sides loaded: bank statement + corresponding gateway/invoice data |
| **Sales Insights** | Invoice Orders imported with product descriptions (for auto FA classification) |
| **P&L Report** | AP invoices (expenses) + AR/invoice data (revenue) imported |
| **Cash Management** | Bank accounts configured + bank statements imported |

---

## 12. What's New

The **What's New** page (`/whats-new`) provides a chronological feed of new features, improvements, and fixes added to DSD Finance Hub.

### Lightbulb Indicator

A **💡 lightbulb icon** appears in the top navigation bar, next to the Product Manual icon. When new updates have been posted since your last visit, an **amber badge** appears on the icon to alert you.

### How It Works

1. The lightbulb icon appears next to the Product Manual (📖) icon in the header
2. An amber notification dot appears when there are unread updates
3. Click the lightbulb to open the What's New page
4. Once you view the page, the badge clears automatically (tracked via browser local storage)

### Release Notes Content

Each entry on the What's New page includes:
- **Date** — When the update was released
- **Tag** — New Feature / Improvement / Bug Fix
- **Title** — Brief name of the change
- **Description** — Summary of what changed and why
- **Feature list** — Detailed bullet points of all changes included

All content is presented in **English**.

---

*FinanceFlow — Turning financial complexity into clarity.*
