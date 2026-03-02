-- Add GoCardless as a provider for gateway fee invoices
-- (Paypal, Stripe, Braintree already exist)
INSERT INTO providers (code, name, is_active)
VALUES ('GOCARDLESS', 'GoCardless', true)
ON CONFLICT (code) DO NOTHING;
