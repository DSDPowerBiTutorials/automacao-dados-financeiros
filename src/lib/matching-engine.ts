/**
 * Motor de Reconciliação HubSpot ↔ Payment Channels
 * 
 * Implementa as melhores práticas de data matching:
 * - Normalização de strings (Unicode, case-insensitive, trim)
 * - Fuzzy matching com Levenshtein distance
 * - Multi-criteria scoring (email, nome, data, valor)
 * - Confidence scoring transparente
 * - Fallback strategies quando dados parciais
 * - Tolerância configurável para datas e valores
 */

export interface MatchCandidate {
    id: string;
    source: string;
    date: string;
    amount: number;
    customer_email?: string | null;
    customer_name?: string | null;
    description?: string;
    custom_data?: any;
}

export interface MatchResult {
    matched: boolean;
    confidence: number; // 0-100
    matchedId?: string;
    matchedSource?: string;
    reasons: string[];
    details: {
        emailMatch?: 'exact' | 'domain' | 'similar' | 'none';
        emailSimilarity?: number;
        nameMatch?: 'exact' | 'similar' | 'partial' | 'none';
        nameSimilarity?: number;
        dateMatch?: boolean;
        dateDiffDays?: number;
        amountMatch?: boolean;
        amountDiff?: number;
        amountDiffPercent?: number;
    };
}

/**
 * Normaliza email para comparação
 * Remove espaços, converte para minúsculo, remove + aliases, trim
 * BEST PRACTICE: Tratar variações comuns de email
 */
function normalizeEmail(email: string | null | undefined): string {
    if (!email) return '';
    return email
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '') // Remove todos os espaços
        .replace(/\+.*@/, '@') // Remove aliases tipo email+alias@domain.com
        .replace(/\.{2,}/g, '.'); // Remove pontos duplicados
}

/**
 * Extrai domínio do email
 */
function getEmailDomain(email: string | null | undefined): string {
    if (!email) return '';
    const normalized = normalizeEmail(email);
    const parts = normalized.split('@');
    return parts.length === 2 ? parts[1] : '';
}

/**
 * Calcula similaridade entre emails usando Levenshtein
 * BEST PRACTICE: Para detectar typos ou pequenas variações
 */
function calculateEmailSimilarity(email1: string, email2: string): number {
    const e1 = normalizeEmail(email1);
    const e2 = normalizeEmail(email2);

    if (!e1 || !e2) return 0;
    if (e1 === e2) return 100;

    return calculateStringSimilarity(e1, e2);
}

/**
 * Normaliza nome para comparação
 * BEST PRACTICE: Remove acentos, pontuação, normaliza espaços
 * Converte para formato comparável independente de idioma
 */
function normalizeName(name: string | null | undefined): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD') // Decomposição Unicode
        .replace(/[\u0300-\u036f]/g, '') // Remove marcas diacríticas (acentos)
        .replace(/[^\w\s]/g, '') // Remove pontuação
        .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
        .trim();
}

/**
 * Calcula similaridade entre duas strings usando Levenshtein distance
 * BEST PRACTICE: Fuzzy matching para nomes com typos ou variações
 * Retorna: 0-100 (100 = idêntico)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    // Verificar se um está contido no outro (substring match)
    if (s1.includes(s2) || s2.includes(s1)) {
        const shorter = s1.length < s2.length ? s1 : s2;
        const longer = s1.length >= s2.length ? s1 : s2;
        return (shorter.length / longer.length) * 90; // Max 90% para substring
    }

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    // Caso especial: strings muito diferentes em tamanho
    if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
        return 0; // Muito diferentes
    }

    // Inicializar matriz de distância
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Calcular distância de Levenshtein
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // Deleção
                matrix[i][j - 1] + 1,     // Inserção
                matrix[i - 1][j - 1] + cost // Substituição
            );
        }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);

    return maxLen === 0 ? 0 : ((maxLen - distance) / maxLen) * 100;
}

/**
 * Calcula similaridade entre nomes
 * BEST PRACTICE: Trata ordem diferente (John Doe vs Doe John)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);

    if (!n1 || !n2) return 0;
    if (n1 === n2) return 100;

    // Tentar comparação direta
    const directSim = calculateStringSimilarity(n1, n2);
    if (directSim >= 90) return directSim;

    // Tentar comparar palavras individualmente (para ordem diferente)
    const words1 = n1.split(' ').filter(w => w.length > 2); // Ignorar iniciais
    const words2 = n2.split(' ').filter(w => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return directSim;

    // Verificar se todas as palavras de um aparecem no outro
    const matches = words1.filter(w1 =>
        words2.some(w2 => calculateStringSimilarity(w1, w2) >= 80)
    );

    const wordMatchRate = (matches.length / Math.max(words1.length, words2.length)) * 100;

    // Retornar o maior score
    return Math.max(directSim, wordMatchRate);
}

/**
 * Calcula diferença em dias entre duas datas
 */
function dateDiffInDays(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula diferença percentual entre valores
 */
function calculateAmountDiffPercent(amount1: number, amount2: number): number {
    if (amount1 === 0 && amount2 === 0) return 0;
    if (amount1 === 0 || amount2 === 0) return 100;

    const diff = Math.abs(amount1 - amount2);
    const avg = (amount1 + amount2) / 2;
    return (diff / avg) * 100;
}

/**
 * Tenta fazer match de um registro do HubSpot com candidatos de Payment Channels
 */
export function findBestMatch(
    hubspotRecord: MatchCandidate,
    paymentCandidates: MatchCandidate[],
    options: {
        maxDateDiffDays?: number;
        maxAmountDiff?: number;
        minConfidence?: number;
        emailRequired?: boolean;
    } = {}
): MatchResult {
    const {
        maxDateDiffDays = 3,
        maxAmountDiff = 0.01,
        minConfidence = 70,
        emailRequired = false,
    } = options;

    let bestMatch: MatchResult | null = null;

    for (const candidate of paymentCandidates) {
        const result: MatchResult = {
            matched: false,
            confidence: 0,
            reasons: [],
            details: {},
        };

        // 1. VERIFICAR EMAIL
        const hubspotEmail = normalizeEmail(hubspotRecord.customer_email);
        const candidateEmail = normalizeEmail(candidate.customer_email);

        if (hubspotEmail && candidateEmail) {
            if (hubspotEmail === candidateEmail) {
                result.details.emailMatch = 'exact';
                result.confidence += 40; // 40 pontos por email exato
                result.reasons.push('✅ Email exato');
            } else {
                const hubspotDomain = getEmailDomain(hubspotRecord.customer_email);
                const candidateDomain = getEmailDomain(candidate.customer_email);

                if (hubspotDomain && candidateDomain && hubspotDomain === candidateDomain) {
                    result.details.emailMatch = 'domain';
                    result.confidence += 20; // 20 pontos por mesmo domínio
                    result.reasons.push('⚠️ Mesmo domínio de email');
                } else {
                    result.details.emailMatch = 'none';
                }
            }
        } else {
            result.details.emailMatch = 'none';
            if (emailRequired) {
                continue; // Pular se email é obrigatório e não tem
            }
        }

        // 2. VERIFICAR NOME DO CLIENTE
        const hubspotName = normalizeName(hubspotRecord.customer_name);
        const candidateName = normalizeName(candidate.customer_name);

        if (hubspotName && candidateName) {
            const similarity = calculateNameSimilarity(hubspotName, candidateName);
            result.details.nameSimilarity = similarity;

            if (similarity >= 90) {
                result.details.nameMatch = 'exact';
                result.confidence += 25; // 25 pontos por nome exato/quase exato
                result.reasons.push(`✅ Nome muito similar (${similarity.toFixed(0)}%)`);
            } else if (similarity >= 70) {
                result.details.nameMatch = 'similar';
                result.confidence += 15; // 15 pontos por nome similar
                result.reasons.push(`⚠️ Nome similar (${similarity.toFixed(0)}%)`);
            } else {
                result.details.nameMatch = 'none';
            }
        }

        // 3. VERIFICAR DATA (CRÍTICO)
        const dateDiff = dateDiffInDays(hubspotRecord.date, candidate.date);
        result.details.dateDiffDays = dateDiff;

        if (dateDiff <= maxDateDiffDays) {
            result.details.dateMatch = true;
            const datePoints = Math.max(20 - (dateDiff * 5), 10); // 20 pontos se mesmo dia, 10+ se ±3 dias
            result.confidence += datePoints;
            result.reasons.push(`✅ Data próxima (±${dateDiff} dias)`);
        } else {
            result.details.dateMatch = false;
            result.reasons.push(`❌ Data distante (±${dateDiff} dias)`);
            continue; // Pular se data muito diferente
        }

        // 4. VERIFICAR VALOR (CRÍTICO)
        const amountDiff = Math.abs(hubspotRecord.amount - candidate.amount);
        result.details.amountDiff = amountDiff;

        if (amountDiff <= maxAmountDiff) {
            result.details.amountMatch = true;
            result.confidence += 15; // 15 pontos por valor exato
            result.reasons.push(`✅ Valor exato (±€${amountDiff.toFixed(2)})`);
        } else {
            result.details.amountMatch = false;
            result.reasons.push(`❌ Valor diferente (±€${amountDiff.toFixed(2)})`);
            continue; // Pular se valor muito diferente
        }

        // CALCULAR CONFIANÇA FINAL
        // Bonus: se email + valor + data batem = +10 pontos
        if (result.details.emailMatch === 'exact' &&
            result.details.dateMatch &&
            result.details.amountMatch) {
            result.confidence += 10;
            result.reasons.push('🎯 Match perfeito: Email + Valor + Data');
        }

        // Verificar se passou do threshold
        if (result.confidence >= minConfidence) {
            result.matched = true;
            result.matchedId = candidate.id;
            result.matchedSource = candidate.source;

            // Guardar melhor match
            if (!bestMatch || result.confidence > bestMatch.confidence) {
                bestMatch = result;
            }
        }
    }

    return bestMatch || {
        matched: false,
        confidence: 0,
        reasons: ['❌ Nenhum match encontrado com confiança suficiente'],
        details: {},
    };
}

/**
 * Processa lote de matches entre HubSpot e Payment Channels
 */
export async function batchMatch(
    hubspotRecords: MatchCandidate[],
    paymentRecords: MatchCandidate[]
): Promise<Map<string, MatchResult>> {
    const results = new Map<string, MatchResult>();

    for (const hubspotRecord of hubspotRecords) {
        const matchResult = findBestMatch(hubspotRecord, paymentRecords);
        results.set(hubspotRecord.id, matchResult);
    }

    return results;
}

/**
 * Limpa e extrai nome do produto de descrições
 * Remove prefixos, sufixos, códigos comuns
 */
export function cleanProductName(description: string | null | undefined): string {
    if (!description) return '';

    let cleaned = description.trim();

    // Remover padrões comuns no início
    cleaned = cleaned.replace(/^(Product:|Item:|SKU:|Code:)\s*/gi, '');

    // Remover códigos tipo "ABC-123", "XYZ123" no final
    cleaned = cleaned.replace(/\s*[-_]\s*[A-Z0-9]{3,}$/gi, '');

    // Remover quantidades/preços no final tipo " - 1x", " (€100)"
    cleaned = cleaned.replace(/\s*[-–]\s*\d+x?$/gi, '');
    cleaned = cleaned.replace(/\s*\([€$£]\d+.*?\)$/gi, '');

    // Remover "DSD" prefixes comuns
    cleaned = cleaned.replace(/^DSD\s+(Provider|Master|Planning|Residency|Workshop)\s+/gi, 'DSD $1 ');

    // Remover datas/anos soltos tipo "2025", "2024"
    cleaned = cleaned.replace(/\s+20\d{2}$/g, '');

    // Remover regiões tipo "EUR", "USD", "ROW"
    cleaned = cleaned.replace(/\s+(EUR|USD|GBP|ROW)$/gi, '');

    // Normalizar espaços
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}

/**
 * Extrai moeda de descrição ou campo
 */
export function extractCurrency(
    description: string | null | undefined,
    currencyField?: string | null
): string {
    if (currencyField) return currencyField.toUpperCase();

    if (!description) return 'EUR'; // Default

    const matches = description.match(/\b(EUR|USD|GBP|BRL)\b/gi);
    return matches ? matches[0].toUpperCase() : 'EUR';
}
