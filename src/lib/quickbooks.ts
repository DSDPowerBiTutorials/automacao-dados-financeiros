/**
 * QuickBooks Integration Library
 * 
 * Handles OAuth2 authentication and API calls to QuickBooks Online
 * Documentation: https://developer.intuit.com/app/developer/qbo/docs/get-started
 */

import { supabaseAdmin } from "@/lib/supabase-admin"

// QuickBooks API Configuration
const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID!
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET!
const QUICKBOOKS_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || "https://www.dsdfinancehub.com/api/quickbooks/callback"
const QUICKBOOKS_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || "production" // "sandbox" or "production"

// QuickBooks API Base URLs
const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const QUICKBOOKS_API_BASE = QUICKBOOKS_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com"

// Scopes needed for financial data
const QUICKBOOKS_SCOPES = [
    "com.intuit.quickbooks.accounting",
    "openid",
    "profile",
    "email"
].join(" ")

export interface QuickBooksTokens {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    x_refresh_token_expires_in: number
    realm_id: string
    created_at?: string
}

export interface QuickBooksCompanyInfo {
    CompanyName: string
    LegalName?: string
    Country?: string
    FiscalYearStartMonth?: string
    CompanyAddr?: {
        Line1?: string
        City?: string
        Country?: string
        PostalCode?: string
    }
}

export interface QuickBooksInvoice {
    Id: string
    DocNumber: string
    TxnDate: string
    DueDate?: string
    TotalAmt: number
    Balance: number
    CustomerRef?: {
        value: string
        name: string
    }
    Line?: Array<{
        Description?: string
        Amount: number
        DetailType: string
    }>
    CurrencyRef?: {
        value: string
    }
}

export interface QuickBooksPayment {
    Id: string
    TxnDate: string
    TotalAmt: number
    CustomerRef?: {
        value: string
        name: string
    }
    PaymentMethodRef?: {
        value: string
        name: string
    }
    DepositToAccountRef?: {
        value: string
        name: string
    }
}

export interface QuickBooksAccount {
    Id: string
    Name: string
    AccountType: string
    AccountSubType?: string
    CurrentBalance?: number
    CurrencyRef?: {
        value: string
    }
    Active: boolean
}

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
        client_id: QUICKBOOKS_CLIENT_ID,
        redirect_uri: QUICKBOOKS_REDIRECT_URI,
        response_type: "code",
        scope: QUICKBOOKS_SCOPES,
        state: state || generateRandomState()
    })

    return `${QUICKBOOKS_AUTH_URL}?${params.toString()}`
}

/**
 * Generate random state for OAuth security
 */
function generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, realmId: string): Promise<QuickBooksTokens> {
    const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64")

    const response = await fetch(QUICKBOOKS_TOKEN_URL, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: QUICKBOOKS_REDIRECT_URI
        })
    })

    if (!response.ok) {
        const error = await response.text()
        console.error("❌ QuickBooks token exchange failed:", error)
        throw new Error(`Token exchange failed: ${error}`)
    }

    const tokens = await response.json()

    return {
        ...tokens,
        realm_id: realmId,
        created_at: new Date().toISOString()
    }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<QuickBooksTokens> {
    const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64")

    const response = await fetch(QUICKBOOKS_TOKEN_URL, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken
        })
    })

    if (!response.ok) {
        const error = await response.text()
        console.error("❌ QuickBooks token refresh failed:", error)
        throw new Error(`Token refresh failed: ${error}`)
    }

    return await response.json()
}

/**
 * Store tokens in Supabase
 */
export async function storeTokens(tokens: QuickBooksTokens): Promise<void> {
    if (!supabaseAdmin) {
        throw new Error("Supabase not configured")
    }

    const { error } = await supabaseAdmin
        .from("quickbooks_tokens")
        .upsert({
            id: "default",
            realm_id: tokens.realm_id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type,
            expires_in: tokens.expires_in,
            x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
            created_at: tokens.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: "id" })

    if (error) {
        console.error("❌ Error storing tokens:", error)
        throw error
    }

    console.log("✅ QuickBooks tokens stored successfully")
}

/**
 * Get stored tokens from Supabase
 */
export async function getStoredTokens(): Promise<QuickBooksTokens | null> {
    if (!supabaseAdmin) {
        throw new Error("Supabase not configured")
    }

    const { data, error } = await supabaseAdmin
        .from("quickbooks_tokens")
        .select("*")
        .eq("id", "default")
        .single()

    if (error || !data) {
        return null
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        x_refresh_token_expires_in: data.x_refresh_token_expires_in,
        realm_id: data.realm_id,
        created_at: data.created_at
    }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string }> {
    const tokens = await getStoredTokens()

    if (!tokens) {
        throw new Error("No QuickBooks tokens found. Please connect to QuickBooks first.")
    }

    // Check if token is expired (with 5 min buffer)
    const createdAt = new Date(tokens.created_at || 0).getTime()
    const expiresAt = createdAt + (tokens.expires_in * 1000) - (5 * 60 * 1000)
    const isExpired = Date.now() > expiresAt

    if (isExpired) {
        console.log("🔄 QuickBooks access token expired, refreshing...")
        const newTokens = await refreshAccessToken(tokens.refresh_token)
        const updatedTokens = {
            ...newTokens,
            realm_id: tokens.realm_id,
            created_at: new Date().toISOString()
        }
        await storeTokens(updatedTokens)
        return { accessToken: updatedTokens.access_token, realmId: tokens.realm_id }
    }

    return { accessToken: tokens.access_token, realmId: tokens.realm_id }
}

/**
 * Make authenticated API request to QuickBooks
 */
async function makeApiRequest<T>(endpoint: string, method: string = "GET", body?: any): Promise<T> {
    const { accessToken, realmId } = await getValidAccessToken()

    const url = `${QUICKBOOKS_API_BASE}/v3/company/${realmId}/${endpoint}`

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
    }

    if (body) {
        headers["Content-Type"] = "application/json"
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`❌ QuickBooks API error (${endpoint}):`, error)
        throw new Error(`QuickBooks API error: ${error}`)
    }

    return await response.json()
}

/**
 * Get company information
 */
export async function getCompanyInfo(): Promise<QuickBooksCompanyInfo> {
    const response = await makeApiRequest<{ CompanyInfo: QuickBooksCompanyInfo }>("companyinfo")
    return response.CompanyInfo
}

/**
 * Get all invoices
 */
export async function getInvoices(startDate?: string, endDate?: string): Promise<QuickBooksInvoice[]> {
    let query = "SELECT * FROM Invoice"

    if (startDate && endDate) {
        query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
    } else if (startDate) {
        query += ` WHERE TxnDate >= '${startDate}'`
    }

    query += " ORDERBY TxnDate DESC MAXRESULTS 1000"

    const response = await makeApiRequest<{ QueryResponse: { Invoice?: QuickBooksInvoice[] } }>(
        `query?query=${encodeURIComponent(query)}`
    )

    return response.QueryResponse.Invoice || []
}

/**
 * Get all payments
 */
export async function getPayments(startDate?: string, endDate?: string): Promise<QuickBooksPayment[]> {
    let query = "SELECT * FROM Payment"

    if (startDate && endDate) {
        query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
    } else if (startDate) {
        query += ` WHERE TxnDate >= '${startDate}'`
    }

    query += " ORDERBY TxnDate DESC MAXRESULTS 1000"

    const response = await makeApiRequest<{ QueryResponse: { Payment?: QuickBooksPayment[] } }>(
        `query?query=${encodeURIComponent(query)}`
    )

    return response.QueryResponse.Payment || []
}

/**
 * Get all bank accounts
 */
export async function getBankAccounts(): Promise<QuickBooksAccount[]> {
    const query = "SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 100"

    const response = await makeApiRequest<{ QueryResponse: { Account?: QuickBooksAccount[] } }>(
        `query?query=${encodeURIComponent(query)}`
    )

    return response.QueryResponse.Account || []
}

/**
 * Get all accounts (Chart of Accounts)
 */
export async function getAllAccounts(): Promise<QuickBooksAccount[]> {
    const query = "SELECT * FROM Account WHERE Active = true MAXRESULTS 500"

    const response = await makeApiRequest<{ QueryResponse: { Account?: QuickBooksAccount[] } }>(
        `query?query=${encodeURIComponent(query)}`
    )

    return response.QueryResponse.Account || []
}

/**
 * Get profit and loss report
 */
export async function getProfitAndLossReport(startDate: string, endDate: string): Promise<any> {
    const response = await makeApiRequest<any>(
        `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`
    )

    return response
}

/**
 * Get balance sheet report
 */
export async function getBalanceSheetReport(asOfDate: string): Promise<any> {
    const response = await makeApiRequest<any>(
        `reports/BalanceSheet?date_macro=Custom&start_date=${asOfDate}&end_date=${asOfDate}`
    )

    return response
}

/**
 * Sync QuickBooks invoices to csv_rows table
 */
export async function syncInvoicesToDatabase(startDate?: string): Promise<{ count: number }> {
    const invoices = await getInvoices(startDate)

    if (!supabaseAdmin) {
        throw new Error("Supabase not configured")
    }

    const rows = invoices.map((invoice) => ({
        id: `qb-invoice-${invoice.Id}`,
        file_name: "quickbooks-sync",
        source: "quickbooks-invoices",
        date: invoice.TxnDate,
        description: `Invoice #${invoice.DocNumber} - ${invoice.CustomerRef?.name || "Unknown Customer"}`,
        amount: invoice.TotalAmt.toString(),
        category: "Revenue",
        classification: "Invoice",
        reconciled: invoice.Balance === 0,
        custom_data: {
            quickbooks_id: invoice.Id,
            doc_number: invoice.DocNumber,
            customer_name: invoice.CustomerRef?.name,
            customer_id: invoice.CustomerRef?.value,
            due_date: invoice.DueDate,
            balance: invoice.Balance,
            total_amount: invoice.TotalAmt,
            currency: invoice.CurrencyRef?.value || "USD",
            synced_at: new Date().toISOString()
        }
    }))

    if (rows.length > 0) {
        const { error } = await supabaseAdmin
            .from("csv_rows")
            .upsert(rows, { onConflict: "id" })

        if (error) {
            console.error("❌ Error syncing invoices:", error)
            throw error
        }
    }

    console.log(`✅ Synced ${rows.length} invoices from QuickBooks`)
    return { count: rows.length }
}

/**
 * Sync QuickBooks payments to csv_rows table
 */
export async function syncPaymentsToDatabase(startDate?: string): Promise<{ count: number }> {
    const payments = await getPayments(startDate)

    if (!supabaseAdmin) {
        throw new Error("Supabase not configured")
    }

    const rows = payments.map((payment) => ({
        id: `qb-payment-${payment.Id}`,
        file_name: "quickbooks-sync",
        source: "quickbooks-payments",
        date: payment.TxnDate,
        description: `Payment from ${payment.CustomerRef?.name || "Unknown"} via ${payment.PaymentMethodRef?.name || "Unknown"}`,
        amount: payment.TotalAmt.toString(),
        category: "Revenue",
        classification: "Payment",
        reconciled: true,
        custom_data: {
            quickbooks_id: payment.Id,
            customer_name: payment.CustomerRef?.name,
            customer_id: payment.CustomerRef?.value,
            payment_method: payment.PaymentMethodRef?.name,
            deposit_account: payment.DepositToAccountRef?.name,
            total_amount: payment.TotalAmt,
            synced_at: new Date().toISOString()
        }
    }))

    if (rows.length > 0) {
        const { error } = await supabaseAdmin
            .from("csv_rows")
            .upsert(rows, { onConflict: "id" })

        if (error) {
            console.error("❌ Error syncing payments:", error)
            throw error
        }
    }

    console.log(`✅ Synced ${rows.length} payments from QuickBooks`)
    return { count: rows.length }
}

/**
 * Test QuickBooks connection
 */
export async function testConnection(): Promise<{ connected: boolean; company?: QuickBooksCompanyInfo; error?: string }> {
    try {
        const company = await getCompanyInfo()
        return { connected: true, company }
    } catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }
    }
}
