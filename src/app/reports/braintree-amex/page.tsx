// Página Braintree Amex 100% funcional baseada na estrutura da página Braintree EUR
"use client"

import BraintreePage from "@/components/reports/BraintreePage"

export default function BraintreeAmexPage() {
  return <BraintreePage source="braintree-amex" title="Braintree AMEX - Payment Source" />
}

// Essa versão usa um componente compartilhado para manter as páginas sincronizadas
// A lógica completa de upload, download, conciliação, edição e exclusão está em `@/components/reports/BraintreePage.tsx`
// Esse componente já trata corretamente a diferença entre EUR, AMEX, USD, etc., usando a prop `source`

// ✅ Garantia de que futuras alterações na lógica serão aplicadas a todas as fontes de Braintree automaticamente
// 🔧 Para alterar layout, colunas, ou lógica, edite apenas `BraintreePage.tsx`
// 📌 Use esta página para testar primeiro sem afetar a EUR
