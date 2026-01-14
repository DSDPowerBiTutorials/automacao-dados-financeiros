const braintree = require('braintree');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const gateway = new braintree.BraintreeGateway({
    environment: process.env.BRAINTREE_ENVIRONMENT === 'production' 
        ? braintree.Environment.Production 
        : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

async function exportDetalhado() {
    console.log('📊 EXPORTANDO DADOS DETALHADOS DO BRAINTREE...\n');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365); // 1 ano
    
    return new Promise((resolve) => {
        const allTx = [];
        
        gateway.transaction.search(
            (search) => search.createdAt().between(startDate, endDate),
            (err, response) => {
                if (err) { console.error('Erro:', err); resolve(); return; }
                
                response.each((err, tx) => {
                    if (err) return;
                    allTx.push(tx);
                    return true;
                });
                
                setTimeout(async () => {
                    console.log(`📥 Total transações: ${allTx.length}\n`);
                    
                    // Processar dados completos
                    const rows = allTx.map(tx => {
                        // Payment Method
                        let paymentMethod = '';
                        let cardType = '';
                        let cardLast4 = '';
                        let paypalEmail = '';
                        
                        if (tx.paymentInstrumentType === 'credit_card' && tx.creditCard) {
                            paymentMethod = 'Cartão';
                            cardType = tx.creditCard.cardType || '';
                            cardLast4 = tx.creditCard.last4 || '';
                        } else if (tx.paymentInstrumentType === 'paypal_account' && tx.paypalAccount) {
                            paymentMethod = 'PayPal';
                            paypalEmail = tx.paypalAccount.payerEmail || '';
                        } else {
                            paymentMethod = tx.paymentInstrumentType || 'Outro';
                        }
                        
                        // Billing Address
                        const billing = tx.billing || {};
                        
                        // Subscription info
                        const subscriptionId = tx.subscriptionId || '';
                        
                        // Refund info
                        const refundedAmount = tx.refundedTransactionId ? tx.amount : '';
                        const isRefund = tx.type === 'credit' ? 'Sim' : 'Não';
                        
                        // Disbursement
                        const disb = tx.disbursementDetails || {};
                        
                        return {
                            // Datas
                            'Data Transação': tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[0] : '',
                            'Hora': tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[1].substring(0,8) : '',
                            'Data Settlement': disb.disbursementDate ? new Date(disb.disbursementDate).toISOString().split('T')[0] : '',
                            
                            // IDs
                            'Transaction ID': tx.id,
                            'Order ID': tx.orderId || '',
                            'Subscription ID': subscriptionId,
                            
                            // Cliente
                            'Cliente Nome': tx.customer?.firstName ? `${tx.customer.firstName} ${tx.customer.lastName || ''}`.trim() : '',
                            'Cliente Email': tx.customer?.email || '',
                            'Cliente ID': tx.customer?.id || '',
                            'Empresa': tx.customer?.company || billing.company || '',
                            
                            // Billing Address
                            'Billing Nome': billing.firstName ? `${billing.firstName} ${billing.lastName || ''}`.trim() : '',
                            'Billing Endereço': billing.streetAddress || '',
                            'Billing Cidade': billing.locality || '',
                            'Billing Estado': billing.region || '',
                            'Billing CEP': billing.postalCode || '',
                            'Billing País': billing.countryCodeAlpha2 || '',
                            
                            // Pagamento
                            'Método': paymentMethod,
                            'Bandeira': cardType,
                            'Últimos 4': cardLast4,
                            'PayPal Email': paypalEmail,
                            
                            // Valores
                            'Valor': parseFloat(tx.amount) || 0,
                            'Moeda': tx.currencyIsoCode || 'EUR',
                            'Taxa Serviço': parseFloat(tx.serviceFeeAmount) || 0,
                            
                            // Status
                            'Status': tx.status,
                            'Tipo': tx.type, // sale, credit
                            'É Refund': isRefund,
                            
                            // Settlement
                            'Settlement Amount': disb.settlementAmount || '',
                            'Settlement Currency': disb.settlementCurrencyIsoCode || '',
                            'Exchange Rate': disb.settlementCurrencyExchangeRate || '',
                            'Disbursement ID': disb.disbursementId || '',
                            
                            // Merchant
                            'Merchant Account': tx.merchantAccountId || ''
                        };
                    });
                    
                    // Estatísticas
                    const sales = rows.filter(r => r['Tipo'] === 'sale');
                    const refunds = rows.filter(r => r['É Refund'] === 'Sim');
                    const subscriptions = rows.filter(r => r['Subscription ID']);
                    
                    console.log('📊 ESTATÍSTICAS:');
                    console.log(`  Vendas: ${sales.length}`);
                    console.log(`  Refunds: ${refunds.length}`);
                    console.log(`  Com Subscription: ${subscriptions.length}`);
                    
                    // Criar workbook
                    const wb = XLSX.utils.book_new();
                    
                    // Aba 1: Todas transações
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Todas Transações');
                    
                    // Aba 2: Apenas vendas
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales), 'Vendas');
                    
                    // Aba 3: Refunds
                    if (refunds.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refunds), 'Refunds');
                    }
                    
                    // Aba 4: Subscriptions
                    if (subscriptions.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subscriptions), 'Subscriptions');
                    }
                    
                    // Aba 5: Resumo por método pagamento
                    const porMetodo = {};
                    rows.forEach(r => {
                        const key = `${r['Método']}_${r['Bandeira'] || 'N/A'}_${r['Moeda']}`;
                        if (!porMetodo[key]) porMetodo[key] = { metodo: r['Método'], bandeira: r['Bandeira'] || 'N/A', moeda: r['Moeda'], total: 0, qtd: 0 };
                        porMetodo[key].total += r['Valor'];
                        porMetodo[key].qtd += 1;
                    });
                    const resumoMetodo = Object.values(porMetodo).map(r => ({
                        'Método': r.metodo,
                        'Bandeira': r.bandeira,
                        'Moeda': r.moeda,
                        'Total': Math.round(r.total * 100) / 100,
                        'Qtd': r.qtd
                    })).sort((a, b) => b['Total'] - a['Total']);
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoMetodo), 'Por Método');
                    
                    // Aba 6: Resumo por país
                    const porPais = {};
                    rows.forEach(r => {
                        const pais = r['Billing País'] || 'Desconhecido';
                        const moeda = r['Moeda'];
                        const key = `${pais}_${moeda}`;
                        if (!porPais[key]) porPais[key] = { pais, moeda, total: 0, qtd: 0 };
                        porPais[key].total += r['Valor'];
                        porPais[key].qtd += 1;
                    });
                    const resumoPais = Object.values(porPais).map(r => ({
                        'País': r.pais,
                        'Moeda': r.moeda,
                        'Total': Math.round(r.total * 100) / 100,
                        'Qtd': r.qtd
                    })).sort((a, b) => b['Total'] - a['Total']);
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPais), 'Por País');
                    
                    const filename = `braintree-detalhado-${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(wb, filename);
                    
                    console.log(`\n✅ Arquivo salvo: ${filename}`);
                    console.log('\n📋 ABAS:');
                    console.log('  1. Todas Transações - dados completos');
                    console.log('  2. Vendas - apenas vendas');
                    console.log('  3. Refunds - reembolsos');
                    console.log('  4. Subscriptions - assinaturas');
                    console.log('  5. Por Método - resumo por forma pagamento');
                    console.log('  6. Por País - resumo por país');
                    
                    resolve();
                }, 20000); // 20s para coletar todas
            }
        );
    });
}

exportDetalhado().then(() => process.exit(0));
