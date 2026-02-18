"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV } from "@/config/navigation";
import type { NavItem, NavGroup } from "@/config/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
  HelpCircle,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const isActive = (path: string) => pathname === path;

  const itemClass = (active: boolean, isChild = false) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all relative group",
      active
        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium shadow-lg shadow-blue-500/50"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-700/50 hover:text-gray-900 dark:text-white",
      isChild && "ml-3"
    );

  const labelClass =
    "text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 mb-2 mt-4";

  const handleItemHover = (itemKey: string, event: React.MouseEvent, item: NavItem) => {
    if (!collapsed || !item.children) return;
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutPosition({ 
      top: rect.top, 
      left: rect.right + 8 
    });
    setHoveredItem(itemKey);
  };

  const renderFlyout = (): JSX.Element | null => {
    if (!hoveredItem || !collapsed) return null;

    const findItem = (items: NavItem[], key: string): NavItem | null => {
      for (const item of items) {
        if (item.href === key) return item;
        if (item.children) {
          const found = findItem(item.children, key);
          if (found) return found;
        }
      }
      return null;
    };

    let item: NavItem | null = null;
    for (const group of NAV) {
      item = findItem(group.items, hoveredItem);
      if (item) break;
    }

    if (!item || !item.children) return null;

    return (
      <div
        className="fixed bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2 min-w-[220px] z-60"
        style={{ top: `${flyoutPosition.top}px`, left: `${flyoutPosition.left}px` }}
        onMouseEnter={() => setHoveredItem(hoveredItem)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <div className="space-y-0.5">
          {item.children.map((child) => renderFlyoutItem(child))}
        </div>
      </div>
    );
  };

  const renderFlyoutItem = (item: NavItem): JSX.Element => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.href} className="group/submenu relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-700/50 hover:text-gray-900 dark:text-white transition-all cursor-pointer">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{item.title}</span>
            <ChevronRight className="h-4 w-4" />
          </div>
          <div className="hidden group-hover/submenu:block absolute left-full top-0 ml-2">
            <div className="bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2 min-w-[200px]">
              <div className="space-y-0.5">
                {item.children!.map((child) => renderFlyoutItem(child))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
          isActive(item.href)
            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-700/50 hover:text-gray-900 dark:text-white"
        )}
        onClick={() => {
          setMobileOpen(false);
        }}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.title}</span>
      </Link>
    );
  };

  const renderNavItem = (item: NavItem): JSX.Element => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.href}>
          <div
            className={itemClass(false)}
            onMouseEnter={(e) => handleItemHover(item.href, e, item)}
            onMouseLeave={() => !collapsed && setHoveredItem(null)}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isHovering) && (
              <>
                <span className="flex-1">{item.title}</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={itemClass(isActive(item.href))}
        onClick={() => setMobileOpen(false)}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {(!collapsed || isHovering) && <span className="flex-1">{item.title}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Flyout menu */}
      {renderFlyout()}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 h-full bg-gray-50 dark:bg-[#1e293b] border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col",
          "transition-all duration-300 rounded-r-3xl",
          collapsed && !isHovering ? "w-20" : "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ "--sidebar-width": (collapsed && !isHovering) ? "5rem" : "18rem" } as any}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setHoveredItem(null);
        }}
      >
        {/* Header */}
        <div className="relative p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-gray-900 dark:text-white" />
          </div>
          {(!collapsed || isHovering) && (
            <div className="flex-1">
              <div className="font-bold text-gray-900 dark:text-white text-sm">Kate Russell</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Project Manager</div>
            </div>
          )}
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Search */}
        {(!collapsed || isHovering) && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-200 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500 transition-all"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                ⌘F
              </kbd>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV.map((group: NavGroup) => (
            <div key={group.label}>
              {(!collapsed || isHovering) && <div className={labelClass}>{group.label}</div>}
              <div className="space-y-1">
                {group.items.map((item) => renderNavItem(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          {(!collapsed || isHovering) && (
            <>
              <button className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white transition-all rounded-xl mx-2 my-2">
                <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  HC
                </span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">Help Center</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Answers here</div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>

              <button 
                className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white transition-all text-sm rounded-xl mx-2 mb-2"
                onClick={() => setCollapsed(true)}
              >
                <span className="text-gray-500 dark:text-gray-400">▾</span>
                <span>Collapse menu</span>
              </button>
            </>
          )}
          {(collapsed && !isHovering) && (
            <button
              className="flex items-center justify-center py-4 w-full hover:bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white transition-all"
              onClick={() => setCollapsed(false)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </>
  );
}
