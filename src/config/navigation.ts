import {
  Home,
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  Users,
  Building2,
  Banknote,
  Wallet,
  CreditCard,
  TrendingUp,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Target,
  TrendingDown,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  UserCircle,
  Boxes,
  Split,
  Users2,
  Briefcase,
  Contact,
  Building2 as Company,
  BarChart4,
  Settings2,
  Package,
  Bot,
  Plug,
  UserCheck,
  GraduationCap,
  type LucideIcon
} from "lucide-react"

// Helper para sobrescrever href de itens under construction
function withUnderConstruction(nav: any): any {
  if (Array.isArray(nav)) {
    return nav.map(withUnderConstruction);
  }
  if (nav && typeof nav === 'object') {
    const isUC = nav.underConstruction;
    const children = nav.children ? withUnderConstruction(nav.children) : undefined;
    return {
      ...nav,
      href: isUC ? "/under-construction" : nav.href,
      children,
    };
  }
  return nav;
}

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  children?: NavItem[]
  underConstruction?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = withUnderConstruction([
  {
    label: "Executive Insights",
    items: [
      {
        title: "Overview Dashboard",
        href: "/dashboard",
        icon: Home
      },
      {
        title: "Executive",
        href: "/executive",
        icon: LayoutDashboard,
        children: [
          {
            title: "P&L",
            href: "/pnl",
            icon: TrendingUp,
            underConstruction: true
          },
          {
            title: "Cash Flow Summary",
            href: "/executive/cash-flow",
            icon: TrendingDown,
            underConstruction: true
          },
          {
            title: "🏦 Cash Flow Bancário",
            href: "/executive/cash-flow/bank",
            icon: Building
          },
          {
            title: "KPIs & Ratios",
            href: "/executive/kpis",
            icon: Target,
            underConstruction: true
          },
          {
            title: "Forecasts",
            href: "/executive/forecasts",
            icon: LineChart,
            underConstruction: true
          },
          {
            title: "Consolidated Reports",
            href: "/executive/reports",
            icon: FileText,
            underConstruction: true
          }
        ]
      }
    ]
  },
  {
    label: "Sales Insights",
    items: [
      {
        title: "Clinics Overview",
        href: "/sales-insights/clinics",
        icon: Building2
      },
      {
        title: "📅 DSD Calendar",
        href: "/calendar",
        icon: Calendar
      },
      {
        title: "🎓 DSD Courses",
        href: "/sales-insights/courses",
        icon: GraduationCap
      }
    ]
  },
  {
    label: "Departmental Insights",
    items: [
      {
        title: "Department P&L",
        href: "/departmental/pnl",
        icon: BarChart3
      }
    ]
  },
  {
    label: "Accounts Payable",
    items: [
      {
        title: "Overview",
        href: "/accounts-payable",
        icon: FileSpreadsheet
      },
      {
        title: "Invoices",
        href: "/accounts-payable/invoices",
        icon: FileText
      },
      {
        title: "Insights",
        href: "/accounts-payable/insights",
        icon: BarChart3,
        children: [
          {
            title: "Payment Schedule",
            href: "/accounts-payable/insights/schedule",
            icon: Calendar,
            underConstruction: true
          },
        ]
      },
      {
        title: "Master Data",
        href: "/accounts-payable/master-data",
        icon: Boxes,
        children: [
          {
            title: "Financial Accounts",
            href: "/accounts-payable/master-data/financial-accounts",
            icon: Banknote
          },
          {
            title: "Departmental Accounts",
            href: "/accounts-payable/master-data/departmental-accounts",
            icon: Target
          },
          {
            title: "Bank Accounts",
            href: "/accounts-payable/master-data/bank-accounts",
            icon: Banknote,
            underConstruction: true
          },
          {
            title: "Providers",
            href: "/accounts-payable/master-data/providers",
            icon: Users
          }
        ]
      }
    ]
  },
  {
    label: "Accounts Receivable",
    items: [
      {
        title: "Overview",
        href: "/accounts-receivable",
        icon: DollarSign
      },
      {
        title: "Invoice Orders",
        href: "/accounts-receivable/invoice-orders",
        icon: Receipt
      },
      {
        title: "Web Orders",
        href: "/accounts-receivable/invoices",
        icon: FileText
      },
      {
        title: "Transactions",
        href: "/accounts-receivable/transactions",
        icon: Receipt,
        children: [
          {
            title: "Credit Notes",
            href: "/accounts-receivable/transactions/credit-notes",
            icon: FileText,
            underConstruction: true
          },
        ]
      },
      {
        title: "Insights",
        href: "/accounts-receivable/insights",
        icon: BarChart3
      },
      {
        title: "Master Data",
        href: "/accounts-receivable/master-data",
        icon: Boxes,
        children: [
          {
            title: "Customers",
            href: "/accounts-receivable/master-data/customers",
            icon: UserCircle,
            underConstruction: true
          },
          {
            title: "Products",
            href: "/accounts-receivable/master-data/products",
            icon: Package
          },
          {
            title: "Financial Accounts",
            href: "/accounts-payable/master-data/financial-accounts",
            icon: Banknote
          },
          {
            title: "Departmental Accounts",
            href: "/accounts-payable/master-data/departmental-accounts",
            icon: Target
          }
        ]
      }
    ]
  },
  {
    label: "Cash Management",
    items: [
      {
        title: "Bank Statements",
        href: "/cash-management/bank-statements",
        icon: Building2
      },
      {
        title: "Bank Accounts",
        href: "/cash-management/bank-accounts",
        icon: Building2
      },
      {
        title: "💳 Payment Channels",
        href: "/cash-management/payment-channels",
        icon: Wallet
      },
      {
        title: "Expenses (Pleo)",
        href: "/reports/pleo",
        icon: Receipt
      },
      {
        title: "Braintree ↔ Orders",
        href: "/actions/braintree-reconciliation",
        icon: CheckCircle2
      },
      {
        title: "🤖 BOTella Logs",
        href: "/actions/bot-logs",
        icon: Bot
      }
    ]
  },
  {
    label: "Payroll",
    items: [
      {
        title: "👥 Payroll",
        href: "/people/payroll",
        icon: UserCheck
      },
      {
        title: "Master Data",
        href: "/people/payroll/master-data",
        icon: Boxes
      }
    ]
  },
  {
    label: "Integrations",
    items: [
      {
        title: "QuickBooks Dashboard",
        href: "/reports/quickbooks-usd",
        icon: DollarSign,
        children: [
          {
            title: "📊 All Transactions",
            href: "/reports/quickbooks-usd",
            icon: FileText
          },
          {
            title: "📄 Invoices (A/R)",
            href: "/reports/quickbooks-usd?tab=invoices",
            icon: FileText
          },
          {
            title: "💰 Payments Received",
            href: "/reports/quickbooks-usd?tab=payments",
            icon: DollarSign
          },
          {
            title: "📋 Bills (A/P)",
            href: "/reports/quickbooks-usd?tab=bills",
            icon: CreditCard
          },
          {
            title: "💸 Expenses",
            href: "/reports/quickbooks-usd?tab=expenses",
            icon: TrendingDown
          }
        ]
      },
      {
        title: "HubSpot",
        href: "/hubspot",
        icon: Users2,
        children: [
          {
            title: "Web Orders",
            href: "/reports/hubspot",
            icon: Briefcase
          },
          {
            title: "Contacts",
            href: "/hubspot/contacts",
            icon: Contact
          },
          {
            title: "Companies",
            href: "/hubspot/companies",
            icon: Company
          },
          {
            title: "Pipeline Analytics",
            href: "/hubspot/pipeline",
            icon: BarChart4
          },
          {
            title: "Sync Settings",
            href: "/hubspot/settings",
            icon: Settings2
          }
        ]
      }
    ]
  }
])
