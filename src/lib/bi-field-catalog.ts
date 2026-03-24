/**
 * Field catalog for BI Measure Creator.
 * Groups available database columns by data source so users
 * can pick exactly which column a measure should operate on.
 */

export interface FieldDefinition {
    /** Unique key stored in measure config, e.g. "ap.amount" */
    key: string;
    /** Display label */
    label: string;
    /** Data type hint (used for validation & UI) */
    dataType: "number" | "text" | "date" | "boolean" | "currency";
}

export interface FieldGroup {
    /** Source identifier */
    id: string;
    /** Display label shown in the selector */
    label: string;
    /** Optional parent group (for nested display) */
    parentLabel?: string;
    fields: FieldDefinition[];
}

export const FIELD_CATALOG: FieldGroup[] = [
    // ── Accounts Payable ──────────────────────────────────────
    {
        id: "accounts-payable",
        label: "Accounts Payable",
        fields: [
            { key: "ap.invoice_amount", label: "Invoice Amount", dataType: "number" },
            { key: "ap.paid_amount", label: "Paid Amount", dataType: "number" },
            { key: "ap.eur_exchange", label: "EUR Exchange Rate", dataType: "number" },
            { key: "ap.input_date", label: "Input Date", dataType: "date" },
            { key: "ap.invoice_date", label: "Invoice Date", dataType: "date" },
            { key: "ap.benefit_date", label: "Benefit Date", dataType: "date" },
            { key: "ap.due_date", label: "Due Date", dataType: "date" },
            { key: "ap.schedule_date", label: "Schedule Date", dataType: "date" },
            { key: "ap.payment_date", label: "Payment Date", dataType: "date" },
            { key: "ap.invoice_type", label: "Invoice Type", dataType: "text" },
            { key: "ap.entry_type", label: "Entry Type", dataType: "text" },
            { key: "ap.description", label: "Description", dataType: "text" },
            { key: "ap.invoice_number", label: "Invoice Number", dataType: "text" },
            { key: "ap.currency", label: "Currency", dataType: "text" },
            { key: "ap.paid_currency", label: "Paid Currency", dataType: "text" },
            { key: "ap.financial_account_code", label: "Financial Account Code", dataType: "text" },
            { key: "ap.financial_account_name", label: "Financial Account Name", dataType: "text" },
            { key: "ap.provider_code", label: "Provider Code", dataType: "text" },
            { key: "ap.bank_account_code", label: "Bank Account Code", dataType: "text" },
            { key: "ap.payment_method_code", label: "Payment Method", dataType: "text" },
            { key: "ap.cost_type_code", label: "Cost Type", dataType: "text" },
            { key: "ap.dep_cost_type_code", label: "Dep Cost Type", dataType: "text" },
            { key: "ap.cost_center_code", label: "Cost Center", dataType: "text" },
            { key: "ap.sub_department_code", label: "Sub Department", dataType: "text" },
            { key: "ap.course_code", label: "Course Code", dataType: "text" },
            { key: "ap.scope", label: "Scope", dataType: "text" },
            { key: "ap.country_code", label: "Country Code", dataType: "text" },
            { key: "ap.payment_status", label: "Payment Status", dataType: "text" },
            { key: "ap.dre_impact", label: "DRE Impact", dataType: "boolean" },
            { key: "ap.cash_impact", label: "Cash Impact", dataType: "boolean" },
            { key: "ap.is_intercompany", label: "Is Intercompany", dataType: "boolean" },
            { key: "ap.is_reconciled", label: "Is Reconciled", dataType: "boolean" },
            { key: "ap.is_split", label: "Is Split", dataType: "boolean" },
            { key: "ap.notes", label: "Notes", dataType: "text" },
            { key: "ap.created_at", label: "Created At", dataType: "date" },
            { key: "ap.updated_at", label: "Updated At", dataType: "date" },
        ],
    },

    // ── Accounts Receivable — Invoice Orders ──────────────────
    {
        id: "ar-invoice-orders",
        label: "Invoice Orders",
        parentLabel: "Accounts Receivable",
        fields: [
            { key: "ario.amount", label: "Amount", dataType: "number" },
            { key: "ario.discount", label: "Discount", dataType: "number" },
            { key: "ario.date", label: "Date", dataType: "date" },
            { key: "ario.invoice_date", label: "Invoice Date", dataType: "date" },
            { key: "ario.order_date", label: "Order Date", dataType: "date" },
            { key: "ario.invoice_number", label: "Invoice Number", dataType: "text" },
            { key: "ario.order_number", label: "Order Number", dataType: "text" },
            { key: "ario.order_status", label: "Order Status", dataType: "text" },
            { key: "ario.description", label: "Products / Description", dataType: "text" },
            { key: "ario.client", label: "Client", dataType: "text" },
            { key: "ario.email", label: "Email", dataType: "text" },
            { key: "ario.currency", label: "Currency", dataType: "text" },
            { key: "ario.scope", label: "Scope", dataType: "text" },
            { key: "ario.financial_account", label: "Financial Account", dataType: "text" },
            { key: "ario.source", label: "Source", dataType: "text" },
            { key: "ario.reconciled", label: "Reconciled", dataType: "boolean" },
            { key: "ario.created_at", label: "Created At", dataType: "date" },
        ],
    },

    // ── Accounts Receivable — Web Orders ──────────────────────
    {
        id: "ar-web-orders",
        label: "Web Orders",
        parentLabel: "Accounts Receivable",
        fields: [
            { key: "arwo.total_amount", label: "Total Amount", dataType: "number" },
            { key: "arwo.charged_amount", label: "Charged Amount", dataType: "number" },
            { key: "arwo.invoice_date", label: "Invoice Date", dataType: "date" },
            { key: "arwo.order_date", label: "Order Date", dataType: "date" },
            { key: "arwo.due_date", label: "Due Date", dataType: "date" },
            { key: "arwo.payment_date", label: "Payment Date", dataType: "date" },
            { key: "arwo.invoice_number", label: "Invoice Number", dataType: "text" },
            { key: "arwo.order_id", label: "Order ID", dataType: "text" },
            { key: "arwo.order_status", label: "Order Status", dataType: "text" },
            { key: "arwo.deal_status", label: "Deal Status", dataType: "text" },
            { key: "arwo.products", label: "Products", dataType: "text" },
            { key: "arwo.company_name", label: "Company Name", dataType: "text" },
            { key: "arwo.client_name", label: "Client Name", dataType: "text" },
            { key: "arwo.email", label: "Email", dataType: "text" },
            { key: "arwo.currency", label: "Currency", dataType: "text" },
            { key: "arwo.payment_method", label: "Payment Method", dataType: "text" },
            { key: "arwo.billing_entity", label: "Billing Entity", dataType: "text" },
            { key: "arwo.discount_code", label: "Discount Code", dataType: "text" },
            { key: "arwo.discount_names", label: "Discount Names", dataType: "text" },
            { key: "arwo.status", label: "Status", dataType: "text" },
            { key: "arwo.country_code", label: "Country Code", dataType: "text" },
            { key: "arwo.scope", label: "Scope", dataType: "text" },
            { key: "arwo.source", label: "Source", dataType: "text" },
            { key: "arwo.note", label: "Note", dataType: "text" },
            { key: "arwo.reconciled", label: "Reconciled", dataType: "boolean" },
            { key: "arwo.payment_reference", label: "Payment Reference", dataType: "text" },
            { key: "arwo.created_at", label: "Created At", dataType: "date" },
        ],
    },
];

/** Flat list of all fields for quick lookup */
export function getAllFields(): FieldDefinition[] {
    return FIELD_CATALOG.flatMap((g) => g.fields);
}

/** Lookup field by key */
export function getFieldByKey(key: string): FieldDefinition | undefined {
    return getAllFields().find((f) => f.key === key);
}
