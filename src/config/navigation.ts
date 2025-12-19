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
    label: "Hub",
    items: [
      {
        title: "Home",
        href: "/",
        icon: Home
      },
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard
      }
    ]
  },
  {
    label: "Modules",
    items: [
      {
        title: "Accounts Payable",
        href: "/accounts-payable",
        icon: FileSpreadsheet,
        children: [
          {
            title: "Invoices",
            href: "/accounts-payable/invoices",
            icon: Receipt
          },
          {
            title: "Providers",
            href: "/accounts-payable/providers",
            icon: Users
          }
        ]
      },
      {
        title: "P&L Report",
        href: "/pnl",
        icon: TrendingUp
      }
    ]
  },
  {
    label: "Bank Statements",
    items: [
      {
        title: "Bankinter",
        href: "/reports/bankinter",
        icon: Building2,
        children: [
          {
            title: "Bankinter EUR",
            href: "/reports/bankinter-eur",
            icon: Banknote
          },
          {
            title: "Bankinter USD",
            href: "/reports/bankinter-usd",
            icon: Banknote
          }
        ]
      },
      {
        title: "Sabadell",
        href: "/reports/sabadell",
        icon: Building2
      }
    ]
  },
  {
    label: "Payment Platforms",
    items: [
      {
        title: "Stripe",
        href: "/reports/stripe",
        icon: Wallet
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
            title: "Braintree",
            href: "/reports/braintree",
            icon: CreditCard
          },
          {
            title: "Braintree EUR",
            href: "/reports/braintree-eur",
            icon: CreditCard
          },
          {
            title: "Braintree USD",
            href: "/reports/braintree-usd",
            icon: CreditCard
          },
          {
            title: "Braintree Amex",
            href: "/reports/braintree-amex",
            icon: CreditCard
          }
        ]
      }
    ]
  }
]
