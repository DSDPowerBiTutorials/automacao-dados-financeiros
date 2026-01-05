# 📊 HubSpot Deals - Export para Excel

## Gerado com Sucesso! ✅

Um arquivo Excel foi criado com **100 exemplos de deals reais** contendo **todas as 239 colunas disponíveis**.

---

## 📁 Arquivo Gerado

**Localização**: `data/hubspot-deals-2026-01-04.xlsx`
**Tamanho**: ~86 KB
**Formato**: Excel XLSX

---

## 📋 Conteúdo do Arquivo

### Sheet 1: **Deals** (Dados dos Negócios)
- **100 linhas** de deals reais do HubSpot
- **239 colunas** com todos os dados disponíveis
- **Formatação automática**:
  - Cabeçalho azul com texto branco
  - Primeiras 100 linhas com cores alternadas
  - Datas formatadas como `YYYY-MM-DD HH:MM:SS`
  - Números formatados com separadores de milhares
  - Primeira linha congelada para navegação fácil

**Colunas principais incluídas**:
- DealId, dealname, closedate, createdate
- amount, amount_in_home_currency, deal_currency_code
- dealstage, deal_pipeline, dealtype
- hubspot_owner_id, contact_s_name, description
- hs_closed_won_date, hs_lastmodifieddate
- ... e 224 outras colunas

---

### Sheet 2: **Colunas** (Metadados)
Informações sobre cada uma das 239 colunas:

| Coluna | Descrição |
|--------|-----------|
| # | Número ordinal da coluna |
| Nome da Coluna | Nome exato da coluna no banco de dados |
| Tipo de Dado | Tipo (nvarchar, numeric, datetime, bit, bigint) |
| Pode ser Vazio? | Sim/Não se permite valores nulos |

**Tipos de dados encontrados**:
- 🔤 **nvarchar** (122) - Texto
- 🔢 **numeric** (66) - Números
- 📅 **datetime** (36) - Datas
- ⚙️ **bit** (13) - Booleanos
- 🔑 **bigint** (2) - IDs grandes

---

### Sheet 3: **Resumo** (Informações Gerais)
Estatísticas e metainformações do export:

```
Data de Exportação: 04/01/2026 23:17
Número de Deals: 100
Número de Colunas: 239
Database: Jorge9660
Tabela: Deal
Período de Dados: Últimos 100 deals modificados

Distribuição de Tipos:
  nvarchar: 122
  numeric: 66
  datetime: 36
  bit: 13
  bigint: 2
```

---

## 🔄 Como Gerar Novamente

Para criar um novo arquivo com dados atualizados:

```bash
# Executar o script
node scripts/export-hubspot-xlsx.js
```

Isso gerará um novo arquivo em `data/` com a data atual.

---

## 📝 Exemplos de Uso

### 1️⃣ **Analisar padrões de deals**
Abra o arquivo em Excel/Google Sheets e use filtros para:
- Deals por stage (dealstage)
- Deals por pipeline (deal_pipeline)
- Deals por moeda (deal_currency_code)
- Deals com valor acima/abaixo de X
- Deals fechados em determinada data

### 2️⃣ **Usar como template de importação**
Use como referência para:
- Integrar com outros sistemas
- Criar APIs de sincronização
- Validar campos obrigatórios
- Testar tratamento de dados

### 3️⃣ **Documentação de dados**
Compartilhe com:
- Equipe de análise
- Stakeholders de negócios
- Documentação técnica
- Treinamento de usuários

---

## 🔧 Personalização

Para modificar o script e gerar com:

### **Mais ou menos deals**
Edite `scripts/export-hubspot-xlsx.js`, linha 37:
```typescript
SELECT TOP 100 * FROM [dbo].[Deal]  // Mude 100 para outra quantidade
```

### **Colunas específicas apenas**
Modifique a query SQL para selecionar apenas colunas desejadas:
```typescript
SELECT DealId, dealname, amount, closedate FROM [dbo].[Deal]
```

### **Deals com filtros**
Adicione WHERE clause:
```typescript
SELECT TOP 100 * FROM [dbo].[Deal]
WHERE dealstage = 'closedwon'
ORDER BY hs_lastmodifieddate DESC
```

---

## 📊 Tipos de Dados Explicados

| Tipo | Exemplo | Uso |
|------|---------|-----|
| **nvarchar** | "Course Completed - Expert" | Nomes, descrições, códigos |
| **numeric** | 1500.50 | Valores monetários, quantidades |
| **datetime** | 2025-12-15 14:30:45 | Datas, timestamps |
| **bit** | 1 (true) ou 0 (false) | Flags, status booleanos |
| **bigint** | 12345678901234 | IDs grandes |

---

## ✨ Dicas

- **Use os filtros do Excel**: Clique na seta do cabeçalho para filtrar por coluna
- **Congelar linhas**: Já está feito! A primeira linha permanece visível ao rolar
- **Alterar largura de coluna**: Duplo clique na borda entre colunas para auto-ajustar
- **Exportar para CSV**: Salve como CSV se precisar usar em Python/R
- **Usar no Google Sheets**: Faça upload e compartilhe facilmente

---

## 🚀 Próximas Ações

1. ✅ Arquivo gerado com sucesso
2. 📥 Baixar o arquivo `hubspot-deals-2026-01-04.xlsx`
3. 🔍 Explorar os dados e colunas
4. 💡 Usar como referência para suas implementações
5. 🔄 Executar script novamente quando precisar de dados atualizados

---

## 📞 Suporte

Se precisar:
- **Adicionar mais colunas**: Veja `docs/HUBSPOT-AVAILABLE-COLUMNS.md`
- **Modificar formato**: Edite `scripts/export-hubspot-xlsx.js`
- **Exportar em outro formato**: Crie novo script baseado neste
