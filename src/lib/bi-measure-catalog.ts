import { type MeasureDefinition, type MeasureCategory } from "./bi-types";

export const MEASURE_CATEGORIES: { id: MeasureCategory; label: string; icon: string }[] = [
    { id: "aggregation", label: "Aggregation", icon: "Calculator" },
    { id: "math", label: "Mathematical", icon: "Sigma" },
    { id: "time-intelligence", label: "Time Intelligence", icon: "Clock" },
    { id: "comparison", label: "Comparisons", icon: "ArrowLeftRight" },
    { id: "statistical", label: "Statistical", icon: "BarChart3" },
    { id: "logical", label: "Logical", icon: "GitBranch" },
];

export const MEASURE_CATALOG: MeasureDefinition[] = [
    // ── Aggregation ──────────────────────────────────────────
    {
        type: "SUM", label: "Sum", category: "aggregation", icon: "Plus",
        description: "Sum of all values in a field",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "AVERAGE", label: "Average", category: "aggregation", icon: "Minus",
        description: "Average (mean) of values in a field",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "COUNT", label: "Count", category: "aggregation", icon: "Hash",
        description: "Count of rows",
        params: [{ name: "field", label: "Field", type: "field", required: false }],
    },
    {
        type: "COUNTDISTINCT", label: "Count Distinct", category: "aggregation", icon: "Hash",
        description: "Count of unique values",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "MIN", label: "Minimum", category: "aggregation", icon: "ChevronDown",
        description: "Minimum value in a field",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "MAX", label: "Maximum", category: "aggregation", icon: "ChevronUp",
        description: "Maximum value in a field",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "MEDIAN", label: "Median", category: "aggregation", icon: "AlignCenter",
        description: "Median (50th percentile) of values",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },

    // ── Mathematical ─────────────────────────────────────────
    {
        type: "DIVIDE", label: "Divide", category: "math", icon: "Divide",
        description: "Safe division (returns 0 on division by zero)",
        params: [
            { name: "numerator", label: "Numerator", type: "measure", required: true },
            { name: "denominator", label: "Denominator", type: "measure", required: true },
        ],
    },
    {
        type: "ABS", label: "Absolute Value", category: "math", icon: "SquareFunction",
        description: "Absolute value of a measure",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "ROUND", label: "Round", category: "math", icon: "Circle",
        description: "Round to N decimal places",
        params: [
            { name: "measure", label: "Measure", type: "measure", required: true },
            { name: "decimals", label: "Decimal Places", type: "number", required: true },
        ],
    },
    {
        type: "PERCENTAGE", label: "Percentage of Total", category: "math", icon: "Percent",
        description: "Value as percentage of total",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },

    // ── Time Intelligence ────────────────────────────────────
    {
        type: "SAMEPERIODLASTYEAR", label: "Same Period Last Year", category: "time-intelligence", icon: "CalendarDays",
        description: "Value from the same period in the previous year",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "PREVIOUSMONTH", label: "Previous Month", category: "time-intelligence", icon: "ArrowLeft",
        description: "Value from the previous month",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "PREVIOUSQUARTER", label: "Previous Quarter", category: "time-intelligence", icon: "ArrowLeft",
        description: "Value from the previous quarter",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "PREVIOUSYEAR", label: "Previous Year", category: "time-intelligence", icon: "ArrowLeft",
        description: "Value from the previous year",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "DATEADD", label: "Date Offset", category: "time-intelligence", icon: "CalendarPlus",
        description: "Shift date by N periods (months, quarters, years)",
        params: [
            { name: "measure", label: "Measure", type: "measure", required: true },
            { name: "offset", label: "Offset", type: "number", required: true },
            { name: "period", label: "Period", type: "select", required: true, options: ["month", "quarter", "year"] },
        ],
    },
    {
        type: "TOTALYTD", label: "Year-to-Date Total", category: "time-intelligence", icon: "CalendarRange",
        description: "Running total from start of year to current period",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "TOTALMTD", label: "Month-to-Date Total", category: "time-intelligence", icon: "CalendarRange",
        description: "Running total from start of month",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "TOTALQTD", label: "Quarter-to-Date Total", category: "time-intelligence", icon: "CalendarRange",
        description: "Running total from start of quarter",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "RUNNINGTOTAL", label: "Running Total", category: "time-intelligence", icon: "TrendingUp",
        description: "Cumulative running total over time",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "MOVINGAVERAGE", label: "Moving Average", category: "time-intelligence", icon: "Activity",
        description: "Average over N rolling periods",
        params: [
            { name: "measure", label: "Measure", type: "measure", required: true },
            { name: "periods", label: "Periods", type: "number", required: true },
        ],
    },

    // ── Comparisons ──────────────────────────────────────────
    {
        type: "YEAR_OVER_YEAR", label: "Year over Year %", category: "comparison", icon: "ArrowUpRight",
        description: "Percentage change compared to same period last year",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "MONTH_OVER_MONTH", label: "Month over Month %", category: "comparison", icon: "ArrowUpRight",
        description: "Percentage change compared to previous month",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "QUARTER_OVER_QUARTER", label: "Quarter over Quarter %", category: "comparison", icon: "ArrowUpRight",
        description: "Percentage change compared to previous quarter",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },
    {
        type: "PERIOD_COMPARISON", label: "Period Comparison", category: "comparison", icon: "ArrowLeftRight",
        description: "Compare a variable between two custom date ranges",
        params: [
            { name: "measure", label: "Variable", type: "measure", required: true },
            { name: "period1Start", label: "Period 1 Start", type: "date", required: true },
            { name: "period1End", label: "Period 1 End", type: "date", required: true },
            { name: "period2Start", label: "Period 2 Start", type: "date", required: true },
            { name: "period2End", label: "Period 2 End", type: "date", required: true },
        ],
    },
    {
        type: "VARIANCE", label: "Variance (Absolute)", category: "comparison", icon: "Minus",
        description: "Absolute difference between two measures",
        params: [
            { name: "measure1", label: "Measure A", type: "measure", required: true },
            { name: "measure2", label: "Measure B", type: "measure", required: true },
        ],
    },
    {
        type: "VARIANCE_PERCENT", label: "Variance %", category: "comparison", icon: "Percent",
        description: "Percentage difference between two measures",
        params: [
            { name: "measure1", label: "Measure A", type: "measure", required: true },
            { name: "measure2", label: "Measure B", type: "measure", required: true },
        ],
    },
    {
        type: "DELTA", label: "Delta (Change)", category: "comparison", icon: "Triangle",
        description: "Change from previous period",
        params: [{ name: "measure", label: "Measure", type: "measure", required: true }],
    },

    // ── Statistical ──────────────────────────────────────────
    {
        type: "STANDARDDEVIATION", label: "Std Deviation", category: "statistical", icon: "Sigma",
        description: "Standard deviation of values",
        params: [{ name: "field", label: "Field", type: "field", required: true }],
    },
    {
        type: "PERCENTILE", label: "Percentile", category: "statistical", icon: "BarChart3",
        description: "Value at a given percentile",
        params: [
            { name: "field", label: "Field", type: "field", required: true },
            { name: "percentile", label: "Percentile (0-100)", type: "number", required: true },
        ],
    },
    {
        type: "RANK", label: "Rank", category: "statistical", icon: "ListOrdered",
        description: "Rank values in ascending or descending order",
        params: [
            { name: "field", label: "Field", type: "field", required: true },
            { name: "order", label: "Order", type: "select", required: true, options: ["asc", "desc"] },
        ],
    },
    {
        type: "TOPN", label: "Top N", category: "statistical", icon: "ChevronsUp",
        description: "Top N values",
        params: [
            { name: "field", label: "Field", type: "field", required: true },
            { name: "n", label: "N", type: "number", required: true },
        ],
    },
    {
        type: "BOTTOMN", label: "Bottom N", category: "statistical", icon: "ChevronsDown",
        description: "Bottom N values",
        params: [
            { name: "field", label: "Field", type: "field", required: true },
            { name: "n", label: "N", type: "number", required: true },
        ],
    },

    // ── Logical ──────────────────────────────────────────────
    {
        type: "IF", label: "If / Then / Else", category: "logical", icon: "GitBranch",
        description: "Conditional: if condition then A else B",
        params: [
            { name: "condition", label: "Condition", type: "text", required: true },
            { name: "trueValue", label: "Then", type: "measure", required: true },
            { name: "falseValue", label: "Else", type: "measure", required: true },
        ],
    },
    {
        type: "SWITCH", label: "Switch", category: "logical", icon: "ListTree",
        description: "Multi-condition switch (like nested IF)",
        params: [
            { name: "expression", label: "Expression", type: "text", required: true },
            { name: "cases", label: "Cases (JSON)", type: "text", required: true },
        ],
    },
    {
        type: "CALCULATE", label: "Calculate (with Filters)", category: "logical", icon: "Filter",
        description: "Apply a measure with contextual filter overrides",
        params: [
            { name: "measure", label: "Measure", type: "measure", required: true },
            { name: "filters", label: "Filters (JSON)", type: "text", required: true },
        ],
    },
    {
        type: "FILTER", label: "Filter", category: "logical", icon: "Filter",
        description: "Filter a dataset before aggregation",
        params: [
            { name: "field", label: "Field", type: "field", required: true },
            { name: "operator", label: "Operator", type: "select", required: true, options: ["=", "!=", ">", "<", ">=", "<=", "contains", "startsWith"] },
            { name: "value", label: "Value", type: "text", required: true },
        ],
    },
];

export function getMeasureDefinition(type: string): MeasureDefinition | undefined {
    return MEASURE_CATALOG.find((m) => m.type === type);
}

export function getMeasuresByCategory(category: MeasureCategory): MeasureDefinition[] {
    return MEASURE_CATALOG.filter((m) => m.category === category);
}
