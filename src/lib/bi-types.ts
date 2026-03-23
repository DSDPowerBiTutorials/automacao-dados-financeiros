export type MetricType = "revenue" | "expense";
export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "bar-horizontal" | "bar-stacked" | "area-stacked" | "combo-bar-line" | "radar" | "treemap" | "funnel" | "scatter" | "waterfall";
export type Granularity = "monthly" | "quarterly" | "ytd";

export interface BIMetric {
    id: string;
    label: string;
    shortLabel: string;
    faCode: string;
    type: MetricType;
    color: string;
    icon: string;
}

export interface BIChartConfig {
    selectedMetrics: string[];
    chartType: ChartType;
    granularity: Granularity;
}

export interface BIFilter {
    year: string;
    scope: string;
    chartType: ChartType;
    granularity: Granularity;
}

export interface MonthlyData {
    jan: number;
    feb: number;
    mar: number;
    apr: number;
    may: number;
    jun: number;
    jul: number;
    aug: number;
    sep: number;
    oct: number;
    nov: number;
    dec: number;
}

export interface BISummaryResponse {
    success: boolean;
    year: string;
    revenue: {
        monthly: MonthlyData;
        byAccount: Record<string, MonthlyData>;
        total: number;
    };
    expenses: {
        monthly: MonthlyData;
        byAccount: Record<string, MonthlyData>;
        total: number;
    };
    kpis: {
        totalRevenue: number;
        totalExpenses: number;
        grossProfit: number;
        netMargin: number;
    };
}

export interface ChartDataPoint {
    month: string;
    [key: string]: string | number;
}

// ─── Dashboard Builder Types ───────────────────────────────────────

export type SlotSize = 1 | 2;

export type SlotLayoutType =
    | "empty"
    | "5cards"
    | "4cards"
    | "2cards-1chart"
    | "1card-1chart"
    | "5cards-1chart"
    | "5cards-2charts"
    | "4cards-1chart"
    | "3cards-1chart"
    | "2cards-2charts";

export interface CardWidgetConfig {
    measureId: string | null;
    label: string;
    icon?: string;
    color?: string;
    format?: "currency" | "number" | "percent";
}

export interface ChartWidgetConfig {
    chartType: ChartType;
    measureIds: string[];
    title?: string;
    showLegend?: boolean;
    showGrid?: boolean;
}

export interface DashboardSlotConfig {
    cards: CardWidgetConfig[];
    charts: ChartWidgetConfig[];
}

export interface DashboardSlot {
    id: string;
    slotIndex: number;
    slotSize: SlotSize;
    layoutType: SlotLayoutType;
    config: DashboardSlotConfig;
}

export interface Dashboard {
    id: string;
    title: string;
    authorId: string;
    authorName: string;
    isPublic: boolean;
    scope: string;
    slots: DashboardSlot[];
    createdAt: string;
    updatedAt: string;
}

export interface DashboardListItem {
    id: string;
    title: string;
    authorName: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardComment {
    id: string;
    dashboardId: string;
    userId: string;
    userName: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    editedAt: string | null;
    replies?: DashboardComment[];
}

// ─── Measure Types ─────────────────────────────────────────────────

export type MeasureCategory =
    | "aggregation"
    | "math"
    | "time-intelligence"
    | "comparison"
    | "statistical"
    | "logical";

export type MeasureType =
    // Aggregation
    | "SUM" | "AVERAGE" | "COUNT" | "COUNTDISTINCT" | "MIN" | "MAX" | "MEDIAN"
    // Math
    | "DIVIDE" | "ABS" | "ROUND" | "PERCENTAGE"
    // Time Intelligence
    | "SAMEPERIODLASTYEAR" | "PREVIOUSMONTH" | "PREVIOUSQUARTER" | "PREVIOUSYEAR"
    | "DATEADD" | "TOTALYTD" | "TOTALMTD" | "TOTALQTD" | "RUNNINGTOTAL" | "MOVINGAVERAGE"
    // Comparison
    | "YEAR_OVER_YEAR" | "MONTH_OVER_MONTH" | "QUARTER_OVER_QUARTER"
    | "PERIOD_COMPARISON" | "VARIANCE" | "VARIANCE_PERCENT" | "DELTA"
    // Statistical
    | "STANDARDDEVIATION" | "PERCENTILE" | "RANK" | "TOPN" | "BOTTOMN"
    // Logical
    | "IF" | "SWITCH" | "CALCULATE" | "FILTER";

export interface MeasureDefinition {
    type: MeasureType;
    label: string;
    description: string;
    category: MeasureCategory;
    icon: string;
    params: MeasureParam[];
}

export interface MeasureParam {
    name: string;
    label: string;
    description?: string;
    type: "field" | "number" | "date" | "period" | "measure" | "text" | "select";
    required: boolean;
    options?: string[];
    defaultValue?: string;
}

export interface UserMeasure {
    id: string;
    name: string;
    authorId: string;
    authorName?: string;
    isPublic: boolean;
    measureType: MeasureType;
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

// ─── Right Sidebar Tabs ────────────────────────────────────────────

export type RightSidebarTab = "variables" | "filters" | "datasources" | "ai";
