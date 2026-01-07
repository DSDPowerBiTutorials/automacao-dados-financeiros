# Integração Pleo - Gestão de Despesas Corporativas

## Status da Integração
🔄 **EM DESENVOLVIMENTO** - API configurada, aguardando resposta dos endpoints

## Informações da API

### Autenticação
- **Base URL**: `https://external.pleo.io/v1`
- **Token**: JWT armazenado em `.env.local` como `PLEO_API_TOKEN`
- **Company ID**: `8e5783c2-4f29-40f1-ad8f-770cd93e45aa`
- **User ID**: `a4ec81a4-ce36-430f-a1f4-8688e0960e44`
- **Token Expiration**: 2029-06-05

### Endpoints Disponíveis (segundo documentação Pleo)
- `/v1/expenses` - Lista de despesas
- `/v1/users/me` - Informações do usuário autenticado
- `/v1/export` - Exportação de dados

## Estrutura de Dados Esperada

### Expense (Despesa)
```typescript
interface PleoExpense {
  id: string;
  date: string; // ISO 8601
  amount: number;
  currency: string; // EUR, USD, etc.
  merchant: string;
  category: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  receipt?: string; // URL da foto do recibo
  description?: string;
}
```

## Integração com Supabase

### Opção 1: Usar Tabela `csv_rows` Existente
```sql
-- Inserir despesas Pleo na tabela csv_rows
INSERT INTO csv_rows (source, date, description, amount, custom_data)
VALUES (
  'pleo',
  '2025-01-07',
  'Despesa em Restaurante XYZ - Jorge Marfetan',
  -45.50,
  jsonb_build_object(
    'expense_id', 'exp_123',
    'merchant', 'Restaurante XYZ',
    'category', 'Meals & Entertainment',
    'user_email', 'jmarfetan@digitalsmi ledesign.com',
    'status', 'approved',
    'receipt_url', 'https://pleo.io/receipts/123'
  )
);
```

### Opção 2: Criar Tabela Dedicada
```sql
CREATE TABLE pleo_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pleo_expense_id VARCHAR(255) UNIQUE NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  merchant VARCHAR(255),
  category VARCHAR(100),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  status VARCHAR(50),
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pleo_date ON pleo_expenses(date);
CREATE INDEX idx_pleo_user ON pleo_expenses(user_email);
CREATE INDEX idx_pleo_status ON pleo_expenses(status);
```

## Arquitetura da Integração

### 1. API Route: `/api/pleo/sync`
```typescript
// src/app/api/pleo/sync/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PLEO_API_BASE = 'https://external.pleo.io/v1';
const PLEO_TOKEN = process.env.PLEO_API_TOKEN;

export async function POST() {
  try {
    // 1. Buscar despesas da API Pleo
    const response = await fetch(`${PLEO_API_BASE}/expenses`, {
      headers: {
        'Authorization': `Bearer ${PLEO_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Pleo API error: ${response.status}`);
    }

    const { data: expenses } = await response.json();

    // 2. Inserir no Supabase
    const rows = expenses.map(exp => ({
      source: 'pleo',
      date: exp.date,
      description: `${exp.merchant} - ${exp.user.name}`,
      amount: -Math.abs(exp.amount), // Negativo pois é despesa
      custom_data: {
        expense_id: exp.id,
        merchant: exp.merchant,
        category: exp.category,
        user_email: exp.user.email,
        status: exp.status,
        receipt_url: exp.receipt
      }
    }));

    const { data, error } = await supabase
      .from('csv_rows')
      .upsert(rows, { onConflict: 'source,custom_data->expense_id' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      imported: rows.length
    });

  } catch (error) {
    console.error('Pleo sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 2. Página de Relatório: `/reports/pleo`
```typescript
// src/app/reports/pleo/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PleoReportPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    const { data, error } = await supabase
      .from('csv_rows')
      .select('*')
      .eq('source', 'pleo')
      .order('date', { ascending: false });

    if (!error) setExpenses(data || []);
    setLoading(false);
  }

  async function syncPleo() {
    setSyncing(true);
    const response = await fetch('/api/pleo/sync', { method: 'POST' });
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ ${result.imported} despesas importadas`);
      loadExpenses();
    } else {
      alert(`❌ Erro: ${result.error}`);
    }
    setSyncing(false);
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Despesas Pleo</h1>
        <Button onClick={syncPleo} disabled={syncing}>
          {syncing ? 'Sincronizando...' : 'Sincronizar Pleo'}
        </Button>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <Card className="p-4">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Comerciante</th>
                <th className="text-left p-2">Usuário</th>
                <th className="text-left p-2">Categoria</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-center p-2">Recibo</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{exp.date}</td>
                  <td className="p-2">{exp.custom_data?.merchant}</td>
                  <td className="p-2">{exp.custom_data?.user_email}</td>
                  <td className="p-2">{exp.custom_data?.category}</td>
                  <td className="p-2 text-right">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(exp.amount)}
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      exp.custom_data?.status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {exp.custom_data?.status}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    {exp.custom_data?.receipt_url && (
                      <a 
                        href={exp.custom_data.receipt_url}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        Ver
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

### 3. Adicionar ao Menu de Navegação
```typescript
// src/config/navigation.ts
export const navigation = [
  // ... itens existentes
  {
    title: "Despesas Pleo",
    href: "/reports/pleo",
    icon: "CreditCard"
  }
];
```

## Próximos Passos

### ✅ Concluído
- [x] Token Pleo armazenado em `.env.local`
- [x] Documentação criada

### 🔄 Em Andamento
- [ ] **Validar endpoints da API Pleo** - API não está respondendo, verificar:
  - Endpoint correto (pode ser `/v2/expenses` ou outro)
  - Headers adicionais necessários
  - Rate limiting ou IP whitelist
  - Documentação oficial: https://developer.pleo.io

### 📋 Pendente
- [ ] Criar `/api/pleo/sync` route
- [ ] Criar `/reports/pleo` page
- [ ] Adicionar ao menu de navegação
- [ ] Testar sincronização completa
- [ ] Configurar cron job para sync automático (diário?)
- [ ] Adicionar filtros por data, usuário, categoria
- [ ] Implementar download de recibos

## Troubleshooting

### API não responde
```bash
# Testar manualmente
curl -v 'https://external.pleo.io/v1/users/me' \
  -H "Authorization: Bearer $PLEO_API_TOKEN" \
  -H 'Accept: application/json'

# Verificar token
echo $PLEO_API_TOKEN | cut -d. -f2 | base64 -d | jq '.'
```

### Verificar dados do token
```bash
# Decodificar JWT payload
grep PLEO_API_TOKEN .env.local | cut -d= -f2- | cut -d. -f2 | base64 -d 2>/dev/null | jq '.'
```

## Recursos
- [Documentação Pleo API](https://developer.pleo.io)
- [Pleo Webhooks](https://developer.pleo.io/webhooks) - Para sync em tempo real
