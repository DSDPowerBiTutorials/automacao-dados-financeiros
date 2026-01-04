# HubSpot SQL - Relações de Tabelas e Dados Enriquecidos

## Resumo Executivo

✅ **SIM!** As 239 colunas na tabela `Deal` são apenas o começo. Você pode enriquecer os deals com:
- **Cliente**: Nome, email, telefone, empresa (via Contact + Company)
- **Produto**: Descrição, preço, categoria (via LineItem ou DoctorsProducts)
- **Histórico**: Todas as atividades, comunicações, estágios (via Associations)

**Total de tabelas disponíveis: 169 tabelas**
**Total de colunas em todo o banco: +10,000 colunas**

---

## Estrutura de Relações

### 1️⃣ Deal → Contact (Pessoa/Cliente)

**Relação:**
```
Deal (DealId) 
  → DealContactAssociations (DealId ↔ VId)
    → Contact (VId - 1024 colunas!)
```

**Colunas úteis de Contact:**
- `firstname` + `lastname` → Nome completo do cliente
- `email` → Email (pode ter múltiplos: email, emailoldmaster, emailr1live)
- `phone` → Telefone
- `jobtitle` → Cargo/Função
- `account_name` → Nome da conta
- `clinic_name` → Nome da clínica
- `dsd_course_name` → Curso DSD (se aplicável)

**Exemplo SQL:**
```sql
SELECT 
  d.DealId,
  d.dealname,
  d.amount,
  c.firstname,
  c.lastname,
  c.email,
  c.phone,
  c.jobtitle
FROM Deal d
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId
WHERE d.DealId = @DealId
```

---

### 2️⃣ Deal → Company (Empresa/Organização)

**Relação:**
```
Deal (DealId)
  → DealCompanyAssociations (DealId ↔ CompanyId)
    → Company (CompanyId - 242 colunas)
```

**Colunas úteis de Company:**
- `name` → Nome da empresa
- `industry` → Setor/Indústria
- `website` → Site web
- `address`, `city`, `state`, `zipcode` → Endereço completo
- `phone` → Telefone da empresa
- `annualrevenue` → Receita anual
- `numberofemployees` → Número de funcionários
- `active_patients` → Pacientes ativos (para clínicas)

**Exemplo SQL:**
```sql
SELECT 
  d.DealId,
  d.dealname,
  co.name as company_name,
  co.industry,
  co.website,
  co.annualrevenue
FROM Deal d
LEFT JOIN DealCompanyAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Company co ON co.CompanyId = dca.CompanyId
```

---

### 3️⃣ Deal → LineItem (Produtos/Serviços)

**Relação:**
```
Deal (DealId)
  → DealLineItemAssociations (DealId ↔ LineItemId)
    → LineItem (LineItemId - 97 colunas)
```

**Colunas úteis de LineItem:**
- `description` → Nome do produto/serviço
- `amount` → Valor do item
- `cost_price` → Custo
- `discount` → Desconto aplicado
- `hs_acv` → Annual Contract Value
- `createdate` → Data de criação

**Exemplo SQL:**
```sql
SELECT 
  d.DealId,
  d.dealname,
  li.description as product_name,
  li.amount as product_amount,
  li.discount,
  li.cost_price
FROM Deal d
LEFT JOIN DealLineItemAssociations dlia ON d.DealId = dlia.DealId
LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
```

---

### 4️⃣ Deal → DoctorsProducts (Produtos Médicos/Clínica)

**Relação:**
```
Deal (DealId)
  → DoctorsProductsDealAssociations (DealId ↔ DoctorsProductsId)
    → DoctorsProducts (DoctorsProductsId - 70 colunas)
```

**Colunas úteis de DoctorsProducts:**
- `deal_name` → Nome do produto/serviço médico
- `amount` → Valor
- `currency` → Moeda
- `cost_price` → Custo
- `date_assigned` → Data de atribuição
- `complete_timestamp` → Data de conclusão

**Nota:** Use esta tabela se os produtos forem específicos do negócio médico/clínica.

---

### 5️⃣ Deal → Subscription (Contratos/Assinaturas Recorrentes)

**Relação:**
```
Deal (DealId)
  → SubscriptionDealAssociations (DealId ↔ SubscriptionId)
    → Subscription
```

**Útil para:** Rastrear contratos de longa duração ligados aos deals.

---

## Exemplo Completo: Query Unificada

```sql
SELECT 
  -- Deal Info
  d.DealId,
  d.dealname,
  d.amount as deal_amount,
  d.closedate,
  d.dealstage,
  
  -- Contact Info (Cliente)
  c.firstname,
  c.lastname,
  c.email,
  c.phone,
  c.jobtitle,
  
  -- Company Info (Empresa)
  co.name as company_name,
  co.industry,
  co.website,
  
  -- LineItem Info (Produtos)
  li.description as product_name,
  li.amount as product_amount,
  li.discount
  
FROM Deal d
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId
LEFT JOIN DealCompanyAssociations dcomp ON d.DealId = dcomp.DealId
LEFT JOIN Company co ON co.CompanyId = dcomp.CompanyId
LEFT JOIN DealLineItemAssociations dlia ON d.DealId = dlia.DealId
LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
WHERE d.DealId = @DealId
```

---

## Outras Tabelas Úteis

### Engagements (Atividades/Comunicações)
- Emails enviados
- Calls (chamadas)
- Meetings (reuniões)
- Tasks
- **Relação:** EngagementDealAssociations

### Tickets (Suporte/Problemas)
- Tracking de suporte
- Histórico de comunicação
- **Relação:** TicketDealAssociations

### Invoices (Faturas)
- Faturas relacionadas ao deal
- Status de pagamento
- **Relação:** InvoiceDealAssociations

### Payments (Pagamentos)
- Pagamentos processados
- Método de pagamento
- Status
- **Relação:** PaymentDealAssociations

### Orders (Pedidos)
- Ordem de compra
- Status de entrega
- **Relação:** OrderDealAssociations

---

## Como Enriquecer o Excel Export

Modifique o script `export-hubspot-xlsx.js` para incluir dados enriquecidos:

```javascript
// Adicionar colunas de Company, Contact, LineItem
const query = `
  SELECT TOP 100
    d.*,
    c.firstname,
    c.lastname,
    c.email,
    co.name as company_name,
    li.description as product_name
  FROM Deal d
  LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
  LEFT JOIN Contact c ON c.VId = dca.VId
  LEFT JOIN DealCompanyAssociations dcomp ON d.DealId = dcomp.DealId
  LEFT JOIN Company co ON co.CompanyId = dcomp.CompanyId
  LEFT JOIN DealLineItemAssociations dlia ON d.DealId = dlia.DealId
  LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
`;
```

---

## Passo a Passo para Adicionar Colunas

### Opção 1: Via Sync Route
Edite `/src/app/api/hubspot/sync/route.ts` para fazer JOINs ao sincronizar.

### Opção 2: Via Excel Export Script
Modifique `scripts/export-hubspot-xlsx.js` para usar queries com JOINs.

### Opção 3: Via API Endpoint
Crie um novo endpoint `/api/hubspot/deals-enriched` que retorna dados com relações.

---

## Resumo: Respostas às Suas Perguntas

| Pergunta | Resposta |
|----------|----------|
| **As 239 colunas são todas?** | Não! Deal tem 239, mas há 169 tabelas com +10k colunas totais |
| **Nome do cliente?** | ✓ Contact.firstname + Contact.lastname (via DealContactAssociations) |
| **Email do cliente?** | ✓ Contact.email (via DealContactAssociations) |
| **Nome do produto?** | ✓ LineItem.description (via DealLineItemAssociations) |
| **Nome da empresa?** | ✓ Company.name (via DealCompanyAssociations) |
| **Posso fazer JOINs?** | ✓ SIM! Todas as relações estão na estrutura |

---

## Próximas Ações

1. **Criar query SQL enriquecida** com JOINs para combinados
2. **Atualizar script de Excel** para incluir Contact, Company, LineItem
3. **Criar API endpoint** `/api/hubspot/deals-enriched` com dados completos
4. **Adicionar filtros** por empresa, produto, stage, etc.

Quer que eu implemente qual dessas opções? 🚀
