# Fix: Loading Infinito - Customers Page

**Data**: 2026-01-02  
**Prioridade**: 🚨 CRÍTICA  
**Status**: ✅ RESOLVIDO

## Problema

A página de Customers (`/accounts-receivable/master-data/customers`) apresentava **loading infinito** quando o usuário tentava usar a barra de pesquisa ou navegar pela página.

## Root Cause

O problema era causado por **ausência de `useMemo`** na variável `filteredCustomers`:

```typescript
// ❌ RUIM: Sem useMemo - causava re-render infinito
const filteredCustomers = customers.filter(
    (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.tax_id?.toLowerCase().includes(search.toLowerCase())
);
```

### Por que isso causa loading infinito?

1. **Cada render cria novo array**: Quando o componente renderiza, a operação `.filter()` cria um **novo array** na memória
2. **React detecta mudança**: React compara a referência do array anterior com o novo e detecta que são diferentes
3. **Loop infinito**: 
   - Novo render → novo array
   - Novo array → React detecta mudança
   - Detecta mudança → novo render
   - **Repetir indefinidamente** ♾️

## Solução Implementada

Envolver a computação de `filteredCustomers` com `useMemo`:

```typescript
// ✅ BOM: Com useMemo - só recalcula quando dependências mudam
const filteredCustomers = useMemo(() => {
    return customers.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.tax_id?.toLowerCase().includes(search.toLowerCase())
    );
}, [customers, search]);
```

### Por que funciona?

- **Memoização**: `useMemo` guarda o resultado em cache
- **Referência estável**: Enquanto `customers` e `search` não mudarem, retorna o **mesmo array** (mesma referência)
- **Re-render controlado**: React só detecta mudança quando as dependências realmente mudam
- **Sem loop infinito**: ✅

## Arquivos Alterados

- [src/app/accounts-receivable/master-data/customers/page.tsx](src/app/accounts-receivable/master-data/customers/page.tsx)
  - Adicionado import de `useMemo` do React
  - Envolvido `filteredCustomers` com `useMemo([customers, search])`

## Verificação

```bash
# Build bem-sucedido
npm run build
# ✓ Compiled successfully
```

## Lições Aprendidas

### Regra de Ouro: Sempre use `useMemo` para:

1. **Arrays filtrados/ordenados** dentro de componentes
2. **Objetos computados** que dependem de props/state
3. **Qualquer valor derivado** usado em renders

### Padrão Correto

```typescript
// ✅ SEMPRE assim
const processedData = useMemo(() => {
    return data
        .filter(item => condition)
        .sort((a, b) => comparison)
        .map(item => transformation);
}, [data, condition, comparison]);
```

### Quando NÃO usar `useMemo`

- Valores primitivos simples (strings, numbers, booleans)
- Dentro de funções de callback (onClick, onChange)
- Operações muito rápidas que não causam re-renders

## Prevenção Futura

### Checklist ao criar páginas com listas:

- [ ] Filtros de busca → usar `useMemo`
- [ ] Ordenação de dados → usar `useMemo`
- [ ] Paginação → usar `useMemo`
- [ ] Agregações/totalizações → usar `useMemo`
- [ ] Transformações de array → usar `useMemo`

## Problemas Relacionados

- [FIX-LOADING-INFINITE-PAYMENT-CHANNELS.md](FIX-LOADING-INFINITE-PAYMENT-CHANNELS.md) — Mesmo problema em Payment Channels
- Todas as pages de Reports já foram corrigidas com `useMemo`

---

**Autor**: GitHub Copilot  
**Revisor**: Jorge Marfetan
