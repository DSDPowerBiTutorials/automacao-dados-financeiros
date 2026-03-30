/**
 * Tooltip and calculation explanation content
 * Used for info icons throughout Executive Insights pages
 */

export const TOOLTIPS = {
    // Revenue Trends page
    revenueTrendsHeader: `Revenue is calculated as the sum of all invoice amounts from your financial system, grouped by month and client level. The trend line uses linear regression to project future revenue based on the last 12 months of data.`,

    revenueTrendsKpi: (level: string) =>
        `Total revenue from ${level} customers in the selected period, including all products and services.`,

    revenueTrendsForecast: `The dashed line shows a 3-month forward projection using linear regression. Historical data is shown as a solid line.`,

    revenueTrendsTrendPercent: (level: string) =>
        `Month-over-month or period-over-period revenue growth for ${level}.`,

    // Customer Health page
    customerHealthHeader: `Customer Health KPIs show the quality and engagement of your customer base across all products. These metrics help identify growth opportunities and potential churn risks. Data is based on the last 12 months.`,

    customerHealthLTV: `Lifetime Value (LTV): Average total revenue generated per customer. Calculated as total revenue from all invoices ÷ number of unique customers.`,

    customerHealthChurn: `Churn Rate: Percentage of customers inactive for 90+ days (no purchases in the last 90 days). Lower is better.`,

    customerHealthAvgOrderValue: `Average Order Value: Total revenue ÷ total number of orders. Shows transaction size and customer spending patterns.`,

    customerHealthRepeatRate: `Repeat Rate: Percentage of customers who made 2 or more purchases. Higher indicates customer loyalty and recurring revenue potential.`,

    customerHealthCustomerCount: `Total number of unique customers in this level during the analysis period.`,

    // Market Performance page
    marketPerformanceHeader: `Market Performance Score (0-100) combines three key factors: Revenue Growth (40% weight) shows acceleration. Customer Acquisition Trend (30%) shows if you're gaining or losing customers. Concentration Risk (30%) measures customer diversification—lower concentration (spread across many customers) is better. Formula: (RevenueGrowth × 0.4 + CustomerTrend × 0.3 − ConcentrationRisk × 0.3) scaled 0-100.`,

    marketPerformanceScore: (level: string) =>
        `Overall Market Performance Score for ${level}. Scores >70 are strong, 50-70 are moderate, <50 need attention.`,

    marketPerformanceRevenueGrowth: (period: string) =>
        `Revenue growth rate comparing current period to previous ${period}. Positive means growing, negative means declining.`,

    marketPerformanceCustomerTrend: `Customer acquisition trend: growth in the number of active customers. Positive means growing customer base, negative means customer loss.`,

    marketPerformanceConcentration: `Concentration Risk: % of total revenue from your top 5 customers. High concentration (>40%) means over-reliance on few clients. Lower is safer.`,

    marketPerformanceBestPerformer: `This level shows the strongest overall performance based on the composite scoring model.`,

    marketPerformanceAtRisk: `This level needs attention: declining revenue, losing customers, or high concentration risk.`,
};

/**
 * Calculation methodology explanations
 */
export const CALCULATION_NOTES = {
    revenueByLevel: `Revenue Trends: Sum of ar_invoices.invoice_amount grouped by month and client level. Levels are determined by financial_account_code: 104.1/3 = Lvl3_ROW, 104.2/4 = Lvl3_AMEX, 104.5 = Lvl2, 104.6 = Lvl1. Trend line uses linear regression on 12-month historical data with 3-month forward forecast.`,

    customerHealthByLevel: `Customer Health: Aggregated per customer per level. LTV = sum(revenue per customer) / customer_count. Churn = customers inactive >90 days / total customers × 100%. Avg Order Value = total revenue / order count. Repeat Rate = customers with 2+ orders / total customers × 100%.`,

    marketPerformanceByLevel: `Market Performance Score formula: (RevenueGrowth × 0.4 + CustomerCountTrend × 0.3 − ConcentrationRisk × 0.3), scaled to 0-100. Revenue Growth = (current period − previous period) / previous × 100%. Customer Trend = (current customer count − previous) / previous × 100%. Concentration Risk = (sum of top 5 customer revenues / total revenue) × 100%.`,
};

/**
 * Level filter descriptions
 */
export const LEVEL_DESCRIPTIONS = {
    Lvl3_ROW: "Level 3 clients using ROW payment method (FA codes 104.1, 104.3)",
    Lvl3_AMEX: "Level 3 clients using AMEX payment method (FA codes 104.2, 104.4)",
    Lvl2: "Level 2 clients (FA code 104.5)",
    Lvl1: "Level 1 clients (FA code 104.6)",
};
