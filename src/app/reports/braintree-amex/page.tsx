import React from 'react'

export default function BraintreeAmexPage() {
  const data: string[][] = [] // Substitua com os dados reais
  const settlementDateIndex = 0
  const settlementAmountIndex = 1

  for (const values of data) {
    const settlementDate = (values[settlementDateIndex] || '').trim()
    const settlementAmount = parseFloat(
      (values[settlementAmountIndex] || '0').replace(/[^0-9.-]/g, '')
    ) || 0

    if (settlementAmount <= 0) continue
    if (settlementAmount === 0 && !settlementDate) continue

    // Lógica de processamento aqui...
    console.log('Processando:', { settlementDate, settlementAmount })
  }

  return <div>Braintree Amex Report</div>
}
