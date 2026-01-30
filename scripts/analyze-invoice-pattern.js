require('dotenv').config({ path: '.env.local' });

// Análise do padrão do invoice number
// #DSDESC7599A2-53202
// 
// Parece ser:
// - DSD = prefixo da empresa
// - ES = country code (Espanha)
// - C7599A2 = order_code (em maiúsculas)
// - 53202 = número sequencial ou ID único
//
// A pergunta é: de onde vem o 53202 e a data 03/12/2025?

console.log("📊 Análise do padrão de Invoice Number\n");
console.log("Invoice: #DSDESC7599A2-53202");
console.log("");
console.log("Decomposição:");
console.log("  - DSD = Prefixo empresa");
console.log("  - ES = Country code (Espanha)");
console.log("  - C7599A2 = Order code (maiúsculas)");
console.log("  - 53202 = ID sequencial ou referência única");
console.log("");
console.log("💡 O número 53202 pode ser:");
console.log("  1. Um ID interno do sistema de e-commerce");
console.log("  2. Um número de invoice sequencial");
console.log("  3. Uma referência do datawarehouse");
console.log("");
console.log("📅 A data 03/12/2025 (Invoice Date) provavelmente é:");
console.log("  1. Data de criação da invoice no sistema");
console.log("  2. Data do primeiro pagamento");
console.log("  3. Data de faturamento definida manualmente");
console.log("");
console.log("🔧 SOLUÇÃO SUGERIDA:");
console.log("  Se você tem acesso ao report do datawarehouse,");
console.log("  podemos importar esse CSV e fazer o merge com");
console.log("  os dados do HubSpot usando o order_code como chave.");
