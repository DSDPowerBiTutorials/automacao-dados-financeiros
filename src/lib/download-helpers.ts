// Helper functions para download de CSV

interface CSVRow {
  id: string
  date: string
  description: string
  amount: number
  category: string
  classification: string
  source: string
  depositAccount?: string
  paymentMethod?: string
  orderNumbers?: string[]
  reconciled?: boolean
  matchedWith?: string
  [key: string]: any
}

interface CSVFile {
  name: string
  lastUpdated: string
  rows: CSVRow[]
  totalAmount: number
  source: 'bankinter-eur' | 'bankinter-usd' | 'sabadell' | 'braintree-eur' | 'braintree-usd' | 'braintree-transactions' | 'braintree-amex' | 'braintree-amex-transactions' | 'stripe' | 'gocardless' | 'paypal'
}

export function downloadFinalCSV(csvFiles: CSVFile[]) {
  if (csvFiles.length === 0) {
    alert('No data to export. Please upload CSV files first.')
    return
  }

  let csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,PaymentMethod,OrderNumbers,Reconciled,MatchedWith\n"
  
  csvFiles.forEach(file => {
    file.rows.forEach(row => {
      const orderNumbersStr = (row.orderNumbers || []).join(';')
      const description = (row.description || '').replace(/"/g, '""') // Escape quotes
      csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${row.paymentMethod || ''},${orderNumbersStr},${row.reconciled || false},${row.matchedWith || ''}\n`
    })
  })

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `reconciled_data_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading CSV:', error)
    alert('Error downloading CSV file. Please try again.')
  }
}

export function downloadIndividualCSV(file: CSVFile) {
  if (!file || file.rows.length === 0) {
    alert('No data to download for this file.')
    return
  }

  const isBankStatement = file.source === 'bankinter-eur' || file.source === 'bankinter-usd' || file.source === 'sabadell'
  
  try {
    let csvContent = ""
    
    // Para Braintree Amex, incluir todas as colunas específicas
    if (file.source === 'braintree-amex') {
      csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers,settlement_date,settlement_number,total_charges,credits,submission_amount,discount_amount,fees_and_incentives,chargebacks,adjustments,held_funds,settlement_amount,settlement_currency_code,amount_paid_to_bank\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.settlement_date},${row.settlement_number},${row.total_charges},${row.credits},${row.submission_amount},${row.discount_amount},${row.fees_and_incentives},${row.chargebacks},${row.adjustments},${row.held_funds},${row.settlement_amount},${row.settlement_currency_code},${row.amount_paid_to_bank}\n`
      })
    }
    // Para Stripe, incluir todas as colunas específicas
    else if (file.source === 'stripe') {
      csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers,automatic_payout_effective_at,net\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.automatic_payout_effective_at},${row.net}\n`
      })
    }
    // Para GoCardless, incluir todas as colunas específicas
    else if (file.source === 'gocardless') {
      csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers,payouts.arrival_date,net_amount\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row['payouts.arrival_date']},${row.net_amount}\n`
      })
    }
    // Para Braintree EUR, incluir todas as colunas específicas
    else if (file.source === 'braintree-eur') {
      csvContent = "ID,Date,Description,Payout,Category,Classification,Source,DepositAccount,OrderNumbers,disbursement_date,settlement_currency_sales_EUR,discount_EUR,multicurrency_fees_EUR,per_transaction_fees_EUR,cross_border_fees_EUR,other_fees_EUR,chargebacks_lost_won_EUR,settlement_currency_refunds_EUR,#_of_refunds,chargeback_won_amt_EUR,#_of_chargebacks_won,chargeback_issued_amt_EUR,#_of_chargebacks_issued,chargeback_fees_EUR\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        csvContent += `${row.id},${row.date},"${description}",${row.payout || row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.disbursement_date},${row.settlement_currency_sales_EUR},${row.discount_EUR},${row.multicurrency_fees_EUR},${row.per_transaction_fees_EUR},${row.cross_border_fees_EUR},${row.other_fees_EUR},${row.chargebacks_lost_won_EUR},${row.settlement_currency_refunds_EUR},${row['#_of_refunds']},${row.chargeback_won_amt_EUR},${row['#_of_chargebacks_won']},${row.chargeback_issued_amt_EUR},${row['#_of_chargebacks_issued']},${row.chargeback_fees_EUR}\n`
      })
    }
    // Para Braintree USD, incluir todas as colunas específicas (suporta ambos os formatos)
    else if (file.source === 'braintree-usd') {
      csvContent = "ID,Date,Description,Payout,Category,Classification,Source,DepositAccount,OrderNumbers,disbursement_date,settlement_currency_sales,discount,multicurrency_fees,per_transaction_fees,cross_border_fees,other_fees,chargebacks_lost_won,settlement_currency_refunds,#_of_refunds,chargeback_won_amt,#_of_chargebacks_won,chargeback_issued_amt,#_of_chargebacks_issued,chargeback_fees\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        const settlementSales = row.settlement_currency_sales_EUR || row.settlement_currency_sales_USD || 0
        const discount = row.discount_EUR || row.discount_USD || 0
        const multicurrencyFees = row.multicurrency_fees_EUR || row.multicurrency_fees_USD || 0
        const perTransactionFees = row.per_transaction_fees_EUR || row.per_transaction_fees_USD || 0
        const crossBorderFees = row.cross_border_fees_EUR || row.cross_border_fees_USD || 0
        
        csvContent += `${row.id},${row.date},"${description}",${row.payout || row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.disbursement_date},${settlementSales},${discount},${multicurrencyFees},${perTransactionFees},${crossBorderFees},${row.other_fees_EUR || 0},${row.chargebacks_lost_won_EUR || 0},${row.settlement_currency_refunds_EUR || 0},${row['#_of_refunds'] || 0},${row.chargeback_won_amt_EUR || 0},${row['#_of_chargebacks_won'] || 0},${row.chargeback_issued_amt_EUR || 0},${row['#_of_chargebacks_issued'] || 0},${row.chargeback_fees_EUR || 0}\n`
      })
    }
    // Formato genérico para outros sources
    else {
      csvContent = isBankStatement
        ? "ID,Date,Description,Amount,Category,Classification,Source,PaymentMethod,OrderNumbers\n"
        : "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const description = (row.description || '').replace(/"/g, '""')
        if (isBankStatement) {
          csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.paymentMethod || ''},${orderNumbersStr}\n`
        } else {
          csvContent += `${row.id},${row.date},"${description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr}\n`
        }
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading CSV:', error)
    alert('Error downloading CSV file. Please try again.')
  }
}
