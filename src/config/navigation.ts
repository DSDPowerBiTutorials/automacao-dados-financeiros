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
  type LucideIcon
} from "lucide-react"

// Helper para sobrescrever href e adicionar ícone de construção
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
      icon: isUC ? ((props: any) => <span style={{display:'inline-flex',alignItems:'center',gap:4}}><nav.icon {...props} /><AlertCircle className="text-yellow-400 ml-1" style={{height:16,width:16}} /></span>) : nav.icon
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
        title: "Executive",
        href: "/executive",
        icon: LayoutDashboard,
        children: [
          {
            title: "Overview Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard
          },
          {
            title: "Performance Analytics",
            href: "/executive/performance",
            icon: Activity,
            underConstruction: true
          },
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
            title: "💰 Cash Flow Real",
            href: "/executive/cash-flow/real",
            icon: DollarSign
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
            title: "Aging Report",
            href: "/accounts-payable/insights/aging",
            icon: Clock,
            underConstruction: true
          },
          {
            title: "Cash Flow Forecast",
            href: "/accounts-payable/insights/cash-flow",
            icon: TrendingDown,
            underConstruction: true
          },
          {
            title: "Payment Schedule",
            href: "/accounts-payable/insights/schedule",
            icon: Calendar,
            underConstruction: true
          },
          {
            title: "Reports",
            href: "/accounts-payable/insights/reports",
            icon: FileText,
            underConstruction: true
          }
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
          {
            title: "Payments",
            href: "/accounts-receivable/transactions/payments",
            icon: DollarSign,
            underConstruction: true
          },
          {
            title: "Receipts",
            href: "/accounts-receivable/transactions/receipts",
            icon: CheckCircle2,
            underConstruction: true
          },
          {
            title: "Payment Channels",
            href: "/accounts-receivable/transactions/channels",
            icon: Wallet,
            underConstruction: true
          }
        ]
      },
      {
        title: "Insights",
        href: "/accounts-receivable/insights",
        icon: BarChart3,
        children: [
          {
            title: "Aging Report",
            href: "/accounts-receivable/insights/aging",
            icon: Clock,
            underConstruction: true
          },
          {
            title: "Collection Performance",
            href: "/accounts-receivable/insights/collection",
            icon: TrendingUp,
            underConstruction: true
          },
          {
            title: "Reports",
            href: "/accounts-receivable/insights/reports",
            icon: FileText,
            underConstruction: true
          }
        ]
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
        title: "Bank Accounts",
        href: "/cash-management/bank-accounts",
        icon: Building2
      },
      {
        title: "Bank Statements",
        href: "/cash-management/bank-statements",
        icon: Building2,
        children: [
          {
            title: "Chase (QuickBooks)",
            href: "/cash-management/chase-quickbooks",
            icon: Building,
            children: [
              {
                title: "Chase Business Checking",
                href: "/cash-management/chase-quickbooks/business-checking",
                icon: Banknote
              },
              {
                title: "Chase Savings",
                href: "/cash-management/chase-quickbooks/savings",
                icon: Banknote
              }
            ]
          },
          {
            title: "Bankinter",
            href: "/reports/bankinter",
            icon: Building,
            children: [
              {
                title: "Bankinter (EUR)",
                href: "/reports/bankinter-eur",
                icon: Banknote
              },
              {
                title: "Bankinter (USD)",
                href: "/reports/bankinter-usd",
                icon: Banknote
              }
            ]
          },
          {
            title: "Chase (CSV)",
            href: "/reports/chase",
            icon: Building,
            children: [
              {
                title: "Chase (USD)",
                href: "/reports/chase-usd",
                icon: Banknote
              }
            ]
          },
          {
            title: "Sabadell",
            href: "/reports/sabadell",
            icon: Building
          }
        ]
      },
      {
        title: "Payment Channels",
        href: "/cash-management/payment-channels",
        icon: Wallet,
        children: [
          {
            title: "Stripe",
            href: "/reports/stripe",
            icon: CreditCard,
            children: [
              {
                title: "Stripe (EUR)",
                href: "/reports/stripe-eur",
                icon: CreditCard
              },
              {
                title: "Stripe (USD)",
                href: "/reports/stripe-usd",
                icon: CreditCard
              }
            ]
          },
          {
            title: "PayPal",
            href: "/reports/paypal",
            icon: Wallet
          },
          {
            title: "GoCardless",
            href: "/reports/gocardless",
            icon: Wallet
          },
          {
            title: "Braintree",
            href: "/reports/braintree",
            icon: CreditCard,
            children: [
              {
                title: "Braintree (EUR)",
                href: "/reports/braintree-eur",
                icon: CreditCard
              },
              {
                title: "Braintree (USD)",
                href: "/reports/braintree-usd",
                icon: CreditCard
              },
              {
                title: "Braintree (GBP)",
                href: "/reports/braintree-gbp",
                icon: CreditCard
              },
              {
                title: "Braintree (AUD)",
                href: "/reports/braintree-aud",
                icon: CreditCard
              },
              {
                title: "Braintree (Amex)",
                href: "/reports/braintree-amex",
                icon: CreditCard
              },
              {
                title: "Braintree (Transactions)",
                href: "/reports/braintree-transactions",
                icon: Split
              }
            ]
          }
        ]
      },
      {
        title: "Expenses (Pleo)",
        href: "/reports/pleo",
        icon: Receipt
      },
      {
        title: "Reconciliation Center",
        href: "/actions/reconciliation-center",
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
    label: "DSD US QuickBooks",
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
      }
    ]
  },
  {
    label: "DSD ESP Web Sales",
    items: [
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
