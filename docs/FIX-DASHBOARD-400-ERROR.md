# Fix: Erro 400 em Queries do Supabase com JOIN

## 🔍 Problema Identificado

Erro no console:
```
GET .../invoices?select=provider_code,invoice_amount,providers(name) 400 (Bad Request)
```

Este erro aparecia no Dashboard ao tentar carregar dados de vendors com JOIN.

## ❌ Causa do Erro

**Query Incorreta:**
```typescript
const { data: vendors } = await supabase
  .from('invoices')
  .select('provider_code, invoice_amount, providers(name)')
  .eq('invoice_type', 'INCURRED')
  .not('provider_code', 'is', null);
```

**Por que falha:**
1. **Foreign Key não configurada** - Supabase precisa de FK explícita entre `invoices.provider_code` e `providers.code`
2. **RLS (Row Level Security)** - Políticas podem estar bloqueando o acesso à tabela `providers`
3. **Sintaxe do JOIN** - Supabase espera nome de coluna que seja FK, não código arbitrário

## ✅ Solução Implementada

**Query Corrigida - Buscar separadamente:**
```typescript
const loadVendorData = async () => {
  try {
    // 1. Buscar invoices
    const { data: vendors, error: vendorsError } = await supabase
      .from('invoices')
      .select('provider_code, invoice_amount')
      .eq('invoice_type', 'INCURRED')
      .not('provider_code', 'is', null);

    if (vendorsError) {
      console.error('Error loading vendors:', vendorsError);
      return;
    }

    // 2. Buscar providers separadamente
    let providersMap: Record<string, string> = {};
    try {
      const { data: providers } = await supabase
        .from('providers')
        .select('code, name');
      
      if (providers) {
        providersMap = Object.fromEntries(
          providers.map(p => [p.code, p.name])
        );
      }
    } catch (error) {
      console.log('Providers table not available, using codes');
    }

    // 3. Fazer merge no cliente
    const grouped: Record<string, { name: string; amount: number }> = {};
    vendors?.forEach(vendor => {
      if (vendor.provider_code) {
        if (!grouped[vendor.provider_code]) {
          grouped[vendor.provider_code] = {
            name: providersMap[vendor.provider_code] || vendor.provider_code,
            amount: 0,
          };
        }
        grouped[vendor.provider_code].amount += vendor.invoice_amount;
      }
    });

    // 4. Ordenar e pegar top 10
    const sorted = Object.values(grouped)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    setVendorData(sorted);
  } catch (error) {
    console.error('Error loading vendor data:', error);
  }
};
```

## 🎯 Vantagens da Solução

1. **Robusta** - Funciona mesmo se tabela `providers` não existir
2. **Sem dependência de FK** - Não precisa configurar foreign keys
3. **Tratamento de erro** - Usa código como fallback se nome não encontrado
4. **Performance aceitável** - Duas queries simples são rápidas

## 📋 Quando Usar JOIN vs Queries Separadas

### ✅ Use JOIN (Sintaxe do Supabase):
```typescript
// QUANDO há foreign key configurada corretamente
const { data } = await supabase
  .from('invoices')
  .select('*, providers!inner(*)')  // Note o !inner
  .eq('invoice_type', 'INCURRED');
```

**Requisitos:**
- Foreign key entre tabelas configurada no Supabase
- RLS permite acesso a ambas tabelas
- Nome da relação coincide com nome da tabela ou FK

### ✅ Use Queries Separadas (Mais Seguro):
```typescript
// QUANDO não tem certeza sobre FK ou RLS
const { data: invoices } = await supabase
  .from('invoices')
  .select('*');

const { data: providers } = await supabase
  .from('providers')
  .select('*');

// Fazer merge no cliente
const result = invoices.map(inv => ({
  ...inv,
  provider_name: providers.find(p => p.code === inv.provider_code)?.name
}));
```

**Vantagens:**
- Funciona sempre
- Mais controle sobre erros
- Não depende de configuração de FK
- Permite fallbacks

## 🔧 Como Configurar FK Corretamente (Opcional)

Se quiser usar JOINs no futuro:

1. **No Supabase Dashboard:**
   - Table Editor > invoices
   - Coluna `provider_code`
   - Add Foreign Key Relation
   - Reference table: `providers`
   - Reference column: `code`

2. **Ou via SQL:**
```sql
ALTER TABLE invoices
ADD CONSTRAINT fk_provider_code
FOREIGN KEY (provider_code)
REFERENCES providers(code);
```

3. **Depois use JOIN:**
```typescript
const { data } = await supabase
  .from('invoices')
  .select('*, providers!fk_provider_code(*)')
  .eq('invoice_type', 'INCURRED');
```

## 🚫 Erros Comuns a Evitar

### ❌ JOIN sem FK:
```typescript
// NÃO funciona sem FK configurada
.select('*, providers(name)')
```

### ❌ Nome de relação errado:
```typescript
// Se FK se chama "fk_provider", isso falha:
.select('*, providers(*)')

// Use o nome correto:
.select('*, providers!fk_provider(*)')
```

### ❌ Não tratar erro:
```typescript
// Pode crashar a aplicação
const { data } = await supabase.from('invoices').select('*, providers(*)');
```

## ✅ Padrão Recomendado

**Sempre:**
1. Busque dados separadamente primeiro
2. Trate erros individualmente
3. Use fallbacks (ex: código se nome não encontrado)
4. Documente quando usar JOIN (com FK) vs separado

**Exemplo Completo:**
```typescript
const loadData = async () => {
  try {
    // Query principal
    const { data: mainData, error: mainError } = await supabase
      .from('invoices')
      .select('*')
      .eq('type', 'INCURRED');

    if (mainError) throw mainError;

    // Dados relacionados (opcional)
    let relatedMap = {};
    try {
      const { data: related } = await supabase
        .from('providers')
        .select('code, name');
      
      if (related) {
        relatedMap = Object.fromEntries(
          related.map(r => [r.code, r])
        );
      }
    } catch (err) {
      console.warn('Related data not available:', err);
      // Continua mesmo sem dados relacionados
    }

    // Merge e processar
    const processed = mainData.map(item => ({
      ...item,
      provider_name: relatedMap[item.provider_code]?.name || item.provider_code
    }));

    setData(processed);
  } catch (error) {
    console.error('Error loading data:', error);
    setData([]); // Fallback para array vazio
  }
};
```

## 📝 Arquivos Modificados

- **[src/app/dashboard/page.tsx](../../src/app/dashboard/page.tsx)** - Função `loadVendorData` corrigida

## 🎯 Resultado

✅ Dashboard carrega sem erros 400  
✅ Vendors aparecem (com nome se disponível, código como fallback)  
✅ Aplicação não quebra se tabela providers não existir  
✅ Tratamento de erro robusto  

---

**Data:** 2026-01-02  
**Tipo:** Fix de Query  
**Status:** ✅ Resolvido
