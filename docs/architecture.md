# Arquitetura do Projeto – Automação de Dados Financeiros

## 1. Visão geral

Este projeto é uma aplicação web construída com **Next.js (App Router)** e **TypeScript**.  
O objetivo é criar um sistema de **gestão financeira** que permita:


- cadastrar **contas a pagar e a receber**;
- registrar **receitas e despesas**; 
- gerar relatórios como **P&L (DRE)**, **Balanço** e **Fluxo de Caixa**;
- futuramente, integrar com **Supabase** para persistência dos dados.

Atualmente o projeto foi criado via **Lasy / create-next-app** e está em fase de evolução para um sistema financeiro completo.

---

## 2. Stack técnica

- **Frontend & Backend**: Next.js (React + App Router)
- **Linguagem**: TypeScript
- **Estilização**: (preencher com a lib realmente usada – Tailwind, CSS Modules, etc.)
- **Build & Dev server**: Next.js
- **Banco de dados**: Planejado – Supabase/Postgres
- **Deploy**: (preencher quando definido – Vercel, outro)

---

## 3. Estrutura de pastas (alto nível)

```text
/
├─ public/               # Assets estáticos (imagens, ícones, etc.)
├─ src/
│  ├─ app/               # Rotas do Next.js (App Router)
│  │  ├─ page.tsx        # Página inicial
│  │  └─ (outras pastas) # Futuras páginas: /transactions, /reports, etc.
│  ├─ components/        # Componentes reutilizáveis de UI
│  ├─ lib/               # Funções utilitárias (chamadas ao Supabase, helpers)
│  └─ (outras pastas)    # Ex.: hooks, context, etc. (quando existirem)
├─ docs/                 # Documentação do projeto (esta pasta)
├─ package.json
├─ tsconfig.json
└─ next.config.ts
