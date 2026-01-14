-- Migration: Create products table for Accounts Receivable
-- Date: 2026-01-14

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS product_merges
CASCADE;
DROP TABLE IF EXISTS products
CASCADE;

-- Create products table
CREATE TABLE products
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    default_price DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'EUR',

    -- Financial account association
    financial_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
    financial_account_code VARCHAR(50),

    -- Department/Cost Center
    department VARCHAR(100),
    cost_center_id UUID,
    cost_center_code VARCHAR(50),

    -- Categorization
    category VARCHAR(100),
    product_type VARCHAR(50) DEFAULT 'service',
    -- 'service', 'product', 'subscription'

    -- Scope (ES, US, GLOBAL)
    scope VARCHAR(10) DEFAULT 'GLOBAL',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Alternative names for matching (duplicates, typos, etc.)
    alternative_names TEXT
    [] DEFAULT '{}',
    
    -- Merged into (for unified products)
    merged_into_id UUID REFERENCES products
    (id) ON
    DELETE
    SET NULL
    ,
    
    -- Metadata
    source VARCHAR
    (100), -- Where this product was originally found
    external_id VARCHAR
    (255), -- External system ID
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW
    (),
    updated_at TIMESTAMPTZ DEFAULT NOW
    ()
);

    -- Create product_merges table to track merge history
    CREATE TABLE product_merges
    (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_product_id UUID NOT NULL,
        source_product_name VARCHAR(255) NOT NULL,
        source_product_code VARCHAR(50),
        target_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        merged_by VARCHAR(255),
        merged_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT
    );

    -- Create indexes
    CREATE INDEX idx_products_name ON products(name);
    CREATE INDEX idx_products_code ON products(code);
    CREATE INDEX idx_products_financial_account ON products(financial_account_id);
    CREATE INDEX idx_products_category ON products(category);
    CREATE INDEX idx_products_scope ON products(scope);
    CREATE INDEX idx_products_is_active ON products(is_active);
    CREATE INDEX idx_products_merged_into ON products(merged_into_id);
    CREATE INDEX idx_product_merges_target ON product_merges(target_product_id);

    -- Create function to auto-update updated_at
    CREATE OR REPLACE FUNCTION update_products_updated_at
    ()
RETURNS TRIGGER AS $$
    BEGIN
    NEW.updated_at = NOW
    ();
    RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

    -- Create trigger for updated_at
    CREATE TRIGGER trigger_products_updated_at
    BEFORE
    UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at
    ();

    -- Insert initial DSD products based on known categories
    INSERT INTO products
        (code, name, description, default_price, currency, category, product_type, scope)
    VALUES
        ('DSD-MC-001', 'DSD Masterclass', 'DSD Masterclass - Premium dental training program', 6950.00, 'EUR', 'Premium Course', 'service', 'GLOBAL'),
        ('DSD-RES-001', 'DSD Residency', 'DSD Residency - Advanced certification program', 5950.00, 'EUR', 'Premium Course', 'service', 'GLOBAL'),
        ('DSD-CLF-001', 'DSD Clinic Fee', 'DSD Clinic Monthly Fee - Partner clinic subscription', 4500.00, 'EUR', 'Clinic Fee', 'subscription', 'GLOBAL'),
        ('DSD-WKS-001', 'DSD Workshop', 'DSD Workshop - Hands-on training sessions', 1500.00, 'EUR', 'Workshop/Module', 'service', 'GLOBAL'),
        ('DSD-COA-001', 'DSD Coaching', 'DSD Coaching - Personalized coaching sessions', 2500.00, 'EUR', 'Standard Course', 'service', 'GLOBAL'),
        ('DSD-PLN-001', 'DSD Planning', 'DSD Planning - Case planning service', 500.00, 'EUR', 'Workshop/Module', 'service', 'GLOBAL'),
        ('DSD-APP-001', 'DSD App Subscription', 'DSD App - Software subscription', 199.00, 'EUR', 'Subscription', 'subscription', 'GLOBAL'),
        ('DSD-CON-001', 'DSD Concept', 'DSD Concept - Introduction course', 750.00, 'EUR', 'Workshop/Module', 'service', 'GLOBAL'),
        ('DSD-CRT-001', 'DSD Certification', 'DSD Certification - Professional certification', 3500.00, 'EUR', 'Standard Course', 'service', 'GLOBAL'),
        ('DSD-CRS-001', 'DSD Course', 'DSD Course - General course category', 2000.00, 'EUR', 'Standard Course', 'service', 'GLOBAL'),
        ('DSD-SUB-001', 'DSD Subscription', 'DSD Subscription - General subscription', 250.00, 'EUR', 'Subscription', 'subscription', 'GLOBAL'),
        ('DSD-OTH-001', 'Produto DSD', 'Produto DSD - Outros produtos', 0.00, 'EUR', 'Other', 'service', 'GLOBAL');

    -- Enable RLS
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE product_merges ENABLE ROW LEVEL SECURITY;

    -- Create policies for products
    CREATE POLICY "Allow all for products" ON products FOR ALL USING
    (true);
    CREATE POLICY "Allow all for product_merges" ON product_merges FOR ALL USING
    (true);

-- Comment on table
COMMENT ON TABLE products IS 'Master data table for DSD products - used in Accounts Receivable';
COMMENT ON TABLE product_merges IS 'History of product merges for tracking unified products';
