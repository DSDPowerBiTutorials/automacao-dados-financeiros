"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Building2,
  Banknote,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [bankinterOpen, setBankinterOpen] = useState(true);
  const [braintreeOpen, setBraintreeOpen] = useState(true);
  const [apOpen, setApOpen] = useState(true);

  const isActive = (path: string) => pathname === path;

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
      active
        ? "bg-blue-50 text-blue-700 font-medium"
        : "text-gray-700 hover:bg-gray-100",
      collapsed && "justify-center"
    );

  const labelClass =
    "text-[11px] font-semibold text-gray-500 uppercase px-3 mb-2";

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X /> : <Menu />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50",
          "transition-all duration-300",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="relative p-4 border-b border-gray-200 flex items-center gap-3">
          <img src="/favicon-32x32.png" alt="DSD" className="h-8 w-8" />
          {!collapsed && (
            <div>
              <div className="font-bold">DSD Finance Hub</div>
              <div className="text-xs text-gray-500">Financial Operations</div>
            </div>
          )}

          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white border rounded-full h-7 w-7 flex items-center justify-center shadow"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 text-sm overflow-y-auto">
          {/* Hub */}
          {!collapsed && <div className={labelClass}>Hub</div>}
          <Link href="/" className={itemClass(isActive("/"))}>
            <Home className="h-4 w-4" />
            {!collapsed && "Home"}
          </Link>

          <Link href="/dashboard" className={itemClass(isActive("/dashboard"))}>
            <LayoutDashboard className="h-4 w-4" />
            {!collapsed && "Dashboard"}
          </Link>

          {/* Modules */}
          {!collapsed && <div className={labelClass}>Modules</div>}
          <button
            onClick={() => setApOpen(!apOpen)}
            className="flex items-center gap-3 px-3 py-2 w-full hover:bg-gray-100 rounded-lg"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Accounts Payable</span>
                <ChevronDown
                  className={cn("h-4 w-4 transition", apOpen && "rotate-180")}
                />
              </>
            )}
          </button>

          {!collapsed && apOpen && (
            <div className="ml-6 space-y-1">
              <Link
                href="/accounts-payable/providers"
                className={itemClass(isActive("/accounts-payable/providers"))}
              >
                <Users className="h-4 w-4" />
                Providers
              </Link>
            </div>
          )}

          {/* Bank Statements */}
          {!collapsed && <div className={labelClass}>Bank Statements</div>}
          <button
            onClick={() => setBankinterOpen(!bankinterOpen)}
            className="flex items-center gap-3 px-3 py-2 w-full hover:bg-gray-100 rounded-lg"
          >
            <Building2 className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Bankinter</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition",
                    bankinterOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>

          {!collapsed && bankinterOpen && (
            <div className="ml-6 space-y-1">
              <Link
                href="/reports/bankinter-eur"
                className={itemClass(isActive("/reports/bankinter-eur"))}
              >
                <Banknote className="h-4 w-4" />
                Bankinter (EUR)
              </Link>
              <Link
                href="/reports/bankinter-usd"
                className={itemClass(isActive("/reports/bankinter-usd"))}
              >
                <Banknote className="h-4 w-4" />
                Bankinter (USD)
              </Link>
            </div>
          )}

          <Link
            href="/reports/sabadell"
            className={itemClass(isActive("/reports/sabadell"))}
          >
            <Building2 className="h-4 w-4" />
            {!collapsed && "Sabadell"}
          </Link>

          {/* Payment Platforms */}
          {!collapsed && <div className={labelClass}>Payment Platforms</div>}
          <Link href="/reports/stripe" className={itemClass(isActive("/reports/stripe"))}>
            <Wallet className="h-4 w-4" />
            {!collapsed && "Stripe"}
          </Link>
          <Link href="/reports/paypal" className={itemClass(isActive("/reports/paypal"))}>
            <Wallet className="h-4 w-4" />
            {!collapsed && "PayPal"}
          </Link>
          <Link
            href="/reports/gocardless"
            className={itemClass(isActive("/reports/gocardless"))}
          >
            <Wallet className="h-4 w-4" />
            {!collapsed && "GoCardless"}
          </Link>

          <button
            onClick={() => setBraintreeOpen(!braintreeOpen)}
            className="flex items-center gap-3 px-3 py-2 w-full hover:bg-gray-100 rounded-lg"
          >
            <CreditCard className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Braintree</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition",
                    braintreeOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>

          {!collapsed && braintreeOpen && (
            <div className="ml-6 space-y-1">
              <Link href="/reports/braintree" className={itemClass(false)}>
                Braintree
              </Link>
              <Link href="/reports/braintree-eur" className={itemClass(false)}>
                Braintree (EUR)
              </Link>
              <Link href="/reports/braintree-usd" className={itemClass(false)}>
                Braintree (USD)
              </Link>
              <Link href="/reports/braintree-amex" className={itemClass(false)}>
                Braintree (Amex)
              </Link>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-500">
          ₢ 2025 Digital Smile Design
        </div>
      </aside>
    </>
  );
}
