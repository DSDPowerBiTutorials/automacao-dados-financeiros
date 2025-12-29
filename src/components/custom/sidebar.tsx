"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "@/config/navigation";
import { SCOPE_CONFIG, type ScopeType } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  Home,
  Menu,
  X,
  ChevronDown,
  Search,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Sidebar() {
  const pathname = usePathname();
  const { selectedScope, setSelectedScope } = useGlobalScope();
  const [collapsed, setCollapsed] = useState(true); // Start collapsed
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set()); // For inline expansion
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Handle sidebar hover
  const handleSidebarMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setSidebarHovered(true);
    setCollapsed(false);
  };

  const handleSidebarMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHovering) {
        setSidebarHovered(false);
        setCollapsed(true);
        setHoveredItem(null);
      }
    }, 200);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Update CSS variable for sidebar width
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? '4rem' : '18rem'
    );
  }, [collapsed]);

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer",
      collapsed ? "justify-center px-2" : "",
      active
        ? "bg-slate-800 text-white font-medium"
        : "text-gray-900 hover:bg-gray-100"
    );

  const labelClass = cn(
    "text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-2 flex items-center justify-between"
  );

  const handleItemHover = (item: any, event: React.MouseEvent<HTMLDivElement>) => {
    if (item.children && item.children.length > 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      setHoveredItem(item.href);
      setFlyoutPosition({
        top: rect.top,
        left: collapsed ? rect.right + 8 : rect.right + 8,
      });
    }
  };

  const handleItemLeave = () => {
    setTimeout(() => {
      if (!isHovering && !sidebarHovered) {
        setHoveredItem(null);
      }
    }, 100);
  };

  const toggleItemExpansion = (href: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(href)) {
        newSet.delete(href);
      } else {
        newSet.add(href);
      }
      return newSet;
    });
  };

  const renderFlyout = (items: any[]) => {
    return (
      <div
        className="fixed bg-white border border-gray-200 shadow-xl p-2 z-60 min-w-[240px]"
        style={{
          top: `${flyoutPosition.top}px`,
          left: `${flyoutPosition.left}px`,
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setHoveredItem(null);
        }}
      >
        <div className="space-y-0.5">
          {items.map((child) => (
            <div key={child.href}>
              <Link href={child.href} className={itemClass(isActive(child.href))}>
                {child.icon && <child.icon className="h-4 w-4" />}
                <span style={{ color: isActive(child.href) ? '#fff' : '#1e40af' }} className="text-sm">{child.title}</span>
              </Link>
              {child.children && child.children.length > 0 && (
                <div className="ml-6 mt-0.5 space-y-0.5">
                  {child.children.map((subChild: any) => (
                    <Link
                      key={subChild.href}
                      href={subChild.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm transition-all",
                        isActive(subChild.href)
                          ? "bg-slate-800 text-white font-medium"
                          : "text-gray-900 hover:bg-gray-100"
                      )}
                    >
                      {subChild.icon && <subChild.icon className="h-3 w-3" />}
                      <span style={{ color: isActive(subChild.href) ? '#fff' : '#1e40af' }}>{subChild.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-[60] bg-gray-800 text-white hover:bg-gray-700"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className={cn(
          "fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 flex flex-col shadow-sm overflow-hidden",
          "transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-72",
          // Mobile: hidden by default, visible when mobileOpen is true
          // Desktop (md and up): always visible
          "max-md:-translate-x-full",
          mobileOpen && "max-md:translate-x-0",
          "md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/favicon-32x32.png"
                  alt="DSD Logo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              {!collapsed && (
                <div>
                  <h1 style={{ color: '#1e3a8a' }} className="text-gray-800 font-bold text-base">DSD Finance</h1>
                  <p style={{ color: '#3b82f6' }} className="text-gray-500 text-xs">Proprietary Software</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Country Selector */}
        {!collapsed && (
          <div className="p-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Country Scope</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedScope("ES")}
                className={cn(
                  "flex items-center justify-center w-10 h-8 border transition-colors rounded",
                  selectedScope === "ES"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                    : "border-gray-300 hover:bg-gray-50"
                )}
                title="Spain"
              >
                <span className="text-lg">🇪🇸</span>
              </button>
              <button
                onClick={() => setSelectedScope("US")}
                className={cn(
                  "flex items-center justify-center w-10 h-8 border transition-colors rounded",
                  selectedScope === "US"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                    : "border-gray-300 hover:bg-gray-50"
                )}
                title="United States"
              >
                <span className="text-lg">🇺🇸</span>
              </button>
              <button
                onClick={() => setSelectedScope("GLOBAL")}
                className={cn(
                  "flex items-center justify-center w-10 h-8 border transition-colors rounded",
                  selectedScope === "GLOBAL"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                    : "border-gray-300 hover:bg-gray-50"
                )}
                title="Global (Consolidated)"
              >
                <span className="text-sm">🌐</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {SCOPE_CONFIG[selectedScope].label}
            </p>
          </div>
        )}

        {/* Search */}
        {!collapsed && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search..."
                className="pl-10 bg-gray-50 border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {/* Quick Access */}
          {!collapsed && (
            <div className={labelClass}>
              <span style={{ color: '#3b82f6' }}>Quick Access</span>
            </div>
          )}
          <Link href="/" className={itemClass(isActive("/"))} title={collapsed ? "Hub" : ""}>
            <Home className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span style={{ color: isActive("/") ? '#fff' : '#1e40af' }}>Hub</span>}
          </Link>

          {/* Main Navigation Groups */}
          {NAV.map((group) => (
            <div key={group.label} className="mt-4">
              {!collapsed && (
                <div className={labelClass}>
                  <span style={{ color: '#3b82f6' }}>{group.label}</span>
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div key={item.href}>
                    <div
                      onMouseEnter={(e) => collapsed ? handleItemHover(item, e) : undefined}
                      onMouseLeave={collapsed ? handleItemLeave : undefined}
                      onClick={() => !collapsed && item.children && item.children.length > 0 ? toggleItemExpansion(item.href) : undefined}
                    >
                      {item.children && item.children.length > 0 ? (
                        <div className={itemClass(isActive(item.href))} title={collapsed ? item.title : ""}>
                          {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                          {!collapsed && (
                            <>
                              <span style={{ color: isActive(item.href) ? '#fff' : '#1e40af' }} className="flex-1">{item.title}</span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  expandedItems.has(item.href) ? "rotate-180" : ""
                                )}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <Link href={item.href} className={itemClass(isActive(item.href))} title={collapsed ? item.title : ""}>
                          {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                          {!collapsed && <span style={{ color: isActive(item.href) ? '#fff' : '#1e40af' }}>{item.title}</span>}
                        </Link>
                      )}
                    </div>

                    {/* Inline expanded children when sidebar is expanded */}
                    {!collapsed && item.children && item.children.length > 0 && expandedItems.has(item.href) && (
                      <div className="ml-8 mt-1 space-y-0.5">
                        {item.children.map((child: any) => (
                          <div key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm transition-all rounded-md",
                                isActive(child.href)
                                  ? "bg-slate-800 text-white font-medium"
                                  : "text-gray-700 hover:bg-gray-100"
                              )}
                            >
                              {child.icon && <child.icon className="h-3.5 w-3.5" />}
                              <span style={{ color: isActive(child.href) ? '#fff' : '#1e40af' }}>{child.title}</span>
                            </Link>

                            {/* Third level children */}
                            {child.children && child.children.length > 0 && (
                              <div className="ml-6 mt-0.5 space-y-0.5">
                                {child.children.map((subChild: any) => (
                                  <Link
                                    key={subChild.href}
                                    href={subChild.href}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-1.5 text-xs transition-all rounded-md",
                                      isActive(subChild.href)
                                        ? "bg-slate-800 text-white font-medium"
                                        : "text-gray-600 hover:bg-gray-100"
                                    )}
                                  >
                                    {subChild.icon && <subChild.icon className="h-3 w-3" />}
                                    <span style={{ color: isActive(subChild.href) ? '#fff' : '#1e40af' }}>{subChild.title}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Flyout Menu - only in collapsed mode */}
        {collapsed && hoveredItem && NAV.flatMap((g) => g.items).find((i) => i.href === hoveredItem)?.children && (
          renderFlyout(NAV.flatMap((g) => g.items).find((i) => i.href === hoveredItem)!.children!)
        )}
        {hoveredItem && NAV.flatMap((g) => g.items).find((i) => i.href === hoveredItem)?.children && (
          renderFlyout(NAV.flatMap((g) => g.items).find((i) => i.href === hoveredItem)!.children!)
        )}

        {/* Footer - User Profile */}
        <div className="p-4 border-t border-gray-200">
          {!collapsed ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <UserMenu />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">DSD Finance Hub</p>
                <p className="text-[10px] text-gray-400 mt-1">Developed by DSD Corporate Team</p>
                <p className="text-xs text-gray-400 mt-1">© 2025</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <UserMenu />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
