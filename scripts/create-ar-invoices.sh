#!/bin/bash

# Copia o arquivo de AP Invoices e adapta para AR
cp src/app/accounts-payable/invoices/page.tsx src/app/accounts-receivable/invoices/page.tsx

# Substituições principais
sed -i 's/provider_code/customer_code/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/providers/customers/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/Provider/Customer/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/"INCURRED"/"REVENUE"/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/Incurred/Revenue/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/Accounts Payable/Accounts Receivable/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/expenses/revenues/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/Expenses/Revenues/g' src/app/accounts-receivable/invoices/page.tsx
sed -i 's/expense/revenue/g' src/app/accounts-receivable/invoices/page.tsx

echo "✅ AR Invoices page created and adapted"
