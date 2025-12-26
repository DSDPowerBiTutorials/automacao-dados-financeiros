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
  Settings,
  Shield,
  FileCheck,
  Boxes,
  Layers,
  Split,
  type LucideIcon
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  children?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
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
            icon: Activity
          },
          {
            title: "P&L",
            href: "/pnl",
            icon: TrendingUp
          },
          {
            title: "Cash Flow Summary",
            href: "/executive/cash-flow",
            icon: TrendingDown
          },
          {
            title: "KPIs & Ratios",
            href: "/executive/kpis",
            icon: Target
          },
          {
            title: "Forecasts",
            href: "/executive/forecasts",
            icon: LineChart
          },
          {
            title: "Consolidated Reports",
            href: "/executive/reports",
            icon: FileText
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
        title: "Transactions",
        href: "/accounts-payable/transactions",
        icon: Receipt,
        children: [
          {
            title: "Bank Reconciliation",
            href: "/accounts-payable/transactions/bank-reconciliation",
            icon: CheckCircle2
          },
          {
            title: "Invoices",
            href: "/accounts-payable/invoices",
            icon: FileText
          },
          {
            title: "Payments",
            href: "/accounts-payable/invoices/payments",
            icon: DollarSign
          },
          {
            title: "Providers",
            href: "/accounts-payable/transactions/providers",
            icon: Users
          }
        ]
      },
      {
        title: "Insights",
        href: "/accounts-payable/insights",
        icon: BarChart3,
        children: [
          {
            title: "Aging Report",
            href: "/accounts-payable/insights/aging",
            icon: Clock
          },
          {
            title: "Cash Flow Forecast",
            href: "/accounts-payable/insights/cash-flow",
            icon: TrendingDown
          },
          {
            title: "Payment Schedule",
            href: "/accounts-payable/insights/schedule",
            icon: Calendar
          },
          {
            title: "Reports",
            href: "/accounts-payable/insights/reports",
            icon: FileText
          }
        ]
      },
      {
        title: "Master Data",
        href: "/accounts-payable/master-data",
        icon: Boxes,
        children: [
          {
            title: "Bank Accounts",
            href: "/accounts-payable/master-data/bank-accounts",
            icon: Building2
          },
          {
            title: "Chart of Accounts",
            href: "/accounts-payable/master-data/chart-accounts",
            icon: Layers
          },
          {
            title: "Cost Centers",
            href: "/accounts-payable/master-data/cost-centers",
            icon: Target
          },
          {
            title: "DSD Courses",
            href: "/accounts-payable/master-data/dsd-courses",
            icon: FileCheck
          },
          {
            title: "Financial Accounts",
            href: "/accounts-payable/master-data/financial-accounts",
            icon: Banknote
          },
          {
            title: "Providers",
            href: "/accounts-payable/master-data/providers",
            icon: Users
          }
        ]
      },
      {
        title: "Setup",
        href: "/accounts-payable/setup",
        icon: Settings,
        children: [
          {
            title: "Approval Rules",
            href: "/accounts-payable/setup/approval-rules",
            icon: Shield
          },
          {
            title: "Payment Terms",
            href: "/accounts-payable/setup/payment-terms",
            icon: Calendar
          },
          {
            title: "Posting Profiles",
            href: "/accounts-payable/setup/posting-profiles",
            icon: FileCheck
          },
          {
            title: "Tax Configurations",
            href: "/accounts-payable/setup/tax-config",
            icon: FileText
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
        title: "Transactions",
        href: "/accounts-receivable/transactions",
        icon: Receipt,
        children: [
          {
            title: "Credit Notes",
            href: "/accounts-receivable/transactions/credit-notes",
            icon: FileText
          },
          {
            title: "Invoices",
            href: "/accounts-receivable/transactions/invoices",
            icon: Receipt
          },
          {
            title: "Payments",
            href: "/accounts-receivable/transactions/payments",
            icon: DollarSign
          },
          {
            title: "Receipts",
            href: "/accounts-receivable/transactions/receipts",
            icon: CheckCircle2
          },
          {
            title: "Payment Channels",
            href: "/accounts-receivable/transactions/channels",
            icon: Wallet
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
            icon: Clock
          },
          {
            title: "Collection Performance",
            href: "/accounts-receivable/insights/collection",
            icon: TrendingUp
          },
          {
            title: "Reports",
            href: "/accounts-receivable/insights/reports",
            icon: FileText
          }
        ]
      },
      {
        title: "Master Data",
        href: "/accounts-receivable/master-data",
        icon: Boxes,
        children: [
          {
            title: "Chart of Accounts",
            href: "/accounts-receivable/master-data/chart-accounts",
            icon: Layers
          },
          {
            title: "Customers",
            href: "/accounts-receivable/master-data/customers",
            icon: UserCircle
          },
          {
            title: "Customer Groups",
            href: "/accounts-receivable/master-data/customer-groups",
            icon: Users
          },
          {
            title: "DSD Courses",
            href: "/accounts-receivable/master-data/dsd-courses",
            icon: FileCheck
          },
          {
            title: "Financial Accounts",
            href: "/accounts-receivable/master-data/financial-accounts",
            icon: Banknote
          },
          {
            title: "Revenue Centers",
            href: "/accounts-receivable/master-data/revenue-centers",
            icon: Target
          }
        ]
      },
      {
        title: "Setup",
        href: "/accounts-receivable/setup",
        icon: Settings,
        children: [
          {
            title: "Credit Policies",
            href: "/accounts-receivable/setup/credit-policies",
            icon: Shield
          },
          {
            title: "Payment Terms",
            href: "/accounts-receivable/setup/payment-terms",
            icon: Calendar
          },
          {
            title: "Posting Profiles",
            href: "/accounts-receivable/setup/posting-profiles",
            icon: FileCheck
          },
          {
            title: "Tax Configurations",
            href: "/accounts-receivable/setup/tax-config",
            icon: FileText
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
        icon: Building2,
        children: [
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
            icon: CreditCard
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
        title: "Reconciliation Center",
        href: "/actions/reconciliation-center",
        icon: CheckCircle2
      },
      {
        title: "Cash Flow Reports",
        href: "/cash-management/reports",
        icon: TrendingDown
      }
    ]
  }
]
