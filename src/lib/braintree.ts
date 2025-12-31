/**
 * Braintree API Client Configuration
 * 
 * Inicializa o gateway do Braintree para sincronização de transações.
 * NÃO é usado para processar pagamentos - apenas para buscar dados.
 */

import braintree from "braintree";

/**
 * Valida variáveis de ambiente (executa apenas quando gateway for acessado)
 */
function validateEnvVars() {
  const requiredEnvVars = [
    "BRAINTREE_MERCHANT_ID",
    "BRAINTREE_PUBLIC_KEY",
    "BRAINTREE_PRIVATE_KEY",
    "BRAINTREE_ENVIRONMENT",
  ] as const;

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `Missing required environment variable: ${envVar}. Check your .env.local file.`
      );
    }
  }
}

/**
 * Gateway do Braintree - lazy initialization
 */
let _gateway: braintree.BraintreeGateway | null = null;

export const braintreeGateway = new Proxy({} as braintree.BraintreeGateway, {
  get(target, prop) {
    if (!_gateway) {
      validateEnvVars();

      const environment =
        process.env.BRAINTREE_ENVIRONMENT === "production"
          ? braintree.Environment.Production
          : braintree.Environment.Sandbox;

      _gateway = new braintree.BraintreeGateway({
        environment,
        merchantId: process.env.BRAINTREE_MERCHANT_ID!,
        publicKey: process.env.BRAINTREE_PUBLIC_KEY!,
        privateKey: process.env.BRAINTREE_PRIVATE_KEY!,
      });
    }

    return (_gateway as any)[prop];
  },
});

/**
 * Tipos customizados para nossas necessidades
 */
export interface BraintreeTransactionData {
  id: string;
  amount: string;
  status: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  merchantAccountId: string;

  // Dados do cliente
  customer?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };

  // Método de pagamento
  paymentInstrumentType?: string;
  creditCard?: {
    cardType?: string;
    last4?: string;
  };
  paypalAccount?: {
    payerEmail?: string;
  };
  
  // Moeda da transação
  currencyIsoCode?: string;

  // Fees (importante para contas a pagar)
  serviceFeeAmount?: string;
  discounts?: Array<{
    amount: string;
    id: string;
    name: string;
  }>;
  
  // 💰 Disbursement Details (para reconciliação bancária)
  disbursementDetails?: {
    disbursementDate?: Date;
    settlementAmount?: string;
    settlementCurrencyIsoCode?: string;
    settlementCurrencyExchangeRate?: string;
    fundsHeld?: boolean;
  };
}

/**
 * Helper: Buscar transações em um intervalo de datas
 * Busca TODAS as transações, independente do status
 */
export async function searchTransactions(
  startDate: Date,
  endDate: Date,
  options?: {
    status?: braintree.Transaction.Status[];
    limit?: number;
    merchantAccountId?: string;
  }
): Promise<BraintreeTransactionData[]> {
  return new Promise((resolve, reject) => {
    console.log(`[searchTransactions] Buscando entre ${startDate.toISOString()} e ${endDate.toISOString()}`);

    braintreeGateway.transaction.search(
      (search) => {
        search.createdAt().between(startDate, endDate);

        // Apenas aplica filtro de status se especificado
        if (options?.status && options.status.length > 0) {
          search.status().in(options.status);
          console.log(`[searchTransactions] Filtrando por status:`, options.status);
        }

        // Filtro por merchant account (se especificado)
        if (options?.merchantAccountId) {
          search.merchantAccountId().is(options.merchantAccountId);
          console.log(`[searchTransactions] Filtrando por merchant account:`, options.merchantAccountId);
        }
        // Caso contrário, busca TODOS os merchant accounts
      },
      (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        const transactions: BraintreeTransactionData[] = [];

        console.log(`[searchTransactions] Response success:`, response?.success);
        console.log(`[searchTransactions] Response type:`, typeof response);

        if (!response || !response.success) {
          console.log(`[searchTransactions] Response inválida ou não sucesso, retornando array vazio`);
          resolve([]);
          return;
        }

        // Use each() para iterar pelos resultados
        let hasError = false;
        let hasEnded = false;
        
        response.each((err, transaction) => {
          if (hasError || hasEnded) return;
          
          if (err) {
            console.error(`[searchTransactions] Erro ao iterar:`, err);
            hasError = true;
            reject(err);
            return;
          }

          if (transaction) {
            console.log(`[searchTransactions] Transação encontrada: ${transaction.id} - ${transaction.amount}`);
            transactions.push(transaction as unknown as BraintreeTransactionData);

            // Limita quantidade
            if (options?.limit && transactions.length >= options.limit) {
              hasEnded = true;
              resolve(transactions);
              return;
            }
          }
        });

        // Aguarda mais tempo para garantir que todas foram processadas
        setTimeout(() => {
          if (!hasError && !hasEnded) {
            console.log(`[searchTransactions] Busca finalizada. Total: ${transactions.length}`);
            resolve(transactions);
          }
        }, 2000); // Aumentado para 2 segundos
      }
    );
  });
}

/**
 * Helper: Buscar transação por ID
 */
export async function getTransaction(transactionId: string) {
  return braintreeGateway.transaction.find(transactionId);
}

/**
 * Helper: Calcular fee total de uma transação
 * (service fee + outros descontos negativos)
 */
export function calculateTransactionFee(
  transaction: BraintreeTransactionData
): number {
  let totalFee = 0;

  if (transaction.serviceFeeAmount) {
    totalFee += parseFloat(transaction.serviceFeeAmount);
  }

  // Adiciona outros fees que possam estar em discounts
  if (transaction.discounts) {
    transaction.discounts.forEach((discount) => {
      // Fees geralmente aparecem como valores negativos
      const discountAmount = parseFloat(discount.amount);
      if (discountAmount < 0) {
        totalFee += Math.abs(discountAmount);
      }
    });
  }

  return totalFee;
}

/**
 * Helper: Extrair nome do cliente de forma segura
 */
export function getCustomerName(transaction: BraintreeTransactionData): string {
  if (!transaction.customer) return "Unknown";

  const { firstName, lastName, email } = transaction.customer;

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) return firstName;
  if (lastName) return lastName;
  if (email) return email;

  return `Customer ${transaction.customer.id}`;
}

/**
 * Helper: Extrair método de pagamento
 */
export function getPaymentMethod(transaction: BraintreeTransactionData): string {
  switch (transaction.paymentInstrumentType) {
    case "credit_card":
      return transaction.creditCard?.cardType
        ? `${transaction.creditCard.cardType} ****${transaction.creditCard.last4}`
        : "Credit Card";
    case "paypal_account":
      return transaction.paypalAccount?.payerEmail
        ? `PayPal (${transaction.paypalAccount.payerEmail})`
        : "PayPal";
    default:
      return transaction.paymentInstrumentType || "Unknown";
  }
}
