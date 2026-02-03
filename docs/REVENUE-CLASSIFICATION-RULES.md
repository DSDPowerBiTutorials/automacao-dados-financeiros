# Regras de Classificação de Revenue - Financial Accounts

Este documento descreve as regras de negócio para classificação de receitas por Financial Account no sistema P&L.

## Visão Geral

A classificação depende de:
1. **Categoria do produto** (Delight, Planning Center, LAB)
2. **Geografia** (ROW = Rest of World, AMEX = USA)
3. **Histórico do cliente** (New = primeira compra na categoria, Contracted = recorrente)
4. **Nível de subscrição** (Level 1, 2, 3, Not a Subscriber)

---

## 101.0 - Growth

| Código | Nome | Critério |
|--------|------|----------|
| 101.1 | DSD Courses | Cursos DSD |
| 101.2 | Others Courses | Outros cursos |
| 101.3 | Mastership | Mastership programs |
| 101.4 | PC Membership | Planning Center Membership |
| 101.5 | Partnerships | Parcerias |
| 101.6 | Level 2 Allocation | Alocação Level 2 |

**Regra:** Usar classificação original do CSV.

---

## 102.0 - Delight (Monthly Fees / Clinic Subscriptions)

| Código | Nome | Critério |
|--------|------|----------|
| 102.1 | Contracted ROW | Cliente recorrente, fora dos EUA |
| 102.2 | Contracted AMEX | Cliente recorrente, EUA |
| 102.3 | Level 3 New ROW | Primeira compra na categoria, fora dos EUA |
| 102.4 | Level 3 New AMEX | Primeira compra na categoria, EUA |
| 102.5 | Consultancies | Consultoria |
| 102.6 | Marketing Coaching | Coaching de marketing |
| 102.7 | Others | Outros |

### Regra New vs Contracted

```
SE é a primeira transação do cliente na categoria Delight:
  → Cliente é NEW (102.3 ou 102.4)
SENÃO:
  → Cliente é CONTRACTED (102.1 ou 102.2)

SE país está em [USA, United States, US, Estados Unidos]:
  → Sufixo AMEX (102.2 ou 102.4)
SENÃO:
  → Sufixo ROW (102.1 ou 102.3)
```

### Transição New → Contracted

Um cliente classificado como **New** no mês X deve ser **Contracted** no mês X+1:

| Cliente | Mês | Histórico Anterior | Classificação |
|---------|-----|--------------------|---------------|
| João | Jan/2024 | Nenhum | **102.3** (New ROW) |
| João | Fev/2024 | Jan/2024 | **102.1** (Contracted ROW) |
| João | Mar/2024 | Jan, Fev/2024 | **102.1** (Contracted ROW) |
| Maria (USA) | Mar/2024 | Nenhum | **102.4** (New AMEX) |
| Maria (USA) | Abr/2024 | Mar/2024 | **102.2** (Contracted AMEX) |

---

## 103.0 - Planning Center

| Código | Nome | Critério |
|--------|------|----------|
| 103.1 | Level 3 ROW | Clinic recorrente, fora dos EUA |
| 103.2 | Level 3 AMEX | Clinic recorrente, EUA |
| 103.3 | Level 3 New ROW | Clinic novo, fora dos EUA |
| 103.4 | Level 3 New AMEX | Clinic novo, EUA |
| 103.5 | Level 2 | PC Membership (não é Clinic) |
| 103.6 | Level 1 | Apenas Level 1 Subscription |
| 103.7 | Not a Subscriber | Sem assinatura |
| 103.8 | Level 2 Allocation | Alocação Level 2 |
| 103.9 | Level 3 Allocation | Alocação Level 3 |

### Regra de Subscriber Level

```
SE cliente é Clinic (isClinic = Yes):
  → Level 3
SENÃO SE PC Points > 0 (tem PC Membership):
  → Level 2
SENÃO SE tem Level 1 Subscription:
  → Level 1
SENÃO:
  → Not a Subscriber
```

### Regra New vs Contracted (para Level 3)

Mesma lógica do 102.0 - primeira transação na categoria = New.

---

## 104.0 - LAB

| Código | Nome | Critério |
|--------|------|----------|
| 104.1 | Level 3 ROW | Clinic recorrente, fora dos EUA |
| 104.2 | Level 3 AMEX | Clinic recorrente, EUA |
| 104.3 | Level 3 New ROW | Clinic novo, fora dos EUA |
| 104.4 | Level 3 New AMEX | Clinic novo, EUA |
| 104.5 | Level 2 | PC Membership (não é Clinic) |
| 104.6 | Level 1 | Apenas Level 1 Subscription |
| 104.7 | Not a Subscriber | Sem assinatura |

Mesmas regras do 103.0.

---

## 105.0 - Other Income

| Código | Nome | Critério |
|--------|------|----------|
| 105.1 | Level 1 Subscriptions | Assinaturas Level 1 |
| 105.2 | Other | Outros |
| 105.4 | Other Marketing | Outros marketing |

**Regra:** Usar classificação original do CSV.

---

## Identificação de País (ROW vs AMEX)

```javascript
function isUSA(country) {
  const usaVariants = ['usa', 'united states', 'us', 'estados unidos', 'eua', 'u.s.a.', 'u.s.'];
  return usaVariants.includes(country?.toLowerCase()?.trim());
}

// Se isUSA(country) → AMEX
// Senão → ROW
```

---

## Implementação Técnica

### Arquivo de Importação
`scripts/import-revenue-2024-2025.js`

### Função Principal
`determineFinancialAccount(cols, email, date, clientHistory)`

### Fluxo de Processamento

1. **Buscar Histórico do Banco:** Consultar `csv_rows` para obter primeiras datas existentes
2. **Primeira Passada CSV:** Construir mapa de histórico do CSV
3. **Mesclar Históricos:** Usar data mais antiga entre banco e CSV
4. **Segunda Passada:** Classificar cada transação com base no histórico mesclado

### Considerações de Reimportação

Ao reimportar dados:
- Verificar histórico existente no banco (`csv_rows` com `source='invoice-orders'`)
- Cliente que já tem transações anteriores NÃO é "New", mesmo que não esteja no CSV atual
- Usar data mais antiga entre: primeira data no CSV e primeira data no banco

---

## Histórico de Mudanças

| Data | Mudança |
|------|---------|
| 2026-02-03 | Documentação inicial criada |
| 2026-02-03 | Importação de 18.224 registros de 2024-2025 |
