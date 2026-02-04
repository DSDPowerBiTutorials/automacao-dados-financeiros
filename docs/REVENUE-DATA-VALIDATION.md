# Guia de Validação de Dados de Receita

## Visão Geral

Este documento descreve as regras e aprendizados para manter os dados de receita sincronizados entre o Excel (`Revenue Import.csv`) e o banco de dados Supabase.

## Problemas Conhecidos e Soluções

### 1. Parse de Números no Formato Europeu

**Problema:** O Excel usa formato europeu para números (`.` como separador de milhar, `,` como decimal).
- Exemplo: `4.000,50` = 4000.50 euros

**Solução Incorreta:**
```javascript
// ❌ ERRADO - trata o ponto como decimal
parseFloat(value.replace(',', '.'))  
// "4.000,50" → "4.000.50" → 4 (parseFloat ignora tudo após segundo ponto)
```

**Solução Correta:**
```javascript
// ✅ CORRETO - remove pontos e converte vírgula
function parseEuropeanNumber(str) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}
// "4.000,50" → "400050" → "4000.50" → 4000.50
```

### 2. Duplicatas de Credit Notes

**Problema:** O Excel pode conter entradas duplicadas para a mesma fatura/credit note, gerando diferenças nos totais.

**Detecção:**
```javascript
// Agrupar por invoice_number e verificar múltiplas entradas
const byInvoice = {};
for (const record of records) {
    const key = record.invoiceNumber;
    if (!byInvoice[key]) byInvoice[key] = [];
    byInvoice[key].push(record);
}
// Duplicatas: entradas onde byInvoice[key].length > 1
```

**Correção:**
1. Identificar linhas duplicadas no CSV
2. Manter apenas uma entrada de cada invoice
3. Remover duplicatas correspondentes do banco de dados

### 3. Limite de 1000 Registros por Query (Supabase)

**Problema:** O Supabase retorna no máximo 1000 registros por query, causando agregações incompletas.

**Solução:**
```javascript
let allData = [];
let offset = 0;
const pageSize = 1000;

while (true) {
    const { data } = await supabase
        .from('csv_rows')
        .select('*')
        .range(offset, offset + pageSize - 1);
    
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    offset += pageSize;
    if (data.length < pageSize) break;
}
```

## Script de Validação

Execute o script de validação para verificar consistência:

```bash
# Validar ano atual
node scripts/validate-revenue-data.js

# Validar ano específico
node scripts/validate-revenue-data.js 2025
```

## Colunas do Excel (Revenue Import.csv)

| Índice | Coluna | Uso |
|--------|--------|-----|
| 0 | Invoice Date | Data no formato DD/MM/YYYY |
| 4 | LINHA | Financial Account (ex: "101.1 - DSD Courses") |
| 11 | AR Incurred | Valor em EUR (formato europeu) |
| 17 | Invoice Number | Identificador único da fatura |

## Campos em custom_data (csv_rows)

```json
{
    "financial_account": "101.1",
    "financial_account_code": "101.1",
    "invoice_number": "#DSDES...",
    "invoice_date": "2025-03-15",
    "customer_name": "...",
    "financial_dimension": "Incurred"
}
```

## Checklist de Importação

- [ ] Verificar formato de números (europeu vs americano)
- [ ] Executar `validate-revenue-data.js` antes e depois da importação
- [ ] Verificar duplicatas por invoice_number
- [ ] Confirmar paginação ao buscar dados do banco
- [ ] Comparar totais por FA e mês

## Histórico de Correções

### 2026-02-04: Credit Notes Duplicados FA 101.1 Maio 2025
- **Problema:** 4 credit notes no CSV quando deveriam ser 2
- **Impacto:** €8.000 de diferença (€-16.000 em vez de €-8.000)
- **Correção:** 
  - Removidas 2 linhas duplicadas do CSV (31188, 31244)
  - Removidos 2 registros duplicados do banco
- **Invoice afetados:** Credit Note R2025-0073, Credit Note R2025-0074
