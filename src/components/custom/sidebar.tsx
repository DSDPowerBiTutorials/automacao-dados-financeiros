"use client"

import { useState } from "react"
import { Home, FileSpreadsheet, Upload, Download, Settings, Menu, X, BarChart3, FolderOpen, CreditCard, Building2, Wallet, ChevronDown, ChevronRight, TrendingUp, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"

interface SidebarProps {
  currentPage?: string
  paymentSourceDates?: { [key: string]: string }
}

export function Sidebar({ currentPage = "home", paymentSourceDates = {} }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [bankinterExpanded, setBankinterExpanded] = useState(true)
  const [braintreeExpanded, setBraintreeExpanded] = useState(true)

  // Função para verificar se a data é o dia atual
  const isToday = (dateString: string): boolean => {
    if (!dateString) return false
    const [day, month, year] = dateString.split('/')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Função para verificar se a data é anterior ao dia atual
  const isPast = (dateString: string): boolean => {
    if (!dateString) return false
    const [day, month, year] = dateString.split('/')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date < today
  }

  // Função para obter a cor da data
  const getDateColor = (dateString: string): string => {
    if (!dateString) return "text-gray-400"
    if (isToday(dateString)) return "text-green-600 dark:text-green-400"
    if (isPast(dateString)) return "text-red-600 dark:text-red-400"
    return "text-gray-600 dark:text-gray-400"
  }

  const bankinterItems = [
    { 
      label: "Bankinter EUR", 
      href: "/reports/bankinter-eur", 
      id: "bankinter-eur",
      source: "bankinter-eur"
    },
    { 
      label: "Bankinter USD", 
      href: "/reports/bankinter-usd", 
      id: "bankinter-usd",
      source: "bankinter-usd"
    },
  ]

  const sabadellItem = { 
    icon: Building2, 
    label: "Sabadell", 
    href: "/reports/sabadell", 
    id: "sabadell",
    description: "Bank account",
    source: "sabadell"
  }

  const braintreeItems = [
    { 
      label: "Braintree EUR", 
      href: "/reports/braintree-eur", 
      id: "braintree-eur",
      source: "braintree-eur"
    },
    { 
      label: "Braintree USD", 
      href: "/reports/braintree-usd", 
      id: "braintree-usd",
      source: "braintree-usd"
    },
    { 
      label: "Braintree Transactions", 
      href: "/#braintree-transactions", 
      id: "braintree-transactions",
      source: "braintree-transactions"
    },
    { 
      label: "Braintree Amex", 
      href: "/reports/braintree-amex", 
      id: "braintree-amex",
      source: "braintree-amex"
    },
    { 
      label: "Braintree Amex Transactions", 
      href: "/#braintree-amex-transactions", 
      id: "braintree-amex-transactions",
      source: "braintree-amex-transactions"
    },
  ]

  const paymentSources = [
    { 
      icon: Wallet, 
      label: "Stripe", 
      href: "/#stripe", 
      id: "stripe",
      description: "Payment processing",
      source: "stripe"
    },
    { 
      icon: CreditCard, 
      label: "GoCardless", 
      href: "/#gocardless", 
      id: "gocardless",
      description: "Direct debits",
      source: "gocardless"
    },
    { 
      icon: Wallet, 
      label: "PayPal", 
      href: "/#paypal", 
      id: "paypal",
      description: "PayPal transactions",
      source: "paypal"
    },
  ]

  const actionItems = [
    { icon: Upload, label: "Upload Files", href: "/#upload", id: "upload" },
    {
      icon: FileSpreadsheet,
      label: "Reconciliation Center",
      href: "/actions/reconciliation-center",
      id: "reconciliation-center",
    },
    {
      icon: BarChart3,
      label: "Integration Insights",
      href: "/actions/integration-insights",
      id: "integration-insights",
    },
    { icon: BarChart3, label: "Reconciliation", href: "/#reconciliation", id: "reconciliation" },
    { icon: Download, label: "Export Data", href: "/#export", id: "export" },
    { icon: Settings, label: "Settings", href: "/#settings", id: "settings" },
  ]

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
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-gray-800 z-40
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 relative">
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                  <Image
                    src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/baf537c4-2708-4a07-8e30-4cf8ad2de2e8.png"
                    alt="DSD Logo"
                    className="h-10 w-auto object-contain"
                    width={40}
                    height={40}
                  />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">
                    Digital Smile Design
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Finance Hub
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="h-10 w-10 flex items-center justify-center">
                  <Image
                    src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/baf537c4-2708-4a07-8e30-4cf8ad2de2e8.png"
                    alt="DSD Logo"
                    className="h-10 w-auto object-contain"
                    width={40}
                    height={40}
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
              <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {/* Main Section */}
            <div className="mb-4">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Main
                </p>
              )}
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${currentPage === 'home'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
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
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${currentPage === 'pnl'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? "DSD Departamental P&L" : ""}
              >
                <TrendingUp className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="text-sm">DSD Departamental P&L</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Profit & Loss Report
                    </div>
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
                
                {/* Bankinter Parent */}
                <div className="mb-2">
                  <button
                    onClick={() => setBankinterExpanded(!bankinterExpanded)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    <Building2 className="h-5 w-5" />
                    <span className="flex-1 text-left text-sm font-medium">Bankinter</span>
                    {bankinterExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {/* Bankinter Children */}
                  {bankinterExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {bankinterItems.map((item) => {
                        const isActive = currentPage === item.id
                        const dateString = item.source ? paymentSourceDates[item.source] : undefined
                        
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`
                              flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-xs
                              ${isActive
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                              }
                            `}
                          >
                            <span>{item.label}</span>
                            {dateString && (
                              <span className={`text-xs font-bold ${getDateColor(dateString)}`}>
                                {dateString}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Sabadell */}
                <Link
                  href={sabadellItem.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${currentPage === sabadellItem.id
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  <Building2 className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{sabadellItem.label}</span>
                      {sabadellItem.source && paymentSourceDates[sabadellItem.source] && (
                        <span className={`text-xs font-bold ${getDateColor(paymentSourceDates[sabadellItem.source])}`}>
                          {paymentSourceDates[sabadellItem.source]}
                        </span>
                      )}
                    </div>
                    {sabadellItem.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {sabadellItem.description}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            )}

            {/* Payment Sources Section */}
            {!isCollapsed && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Payment Sources
                </p>
                
                {/* Braintree Parent */}
                <div className="mb-2">
                  <button
                    onClick={() => setBraintreeExpanded(!braintreeExpanded)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="flex-1 text-left text-sm font-medium">Braintree</span>
                    {braintreeExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {/* Braintree Children */}
                  {braintreeExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {braintreeItems.map((item) => {
                        const isActive = currentPage === item.id
                        const dateString = item.source ? paymentSourceDates[item.source] : undefined

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`
                              flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-xs
                              ${isActive
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                              }
                            `}
                          >
                            <span>{item.label}</span>
                            {dateString && (
                              <span className={`text-xs font-bold ${getDateColor(dateString)}`}>
                                {dateString}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Other Payment Sources */}
                {paymentSources.map((item) => {
                  const Icon = item.icon
                  const isActive = currentPage === item.id
                  const dateString = item.source ? paymentSourceDates[item.source] : undefined

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }
                      `}
                    >
                      <Icon className="h-5 w-5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{item.label}</span>
                          {dateString && (
                            <span className={`text-xs font-bold ${getDateColor(dateString)}`}>
                              {dateString}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Actions Section */}
            <div>
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Actions
                </p>
              )}
              {actionItems.map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.id

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? item.label : ""}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Footer */}
          {!isCollapsed && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Need Help?
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Check our documentation
                </p>
                <Button size="sm" variant="outline" className="w-full text-xs">
                  View Docs
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
