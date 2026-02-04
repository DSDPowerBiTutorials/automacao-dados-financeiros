# Copilot Instructions — `automacao-dados-financeiros`

## Project Overview
Financial reconciliation system built with **Next.js (App Router) + TypeScript** and **Supabase (Postgres)**. Processes CSV uploads from multiple banks (Bankinter EUR/USD, Sabadell) and payment sources (Braintree, Stripe, GoCardless), performs automated reconciliation matching transactions within ±3 days and approximate amounts.

---

## Comunicação (obrigatório)
- Sempre responder em **português**.
- Ser **direto e resumido**; não colar blocos de código longos na conversa.
- Só explicar mais quando houver problema e for necessária ação do usuário.
- Formato padrão de resposta (usar sempre):

"Problema : <texto>\nPossível causa : <texto>\nSolução : <texto>\nTipo : Agente ou Usuário"

**Key insight:** System handles multi-currency, multi-source reconciliation where data flows from CSV uploads → Supabase `csv_rows` table → report pages (`/reports/{source}`).

---

## Architecture & Data Flow

### Core Tables
- **`csv_rows`**: Processed transaction lines with standardized schema: `id`, `source`, `date`, `description`, `amount`, `reconciled`, `custom_data` (JSONB for source-specific fields)
- **`csv_files`** (bucket): Raw CSV files stored in Supabase Storage

### Route Structure
- `/reports/{source}` pages (e.g., `/reports/bankinter-eur`, `/reports/braintree-eur`) → edit/delete rows, mark as reconciled
- `/accounts-payable/invoices` → master data forms (providers, bank accounts, cost centers)
- `/actions/reconciliation-center` → cross-source reconciliation matching
- `/dashboard` → summary statistics

### Data Processing Pattern
1. User uploads CSV → API route `/api/csv/{handler}` validates & persists to `csv_files` bucket
2. Rows parsed and inserted into `csv_rows` table with `source` field for grouping
3. Reconciliation logic in report pages compares dates and amounts; updates `reconciled` flag

---

## Critical Developer Conventions

### Interfaces & Type Safety
Preserve existing interfaces in [src/lib/database.ts](src/lib/database.ts):
- `CSVRow`: unified row type with source-specific optional fields (`fecha_contable`, `customer_name`, etc.)
- `CSVFile`: metadata for uploads
- `CSVRowDB`: Supabase schema mapping

### CSV Column Mapping
For bank statements, follow Bankinter pattern in [docs/codex-guidelines.md](docs/codex-guidelines.md#-upload-e-integração-com-supabase):
```
date: FECHA VALOR (ISO format)
description: DESCRIPCIÓN
amount: (HABER - DEBE)  // subtract debe from haber
```

### Number Parsing (European Format)
**CRITICAL:** Excel CSVs use European number format (`.` = thousands, `,` = decimal).
```typescript
// ❌ WRONG - treats dot as decimal
parseFloat(value.replace(',', '.'))  // "4.000,50" → 4

// ✅ CORRECT - removes dots, converts comma
function parseEuropeanNumber(str: string): number {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}
// "4.000,50" → 4000.50
```

### Revenue Data Validation
- See [docs/REVENUE-DATA-VALIDATION.md](docs/REVENUE-DATA-VALIDATION.md) for complete rules
- Always run `node scripts/validate-revenue-data.js [year]` after CSV imports
- Check for duplicate invoices/credit notes in source data
- Use pagination when querying Supabase (limit 1000 per query)

### Supabase Client Usage
- Import from `@/lib/supabase`: `supabase` (public, RLS-aware) and `supabaseAdmin` (server-side only)
- Never expose keys; rely on environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- All database calls use `async/await` with `try/catch` and descriptive error logging

### Styling & UI Components
- Use **shadcn/ui** components from `/components/ui` (Button, Card, Input, Select, Dialog, etc.)
- Tailwind classes: consistent grays (`text-gray-700`, `bg-gray-50`, `border-gray-200`), dark mode support
- Icons: **lucide-react** (CheckCircle2, AlertCircle, Loader2 for loading states)
- Report page patterns in [src/app/reports/bankinter/page.tsx](src/app/reports/bankinter/page.tsx)

### API Routes
CSV endpoints in `src/app/api/csv/`:
- `/api/csv/save` — persists file metadata + rows
- `/api/csv-rows/` — query/update individual rows
- Each handler validates input, returns `{ success, error }` JSON

---

## Workflows & Commands

### Development
```bash
npm run dev          # Start dev server (0.0.0.0:3000)
npm run lint         # ESLint + Prettier check
npm run build        # Next.js production build
npm run verify:dev   # Custom verification (see scripts/)
```

### Key Auto-fix Scripts
- [scripts/codex-bankinter-self-learning.js](scripts/codex-bankinter-self-learning.js) — Detect upload errors, auto-update guidelines
- [scripts/codex-repair-workflows.js](scripts/codex-repair-workflows.js) — Sync data, repair inconsistencies
- [scripts/deploy-preview.sh](scripts/deploy-preview.sh) — Vercel preview deployment

### CI/CD
- Branch `main` → auto-deploy to Vercel
- Merge must pass lint & type checks

---

## Code Patterns & Gotchas

### Reconciliation Logic
In [src/app/actions/reconciliation-center/page.tsx](src/app/actions/reconciliation-center/page.tsx):
- Match transactions where `Math.abs(date1 - date2) <= 3 days` AND `Math.abs(amount1 - amount2) < 0.01`
- Mark `reconciled: true` after match; update `matched_with` field

### Number Parsing (European Decimals)
Bankinter reports use comma (`,`) for decimals. Always use `parseFloat(value.replace(",", "."))`  
See [src/app/reports/bankinter/page.tsx#L80](src/app/reports/bankinter/page.tsx#L80-L90)

### Scope & Company Context
Multiple companies may share the system. Check [src/contexts/company-view-context.tsx](src/contexts/company-view-context.tsx) for scoping logic; filter queries by `scope` (e.g., "ES" for Spain).

### Master Data Dropdowns
In invoices page, master data (providers, bank accounts, cost centers) loaded via `Promise.all()`:
```typescript
const [providersRes, bankAccountsRes, ...] = await Promise.all([
  supabase.from("providers").select("*").eq("is_active", true),
  // ...
]);
```

---

## File Organization & Key Files
- **Config:** [src/config/navigation.ts](src/config/navigation.ts) — sidebar structure
- **Shared hooks:** [src/hooks/use-toast.ts](src/hooks/use-toast.ts), [src/hooks/use-mobile.ts](src/hooks/use-mobile.ts)
- **Utilities:** [src/lib/formatters.ts](src/lib/formatters.ts) `formatDate()`, `formatCurrency()`, `formatTimestamp()`
- **Source mapping:** [src/lib/sourceConfig.json](src/lib/sourceConfig.json) — dynamically add new bank/payment sources

---

## Common Edits & Safety Checks

Before editing any file:
1. Preserve all imports and function signatures
2. Respect ESLint + Prettier formatting
3. If changing Supabase schema, update `CSVRow` interface and guidelines
4. Add unit tests or manual verification for reconciliation logic
5. Document new API endpoints or query patterns in [docs/](docs/)

**Do not:** modify `.env.local` files, expose API keys, alter CI/CD workflows without approval.

