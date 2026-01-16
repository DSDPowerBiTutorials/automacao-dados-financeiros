/**
 * FORMATADORES GLOBAIS - PADRÃO BRASILEIRO
 * 
 * Datas: DD/MM/YYYY (ex: 31/12/2026)
 * Números: 1.000.000,00 (ponto milhar, vírgula decimal)
 * 
 * USE ESTAS FUNÇÕES EM TODA A APLICAÇÃO!
 */

/**
 * Formata data no padrão brasileiro: DD/MM/YYYY
 * SEM conversão de timezone - mantém a data exata
 * @param dateString - String de data em qualquer formato
 * @returns Data formatada como "31/12/2026"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";

  // Se a data está no formato YYYY-MM-DD, formatar diretamente SEM new Date()
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const [year, month, day] = dateString.split("T")[0].split("-");
    return `${day}/${month}/${year}`;
  }

  // Se já está no formato DD/MM/YYYY, retorna como está
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }

  // Tenta parsear preservando UTC para evitar shift de timezone
  const parsed = parseDateUTC(dateString);

  if (Number.isNaN(parsed.getTime())) {
    const match = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateString;
  }

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Parseia uma data como UTC, evitando deslocamentos por fuso horário local.
 */
export function parseDateUTC(dateString: string): Date {
  const simple = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (simple) {
    const [, y, m, d] = simple;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  return new Date(dateString);
}

/**
 * Formata número no padrão BRASILEIRO: 1.000.000,00
 * Ponto como separador de milhar, vírgula para decimais
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns Número formatado
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value === 0) return "0,00";

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
 * Formata valor monetário com símbolo
 * Padrão: € 1.234,56 ou $ 1.234,56
 * @param value - Valor numérico
 * @param currency - Código da moeda (EUR, USD, GBP, etc.)
 * @returns Valor formatado com símbolo
 */
export function formatCurrency(value: number | null | undefined, currency: string = "EUR"): string {
  if (value === null || value === undefined || isNaN(value)) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol} -`;
  }
  if (value === 0) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol} 0,00`;
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
 * Formata valor em EUR
 */
export function formatEUR(value: number | null | undefined): string {
  return formatCurrency(value, "EUR");
}

/**
 * Formata valor em USD
 */
export function formatUSD(value: number | null | undefined): string {
  return formatCurrency(value, "USD");
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
    BRL: "R$",
  };
  return symbols[currency] || currency;
}

/**
 * Formata timestamp completo no padrão brasileiro
 * @param date - Objeto Date ou string
 * @returns String formatada como "31/12/2026 23:59"
 */
export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
