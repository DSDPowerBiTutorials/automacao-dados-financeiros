/**
 * Formata data no padrão brasileiro: DD/MM/YYYY
 * @param dateString - String de data em qualquer formato
 * @returns Data formatada como "31/12/2025"
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";

  // Tenta parsear a data
  const date = new Date(dateString);

  // Verifica se é uma data válida
  if (isNaN(date.getTime())) {
    // Se não conseguir parsear, tenta extrair DD/MM/YYYY do próprio string
    const match = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateString; // Retorna original se não conseguir formatar
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formata número no padrão: #.##0,0;(#.##0,0);-
 * Exemplos: 1.234,56 | (1.234,56) para negativos | - para zero
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns Número formatado
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value === 0) return "-";

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  // Formata com separador de milhares (.) e decimais (,)
  const formatted = absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // Se negativo, envolve em parênteses
  return isNegative ? `(${formatted})` : formatted;
}

/**
 * Formata valor monetário em EUR
 * @param value - Valor numérico
 * @param currency - Código da moeda (EUR, USD, GBP, etc.)
 * @returns Valor formatado com símbolo e padrão brasileiro
 */
export function formatCurrency(value: number, currency: string = "EUR"): string {
  if (value === 0) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol} -`;
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const formatted = absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = getCurrencySymbol(currency);
  return isNegative ? `${symbol} (${formatted})` : `${symbol} ${formatted}`;
}

/**
 * Retorna o símbolo da moeda
 */
function getCurrencySymbol(currency: string): string {
  const symbols: { [key: string]: string } = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    AUD: "A$",
  };
  return symbols[currency] || currency;
}

/**
 * Formata timestamp completo no padrão brasileiro
 * @param date - Objeto Date
 * @returns String formatada como "31/12/2025 23:59"
 */
export function formatTimestamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
