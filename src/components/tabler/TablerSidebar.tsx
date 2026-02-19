"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV, type NavGroup, type NavItem } from "@/config/navigation";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function flattenFirstHref(item: NavItem): string {
  if (!item.children?.length) return item.href;
  return item.href;
}

export function TablerSidebar({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo<NavGroup[]>(() => NAV, []);

  return (
    <aside className="navbar navbar-vertical navbar-expand-lg" data-bs-theme="light">
      <div className="container-fluid">
        <div
          className={"collapse navbar-collapse" + (mobileOpen ? " show" : "")}
          id="tabler-navbar-menu"
        >
          <ul className="navbar-nav pt-lg-3">
            {groups.map((group) => (
              <li key={group.label} className="nav-item">
                <div className="nav-link text-uppercase text-muted fw-bold small">
                  {group.label}
                </div>
                <ul className="nav flex-column ms-0">
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      open={open[item.href] ?? false}
                      onNavigate={onNavigate}
                      onToggle={() =>
                        setOpen((prev) => ({ ...prev, [item.href]: !(prev[item.href] ?? false) }))
                      }
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  open,
  onNavigate,
  onToggle,
}: {
  item: NavItem;
  pathname: string;
  open: boolean;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  const active = isActive(pathname, flattenFirstHref(item));
  const hasChildren = !!item.children?.length;
  const isUC = item.underConstruction;

  if (!hasChildren) {
    const Icon = item.icon;
    return (
      <li className="nav-item">
        <Link
          className={"nav-link" + (active ? " active" : "") + (isUC ? " opacity-40 pointer-events-none" : "")}
          href={item.href}
          onClick={onNavigate}
          aria-disabled={isUC}
          tabIndex={isUC ? -1 : undefined}
        >
          <span className="nav-link-icon d-md-none d-lg-inline-block">
            <Icon size={18} />
          </span>
          <span className="nav-link-title" style={isUC ? { textDecoration: "line-through", color: "#6b7280" } : undefined}>{item.title}</span>
        </Link>
      </li>
    );
  }

  const Icon = item.icon;
  const expanded = open || item.children!.some((c) => isActive(pathname, c.href));

  return (
    <li className={"nav-item" + (expanded ? " active" : "")}
    >
      <button
        type="button"
        className={"nav-link w-100 text-start" + (expanded ? " active" : "")}
        onClick={onToggle}
      >
        <span className="nav-link-icon d-md-none d-lg-inline-block">
          <Icon size={18} />
        </span>
        <span className="nav-link-title">{item.title}</span>
        <span className="ms-auto">▾</span>
      </button>

      {expanded && (
        <ul className="nav flex-column">
          {item.children!.map((child) => (
            <SidebarLeaf
              key={child.href}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SidebarLeaf({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const isUC = item.underConstruction;

  if (!hasChildren) {
    return (
      <li className="nav-item">
        <Link
          className={"nav-link" + (active ? " active" : "") + (isUC ? " opacity-40 pointer-events-none" : "")}
          href={item.href}
          onClick={onNavigate}
          aria-disabled={isUC}
          tabIndex={isUC ? -1 : undefined}
        >
          <span className="nav-link-icon d-md-none d-lg-inline-block">
            <Icon size={16} />
          </span>
          <span className="nav-link-title" style={isUC ? { textDecoration: "line-through", color: "#6b7280" } : undefined}>{item.title}</span>
        </Link>
      </li>
    );
  }

  return (
    <li className="nav-item">
      <div className="nav-link text-muted">
        <span className="nav-link-title">{item.title}</span>
      </div>
      <ul className="nav flex-column">
        {item.children!.map((sub) => (
          <SidebarLeaf
            key={sub.href}
            item={sub}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </li>
  );
}
