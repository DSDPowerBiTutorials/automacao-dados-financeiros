"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactElement, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BarChart2,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  GitBranch,
  Home,
  LayoutDashboard,
  Link2,
  Menu,
  Settings,
  TrendingUp,
  Upload,
  X,
} from "lucide-react"

interface SidebarProps {
  currentPage?: string
  paymentSourceDates?: { [key: string]: string }
}

interface NavItem {
  name: string
  path: string
  icon: ReactElement
}

export function Sidebar({ currentPage }: SidebarProps) {
  const pathname = usePathname()
  const activePath = currentPage ?? pathname

  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [bankinterExpanded, setBankinterExpanded] = useState(true)

  const bankStatementItems: NavItem[] = useMemo(
    () => [
      { name: "Bankinter EUR", path: "/reports/bankinter-eur", icon: <LayoutDashboard className="h-4 w-4" /> },
      { name: "Bankinter USD", path: "/reports/bankinter-usd", icon: <LayoutDashboard className="h-4 w-4" /> },
      { name: "Sabadell EUR", path: "/reports/sabadell-eur", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
    [],
  )

  const quickActions: NavItem[] = useMemo(
    () => [
      { name: "Reconciliation Center", path: "/actions/reconciliation-center", icon: <FileSpreadsheet className="h-4 w-4" /> },
      { name: "Integration Insights", path: "/actions/integration-insights", icon: <Link2 className="h-4 w-4" /> },
      { name: "Analytics", path: "/reports/analytics", icon: <BarChart2 className="h-4 w-4" /> },
      { name: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" /> },
    ],
    [],
  )

  const isActive = (path: string) => activePath === path

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-gray-800 z-40",
          "transform transition-all duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 relative">
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                  <img
                    src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/baf537c4-2708-4a07-8e30-4cf8ad2de2e8.png"
                    alt="DSD Logo"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Digital Smile Design</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Finance Hub</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="h-10 w-10 flex items-center justify-center">
                  <img
                    src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/baf537c4-2708-4a07-8e30-4cf8ad2de2e8.png"
                    alt="DSD Logo"
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>
            )}

            {/* Toggle Button - Desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 shadow-md hidden md:flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", isCollapsed && "rotate-180")} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {/* Main Section */}
            <div className="mb-4">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">Main</p>
              )}
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive("/")
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                  isCollapsed && "justify-center",
                )}
                title={isCollapsed ? "Dashboard" : ""}
              >
                <Home className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </div>

            {/* Reports Section */}
            <div className="mb-4">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Reports
                </p>
              )}
              <Link
                href="/pnl"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive("/pnl")
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                  isCollapsed && "justify-center",
                )}
                title={isCollapsed ? "DSD Departamental P&L" : ""}
              >
                <TrendingUp className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="text-sm">DSD Departamental P&L</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Profit &amp; Loss Report</div>
                  </div>
                )}
              </Link>
            </div>

            {/* Bank Statements Section */}
            {!isCollapsed && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Bank Statements
                </p>

                <div className="mb-2">
                  <button
                    onClick={() => setBankinterExpanded(!bankinterExpanded)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    <Building2 className="h-5 w-5" />
                    <span className="flex-1 text-left text-sm font-medium">Bankinter</span>
                    {bankinterExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {bankinterExpanded && (
                    <ul className="mt-1 ml-3 space-y-1">
                      {bankStatementItems.map((item) => (
                        <li key={item.path}>
                          <Link
                            href={item.path}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive(item.path)
                                ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                            )}
                          >
                            {item.icon ?? <GitBranch className="h-4 w-4" />}
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mb-4">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Actions
                </p>
              )}
              <ul className="space-y-1">
                {quickActions.map((item) => (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        isActive(item.path)
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                        isCollapsed && "justify-center",
                      )}
                      title={isCollapsed ? item.name : ""}
                    >
                      {item.icon ?? <GitBranch className="h-4 w-4" />}
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Utility Actions */}
            <div className="mb-4">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Tools
                </p>
              )}
              <Link
                href="/#upload"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isCollapsed && "justify-center",
                  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                )}
                title={isCollapsed ? "Upload Files" : ""}
              >
                <Upload className="h-5 w-5" />
                {!isCollapsed && <span>Upload Files</span>}
              </Link>
              <Link
                href="/#export"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "mt-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isCollapsed && "justify-center",
                  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800",
                )}
                title={isCollapsed ? "Export Data" : ""}
              >
                <BarChart3 className="h-5 w-5" />
                {!isCollapsed && <span>Export Data</span>}
              </Link>
            </div>
          </nav>

          <div className="p-4 border-t border-white/10 text-xs text-white/60">
            <p>DSD Data Engineering © {new Date().getFullYear()}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
