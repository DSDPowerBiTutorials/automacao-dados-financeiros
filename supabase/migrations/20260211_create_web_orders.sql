-- =====================================================
-- Tabela web_orders — Orders do Craft Commerce (2025)
-- Armazena dados consolidados de Legacy + Line Items + Expanded CSVs
-- Serve como fonte definitiva para reconciliação Bank→Order
-- =====================================================

CREATE TABLE IF NOT EXISTS web_orders (
    id BIGSERIAL PRIMARY KEY,

    -- Identificadores do Craft Commerce
    craft_id TEXT NOT NULL,                     -- e.g. '4771504'
    order_reference TEXT NOT NULL,              -- e.g. 'f16cbfe' (first 7 chars of number)
    order_number TEXT,                          -- full hash e.g. 'f16cbfed8946e109573bc271c741285f'

    -- Cliente
    customer_email TEXT,
    customer_first_name TEXT,
    customer_last_name TEXT,
    customer_full_name TEXT,                    -- computed: first + last

    -- Valores
    total_price NUMERIC(12,2) DEFAULT 0,       -- storedTotalPrice
    total_paid NUMERIC(12,2) DEFAULT 0,        -- storedTotalPaid
    total_discount NUMERIC(12,2) DEFAULT 0,    -- storedTotalDiscount
    total_shipping NUMERIC(12,2) DEFAULT 0,    -- storedTotalShippingCost
    total_tax NUMERIC(12,2) DEFAULT 0,         -- storedTotalTax
    item_subtotal NUMERIC(12,2) DEFAULT 0,     -- storedItemSubtotal
    currency TEXT NOT NULL DEFAULT 'USD',

    -- Status
    paid_status TEXT,                           -- 'paid', 'unpaid', 'partial'
    order_status_id INTEGER,                    -- 12=subscription, 5=cart
    order_status TEXT,                          -- human-readable

    -- Datas
    date_ordered TIMESTAMPTZ,
    date_paid TIMESTAMPTZ,

    -- Gateway / Pagamento
    gateway_id INTEGER,                        -- 2=Braintree
    payment_source TEXT,                       -- 'braintree' (derived from gatewayId)

    -- Produtos (JSONB array from Line Items)
    -- Each item: {sku, description, qty, price, subtotal, options}
    products JSONB DEFAULT '[]'::jsonb,

    -- Braintree Transaction IDs (extracted from Expanded CSV)
    braintree_tx_ids TEXT[] DEFAULT '{}',

    -- Campos extras do Raw Data / Expanded
    hubspot_vid TEXT,                          -- field_hubspotVid from Raw Data
    subscription_reference TEXT,               -- from line item options
    order_type TEXT,                           -- 'subscriptionPayment', 'cart', etc.

    -- Endereço de billing (from Expanded)
    billing_country TEXT,
    billing_city TEXT,
    billing_organization TEXT,

    -- Reconciliação
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    reconciled_bank_row_id UUID,               -- FK to csv_rows (bank entry)

    -- Metadata
    source_data JSONB DEFAULT '{}'::jsonb,     -- raw fields not in schema
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- Índices para performance de reconciliação
-- ═══════════════════════════════════════════════

-- Primary lookup: by order reference (7-char) — used in chain-details
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_orders_reference
    ON web_orders(order_reference);

-- By craft_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_orders_craft_id
    ON web_orders(craft_id);

-- By email (for fallback matching)
CREATE INDEX IF NOT EXISTS idx_web_orders_email
    ON web_orders(customer_email);

-- By date range (for reconciliation windows)
CREATE INDEX IF NOT EXISTS idx_web_orders_date
    ON web_orders(date_ordered);

-- By currency (partition queries)
CREATE INDEX IF NOT EXISTS idx_web_orders_currency
    ON web_orders(currency);

-- By Braintree TX IDs (GIN for array contains)
CREATE INDEX IF NOT EXISTS idx_web_orders_bt_txids
    ON web_orders USING GIN(braintree_tx_ids);

-- By reconciliation status
CREATE INDEX IF NOT EXISTS idx_web_orders_reconciled
    ON web_orders(reconciled) WHERE NOT reconciled;

-- ═══════════════════════════════════════════════
-- Auto-update trigger
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_web_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_web_orders_updated_at ON web_orders;
CREATE TRIGGER trigger_web_orders_updated_at
    BEFORE UPDATE ON web_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_web_orders_updated_at();

-- ═══════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════

ALTER TABLE web_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to web_orders"
    ON web_orders FOR SELECT USING (true);

CREATE POLICY "Allow service role insert web_orders"
    ON web_orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role update web_orders"
    ON web_orders FOR UPDATE USING (true);

CREATE POLICY "Allow service role delete web_orders"
    ON web_orders FOR DELETE USING (true);

-- ═══════════════════════════════════════════════
-- Comentários
-- ═══════════════════════════════════════════════

COMMENT ON TABLE web_orders IS 'Orders do Craft Commerce 2025 — dados consolidados de Legacy + Line Items + Expanded CSVs. Fonte definitiva para reconciliação bancária.';
COMMENT ON COLUMN web_orders.order_reference IS 'Primeiros 7 caracteres do order number — usado como Order ID no Braintree';
COMMENT ON COLUMN web_orders.braintree_tx_ids IS 'Array de Braintree Transaction IDs extraídos do Expanded CSV';
COMMENT ON COLUMN web_orders.products IS 'Array JSON de line items: [{sku, description, qty, price, subtotal, options}]';
COMMENT ON COLUMN web_orders.hubspot_vid IS 'HubSpot VID do contacto (para linking com CRM)';
