# 🎨 Guia Visual - Sidebar ERP Multi-País

## 🎯 Estrutura Visual Implementada

```
┌─────────────────────────────────────────────────────────┐
│  👤  Kate Russell                              ◀        │
│      Project Manager                                    │
├─────────────────────────────────────────────────────────┤
│  🔍  Search                                    ⌘F       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  EXECUTIVE INSIGHTS                                     │
│  📊  Overview Dashboard                                 │
│  📈  Performance Analytics                              │
│  📉  P&L                                                │
│  💰  Cash Flow Summary                                  │
│  🎯  KPIs & Ratios                                      │
│  📊  Forecasts                                          │
│  📄  Consolidated Reports                               │
│                                                         │
│  ACCOUNTS PAYABLE                                       │
│  📋  Overview                                           │
│  📝  Transactions                               ▼       │
│      ├── ✅ Bank Reconciliation                        │
│      ├── 📄 Invoices                                   │
│      ├── 💳 Payments                                   │
│      └── 👥 Providers                                  │
│  📊  Insights                                   ▼       │
│      ├── ⏰ Aging Report                               │
│      ├── 💰 Cash Flow Forecast                         │
│      ├── 📅 Payment Schedule                           │
│      └── 📄 Reports                                    │
│  📦  Master Data                                ▼       │
│      ├── 🏦 Bank Accounts                              │
│      ├── 📊 Chart of Accounts                          │
│      ├── 🎯 Cost Centers                               │
│      ├── 📚 DSD Courses                                │
│      ├── 💰 Financial Accounts                         │
│      └── 👥 Providers                                  │
│  ⚙️  Setup                                      ▼       │
│      ├── 🛡️ Approval Rules                             │
│      ├── 📅 Payment Terms                              │
│      ├── ✅ Posting Profiles                           │
│      └── 📄 Tax Configurations                         │
│                                                         │
│  ACCOUNTS RECEIVABLE                                    │
│  💵  Overview                                           │
│  📝  Transactions                               ▼       │
│      ├── 📄 Credit Notes                               │
│      ├── 📄 Invoices                                   │
│      ├── 💳 Payments                                   │
│      ├── ✅ Receipts                                   │
│      └── 💳 Payment Channels                           │
│  📊  Insights                                   ▼       │
│      ├── ⏰ Aging Report                               │
│      ├── 📈 Collection Performance                     │
│      └── 📄 Reports                                    │
│  📦  Master Data                                ▼       │
│      ├── 📊 Chart of Accounts                          │
│      ├── 👤 Customers                                  │
│      ├── 👥 Customer Groups                            │
│      ├── 📚 DSD Courses                                │
│      ├── 💰 Financial Accounts                         │
│      └── 🎯 Revenue Centers                            │
│  ⚙️  Setup                                      ▼       │
│      ├── 🛡️ Credit Policies                            │
│      ├── 📅 Payment Terms                              │
│      ├── ✅ Posting Profiles                           │
│      └── 📄 Tax Configurations                         │
│                                                         │
│  CASH MANAGEMENT                                        │
│  🏦  Bank Statements                            ▼       │
│      ├── 🏛️ Bankinter                          ▼       │
│      │    ├── 💶 Bankinter (EUR)                       │
│      │    └── 💵 Bankinter (USD)                       │
│      └── 🏛️ Sabadell                                   │
│  💳  Payment Channels                           ▼       │
│      ├── 💳 Stripe                                     │
│      ├── 💳 PayPal                                     │
│      ├── 💳 GoCardless                                 │
│      └── 💳 Braintree                          ▼       │
│           ├── 💶 Braintree (EUR)                       │
│           ├── 💵 Braintree (USD)                       │
│           ├── 💳 Braintree (Amex)                      │
│           └── 📊 Braintree (Transactions)              │
│  ✅  Reconciliation Center                              │
│  📊  Cash Flow Reports                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  💬  Help Center                              ▶        │
│      Answers here                                      │
│  ▾   Collapse menu                                     │
└─────────────────────────────────────────────────────────┘
```

## 🎨 Paleta de Cores

### Background
```css
Background Principal: #1e293b (slate-800)
Background Hover: #334155 (slate-700)
Background Active: #3b82f6 (blue-500)
Border: #374151 (gray-700)
```

### Texto
```css
Texto Principal: #e5e7eb (gray-200)
Texto Secundário: #9ca3af (gray-400)
Texto Active: #ffffff (white)
Labels: #6b7280 (gray-500)
```

### Destaques
```css
Avatar Gradient: linear-gradient(135deg, #3b82f6, #8b5cf6)
Hover Effect: #334155 (slate-700)
Active State: #3b82f6 (blue-500)
```

## 🎭 Estados Visuais

### Normal (Não Selecionado)
- Background: Transparente
- Texto: `text-gray-300`
- Hover: `bg-gray-700 text-white`

### Active (Página Atual)
- Background: `bg-blue-500`
- Texto: `text-white font-medium`
- Efeito: Destaque azul completo

### Collapsed (Menu Colapsado)
- Width: `5rem` (80px)
- Apenas ícones visíveis
- Tooltips ao hover (futuro)

## 📱 Responsividade

### Mobile (< 768px)
- Menu off-canvas (slide-in)
- Backdrop escuro (60% opacidade)
- Botão hamburger no topo esquerdo
- Fecha ao clicar fora

### Desktop (≥ 768px)
- Menu fixo lateral
- Largura: 18rem (288px) normal / 5rem (80px) colapsado
- Animação suave na transição

## ⚡ Interações

### Collapse/Expand
- Botão no canto superior direito do header
- Animação de 300ms
- Mantém estado entre navegações

### Submenus
- Clique para expandir/colapsar
- Ícone chevron rotaciona 180° quando aberto
- Suporta até 3 níveis de profundidade
- Estado inicial: todos abertos

### Search
- Input com placeholder "Search"
- Atalho: ⌘F (visual apenas por enquanto)
- Background: `bg-gray-800`
- Border: `border-gray-700`

### Help Center
- Botão com avatar "HC"
- Texto "Answers here"
- Chevron right indicando link externo

## 📊 Estatísticas da Navegação

- **Total de Seções**: 4 (Executive, AP, AR, Cash)
- **Total de Páginas**: ~75 rotas
- **Níveis de Profundidade**: 3 (máximo)
- **Ícones Únicos**: 35+ lucide-react icons

## 🔧 Customizações Técnicas

### CSS Customizado
```css
/* Scrollbar customizada */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #1e293b;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}
```

### Layout CSS Variable
```css
--sidebar-width: 18rem (expanded) | 5rem (collapsed)
```

## 🎯 Features Implementadas

- ✅ Navegação hierárquica multi-nível
- ✅ Estados visuais (hover, active, collapsed)
- ✅ Responsividade mobile/desktop
- ✅ Animações suaves
- ✅ Search input (visual)
- ✅ User profile header
- ✅ Help Center footer
- ✅ Collapse/Expand menu
- ✅ Icons lucide-react
- ✅ Dark theme moderno

## 🚀 Features Futuras

- ⏳ Search funcional com autocomplete
- ⏳ Tooltips nos ícones (collapsed mode)
- ⏳ Atalhos de teclado (⌘K, etc.)
- ⏳ Favorites/Recents
- ⏳ Notifications badge
- ⏳ Settings dropdown
- ⏳ Company switcher no header
