"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart2,
  FileSpreadsheet,
  Settings,
  Link2,
  GitBranch,
} from "lucide-react"

interface SidebarProps {
  currentPage?: string
  paymentSourceDates?: { [key: string]: string }
}

export function Sidebar({ currentPage }: SidebarProps) {
  const pathname = usePathname()
  const activePath = currentPage ?? pathname

  const navItems = [
    {
      label: "Reports",
      items: [
        { name: "Bankinter EUR", path: "/reports/bankinter-eur", icon: <LayoutDashboard className="h-4 w-4" /> },
        { name: "Bankinter USD", path: "/reports/bankinter-usd", icon: <LayoutDashboard className="h-4 w-4" /> },
        { name: "Sabadell EUR", path: "/reports/sabadell-eur", icon: <LayoutDashboard className="h-4 w-4" /> },
      ],
    },
    {
      label: "Actions",
      items: [
        {
          name: "Reconciliation Center",
          path: "/actions/reconciliation-center",
          icon: <FileSpreadsheet className="h-4 w-4" />,
        },
        {
          name: "Integration Insights",
          path: "/actions/integration-insights",
          icon: <Link2 className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Analytics", path: "/reports/analytics", icon: <BarChart2 className="h-4 w-4" /> },
        { name: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-[#1a2b4a] text-white flex flex-col shadow-xl">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">DSD Finance Hub</h1>
        <p className="text-sm text-white/70 mt-1">Financial Operations Platform</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        {navItems.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150 hover:bg-white/10 hover:text-white",
                      activePath === item.path
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/70"
                    )}
                  >
                    {item.icon ?? <GitBranch className="h-4 w-4" />}
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-white/60">
        <p>DSD Data Engineering © {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}
