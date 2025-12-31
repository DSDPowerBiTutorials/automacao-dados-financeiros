/**
 * Braintree API Client Configuration
 * 
 * Inicializa o gateway do Braintree para sincronização de transações.
 * NÃO é usado para processar pagamentos - apenas para buscar dados.
 */

import braintree from "braintree";

// Valida variáveis de ambiente obrigatórias
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

// Determina ambiente (sandbox ou production)
const environment =
  process.env.BRAINTREE_ENVIRONMENT === "production"
    ? braintree.Environment.Production
    : braintree.Environment.Sandbox;

/**
 * Gateway do Braintree - cliente autenticado
 */
export const braintreeGateway = new braintree.BraintreeGateway({
  environment,
  merchantId: process.env.BRAINTREE_MERCHANT_ID!,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY!,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY!,
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
  
  // Fees (importante para contas a pagar)
  serviceFeeAmount?: string;
  discounts?: Array<{
    amount: string;
    id: string;
    name: string;
  }>;
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
  }
): Promise<BraintreeTransactionData[]> {
  return new Promise((resolve, reject) => {
    braintreeGateway.transaction.search(
      (search) => {
        search.createdAt().between(startDate, endDate);
        
        // Apenas aplica filtro de status se especificado
        if (options?.status && options.status.length > 0) {
          search.status().in(options.status);
        }
        // Caso contrário, busca TODOS os status
      },
      (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        
        const transactions: BraintreeTransactionData[] = [];
        
        if (!response || !response.success) {
          resolve([]);
          return;
        }

        // Use each() para iterar pelos resultados
        response.each((err, transaction) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (transaction) {
            transactions.push(transaction as unknown as BraintreeTransactionData);
            
            // Limita quantidade
            if (options?.limit && transactions.length >= options.limit) {
              resolve(transactions);
              return;
            }
          }
        });
        
        // Ao terminar iteração
        setTimeout(() => resolve(transactions), 100);
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
