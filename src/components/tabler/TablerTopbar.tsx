"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV, type NavGroup, type NavItem } from "@/config/navigation";
import { UserMenu } from "@/components/auth/UserMenu";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { SCOPE_CONFIG } from "@/lib/scope-utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export function TablerTopbar({
  mobileOpen,
  navVisible,
  onToggleMobileMenu,
  onToggleNavVisible,
}: {
  mobileOpen: boolean;
  navVisible: boolean;
  onToggleMobileMenu: () => void;
  onToggleNavVisible: () => void;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] = useMemo(() => NAV, []);
  const { selectedScope, setSelectedScope } = useGlobalScope();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuQuery, setMenuQuery] = useState("");
  const dropdownRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = dropdownRootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpenGroup(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div ref={dropdownRootRef}>
      <header className="navbar navbar-expand-md d-print-none sticky-top" style={{ zIndex: 1030 }}>
        <div className="container-xl">
          <button
            className="navbar-toggler"
            type="button"
            onClick={onToggleMobileMenu}
            aria-controls="navbar-menu"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <h1 className="navbar-brand navbar-brand-autodark pe-0 pe-md-3">
            <Link href="/dashboard" className="text-decoration-none">
              <span className="d-inline-flex align-items-center gap-2">
                <Image src="/favicon-32x32.png" alt="DSD" width={24} height={24} />
                <span className="d-none d-sm-inline">DSD Finance Hub</span>
              </span>
            </Link>
          </h1>

          <div className="navbar-nav flex-row order-md-last align-items-center">
            <div className="nav-item me-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onToggleNavVisible}
                aria-label={navVisible ? "Recolher menu" : "Expandir menu"}
                title={navVisible ? "Recolher menu" : "Expandir menu"}
              >
                {navVisible ? (
                  <span className="d-inline-flex align-items-center gap-1">
                    <ChevronUp size={16} /> Menu
                  </span>
                ) : (
                  <span className="d-inline-flex align-items-center gap-1">
                    <ChevronDown size={16} /> Menu
                  </span>
                )}
              </button>
            </div>

            <div className="nav-item me-2 d-none d-md-flex">
              <div className="input-icon">
                <input
                  type="text"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  className="form-control"
                  placeholder="Buscar no menu…"
                  aria-label="Buscar no menu"
                />
              </div>
            </div>

            <div className="nav-item me-2 d-none d-md-flex">
              <div className="btn-list">
                <button
                  type="button"
                  className={"btn btn-sm " + (selectedScope === "ES" ? "btn-primary" : "btn-outline-primary")}
                  onClick={() => setSelectedScope("ES")}
                >
                  ES
                </button>
                <button
                  type="button"
                  className={"btn btn-sm " + (selectedScope === "US" ? "btn-primary" : "btn-outline-primary")}
                  onClick={() => setSelectedScope("US")}
                >
                  US
                </button>
                <button
                  type="button"
                  className={
                    "btn btn-sm " +
                    (selectedScope === "GLOBAL" ? "btn-primary" : "btn-outline-primary")
                  }
                  onClick={() => setSelectedScope("GLOBAL")}
                >
                  GLOBAL
                </button>
              </div>
            </div>

            <div className="nav-item d-none d-md-flex">
              <span className="nav-link text-muted small">{SCOPE_CONFIG[selectedScope].label}</span>
            </div>

            <div className="nav-item ms-2">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {navVisible && (
        <header className="navbar navbar-expand-md navbar-light d-print-none">
          <div className={"container-xl"}>
            <div className={"collapse navbar-collapse" + (mobileOpen ? " show" : "")} id="navbar-menu">
                <div className="d-md-none py-2">
                  <div className="row g-2 align-items-center">
                    <div className="col-12">
                      <input
                        type="text"
                        value={menuQuery}
                        onChange={(e) => setMenuQuery(e.target.value)}
                        className="form-control"
                        placeholder="Buscar no menu…"
                        aria-label="Buscar no menu"
                      />
                    </div>
                    <div className="col-12">
                      <div className="btn-list">
                        <button
                          type="button"
                          className={
                            "btn btn-sm " +
                            (selectedScope === "ES" ? "btn-primary" : "btn-outline-primary")
                          }
                          onClick={() => setSelectedScope("ES")}
                        >
                          ES
                        </button>
                        <button
                          type="button"
                          className={
                            "btn btn-sm " +
                            (selectedScope === "US" ? "btn-primary" : "btn-outline-primary")
                          }
                          onClick={() => setSelectedScope("US")}
                        >
                          US
                        </button>
                        <button
                          type="button"
                          className={
                            "btn btn-sm " +
                            (selectedScope === "GLOBAL" ? "btn-primary" : "btn-outline-primary")
                          }
                          onClick={() => setSelectedScope("GLOBAL")}
                        >
                          GLOBAL
                        </button>
                        <span className="text-muted small ms-2">{SCOPE_CONFIG[selectedScope].label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="navbar-nav">
                  {filterGroups(groups, menuQuery).map((group) => {
                    const isOpen = openGroup === group.label;
                    const columns = toColumns(group.items);
                    return (
                      <li
                        key={group.label}
                        className={"nav-item dropdown" + (isOpen ? " show" : "")}
                      >
                        <button
                          type="button"
                          className={"nav-link dropdown-toggle" + (isOpen ? " show" : "")}
                          aria-expanded={isOpen}
                          onClick={() => setOpenGroup((prev) => (prev === group.label ? null : group.label))}
                        >
                          <span className="nav-link-title">{group.label}</span>
                        </button>
                        <div
                          className={
                            "dropdown-menu dropdown-menu-columns dropdown-menu-arrow" +
                            (isOpen ? " show" : "")
                          }
                        >
                          {columns.map((col, idx) => (
                            <div key={idx} className="dropdown-menu-column">
                              {col.map((item) => (
                                <DropdownItem key={item.href} item={item} pathname={pathname || "/"} />
                              ))}
                            </div>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
            </div>
          </div>
        </header>
      )}
    </div>
  );
}

function normalize(str: string) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function itemMatches(item: NavItem, q: string): boolean {
  const qq = normalize(q);
  if (!qq) return true;

  if (normalize(item.title).includes(qq)) return true;
  if (normalize(item.href).includes(qq)) return true;

  for (const child of item.children ?? []) {
    if (itemMatches(child, q)) return true;
  }

  return false;
}

function pruneItem(item: NavItem, q: string): NavItem | null {
  const qq = normalize(q);
  if (!qq) return item;

  if (!item.children?.length) {
    return itemMatches(item, q) ? item : null;
  }

  const prunedChildren = item.children
    .map((c) => pruneItem(c, q))
    .filter((x): x is NavItem => !!x);

  if (itemMatches(item, q)) {
    return { ...item, children: prunedChildren.length ? prunedChildren : item.children };
  }

  if (prunedChildren.length) {
    return { ...item, children: prunedChildren };
  }

  return null;
}

function filterGroups(groups: NavGroup[], q: string): NavGroup[] {
  const qq = normalize(q);
  if (!qq) return groups;

  return groups
    .map((g) => {
      const items = g.items
        .map((i) => pruneItem(i, q))
        .filter((x): x is NavItem => !!x);
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
}

function toColumns(items: NavItem[]): NavItem[][] {
  if (items.length <= 10) return [items];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

function DropdownItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const hasChildren = !!item.children?.length;

  if (!hasChildren) {
    return (
      <Link className={"dropdown-item" + (active ? " active" : "")} href={item.href}>
        <span className="dropdown-item-icon">
          <Icon size={18} />
        </span>
        {item.title}
      </Link>
    );
  }

  return (
    <div className="dropdown-item-text">
      <div className="text-uppercase text-muted fw-bold small mb-2">{item.title}</div>
      <div className="d-grid gap-1">
        {item.children!.map((child) => (
          <DropdownChild key={child.href} child={child} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function DropdownChild({ child, pathname }: { child: NavItem; pathname: string }) {
  const ChildIcon = child.icon;
  const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
  const hasGrandChildren = !!child.children?.length;

  if (!hasGrandChildren) {
    return (
      <Link className={"dropdown-item" + (childActive ? " active" : "")} href={child.href}>
        <span className="dropdown-item-icon">
          <ChildIcon size={18} />
        </span>
        {child.title}
      </Link>
    );
  }

  return (
    <div className="dropdown-item-text">
      <div className="text-muted small fw-semibold mt-2">{child.title}</div>
      <div className="d-grid gap-1 ps-3">
        {child.children!.map((sub) => {
          const SubIcon = sub.icon;
          const subActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
          return (
            <Link key={sub.href} className={"dropdown-item" + (subActive ? " active" : "")} href={sub.href}>
              <span className="dropdown-item-icon">
                <SubIcon size={18} />
              </span>
              {sub.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
