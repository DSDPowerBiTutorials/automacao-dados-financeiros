"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV, type NavGroup, type NavItem } from "@/config/navigation";
import { UserMenu } from "@/components/auth/UserMenu";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { SCOPE_CONFIG } from "@/lib/scope-utils";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

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
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [alignOverride, setAlignOverride] = useState<Record<string, boolean>>({});

  const closeMenu = () => setOpenGroup(null);

  useEffect(() => { setOpenGroup(null); }, [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const el = dropdownRefs.current[openGroup];
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const padding = 12;
      const shouldAlignEnd = rect.right > window.innerWidth - padding;
      const shouldAlignStart = rect.left < padding;
      setAlignOverride((prev) => {
        const current = prev[openGroup];
        let next = current;
        if (shouldAlignEnd) next = true;
        else if (shouldAlignStart) next = false;
        else return prev;
        if (current === next) return prev;
        return { ...prev, [openGroup]: next };
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [openGroup]);

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
      {/* Top Header Bar - DARK */}
      <header className="navbar navbar-expand-md d-print-none sticky-top" style={{ zIndex: 1030, background: '#1e1f21', borderBottom: '1px solid #333' }}>
        <div className="app-container">
          <button
            className="navbar-toggler border-gray-600"
            type="button"
            onClick={onToggleMobileMenu}
            aria-controls="navbar-menu"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            style={{ filter: 'invert(1)' }}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <h1 className="navbar-brand pe-0 pe-md-3 m-0">
            <Link href="/dashboard" className="text-decoration-none">
              <span className="d-inline-flex align-items-center gap-2">
                <Image src="/favicon-32x32.png" alt="DSD" width={28} height={28} />
                <span className="d-none d-sm-inline fw-bold" style={{ background: 'linear-gradient(90deg, #FF7300, #ffa94d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  DSD Finance Hub
                </span>
              </span>
            </Link>
          </h1>

          <div className="navbar-nav flex-row order-md-last align-items-center gap-2">
            {/* Toggle Menu Button */}
            <div className="nav-item">
              <button
                type="button"
                className="btn btn-sm"
                onClick={onToggleNavVisible}
                aria-label={navVisible ? "Recolher menu" : "Expandir menu"}
                title={navVisible ? "Recolher menu" : "Expandir menu"}
                style={{ background: navVisible ? '#FF7300' : '#333', color: '#fff', border: 'none' }}
              >
                {navVisible ? (
                  <span className="d-inline-flex align-items-center gap-1"><ChevronUp size={16} /> Menu</span>
                ) : (
                  <span className="d-inline-flex align-items-center gap-1"><ChevronDown size={16} /> Menu</span>
                )}
              </button>
            </div>

            {/* Search */}
            <div className="nav-item d-none d-md-flex">
              <div className="input-icon">
                <span className="input-icon-addon" style={{ color: '#888' }}><Search size={16} /></span>
                <input
                  type="text"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  className="form-control form-control-sm"
                  placeholder="Buscar..."
                  aria-label="Buscar no menu"
                  style={{ background: '#2a2b2e', border: '1px solid #444', color: '#fff', width: '160px' }}
                />
              </div>
            </div>

            {/* Scope Selector */}
            <div className="nav-item d-none d-md-flex">
              <div className="btn-group btn-group-sm">
                {(["ES", "US", "GLOBAL"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    className="btn"
                    onClick={() => setSelectedScope(scope)}
                    style={{
                      background: selectedScope === scope ? '#FF7300' : '#2a2b2e',
                      color: selectedScope === scope ? '#fff' : '#aaa',
                      border: '1px solid #444',
                      fontWeight: selectedScope === scope ? 600 : 400
                    }}
                  >
                    {scope === "GLOBAL" ? "🌐" : scope === "ES" ? "🇪🇸" : "🇺🇸"} {scope}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Label */}
            <div className="nav-item d-none d-lg-flex">
              <span className="nav-link small" style={{ color: '#888' }}>{SCOPE_CONFIG[selectedScope].label}</span>
            </div>

            {/* User Menu */}
            <div className="nav-item ms-1">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Menu - DARK */}
      {navVisible && (
        <header className="navbar navbar-expand-md d-print-none" style={{ background: '#252628', borderBottom: '1px solid #333' }}>
          <div className="app-container">
            <div id="navbar-menu" className={"navbar-collapse " + (mobileOpen ? "d-block " : "d-none ") + "d-md-flex"}>
              {/* Mobile Search & Scope */}
              <div className="d-md-none py-2">
                <div className="row g-2 align-items-center">
                  <div className="col-12">
                    <input
                      type="text"
                      value={menuQuery}
                      onChange={(e) => setMenuQuery(e.target.value)}
                      className="form-control"
                      placeholder="Buscar no menu…"
                      style={{ background: '#2a2b2e', border: '1px solid #444', color: '#fff' }}
                    />
                  </div>
                  <div className="col-12">
                    <div className="btn-group w-100">
                      {(["ES", "US", "GLOBAL"] as const).map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setSelectedScope(scope)}
                          style={{
                            background: selectedScope === scope ? '#FF7300' : '#2a2b2e',
                            color: selectedScope === scope ? '#fff' : '#aaa',
                            border: '1px solid #444'
                          }}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <ul className="navbar-nav">
                {filterGroups(groups, menuQuery).map((group) => {
                  const isOpen = openGroup === group.label;
                  const hasFilteredItems = group.items.length > 0;
                  if (!hasFilteredItems) return null;
                  const columns = toColumns(group.items);
                  const shouldAlignEnd = !!alignOverride[group.label];

                  return (
                    <li key={group.label} className={"nav-item dropdown" + (isOpen ? " show" : "")}>
                      <button
                        type="button"
                        className={"nav-link dropdown-toggle" + (isOpen ? " show" : "")}
                        onClick={(e) => { e.stopPropagation(); setOpenGroup(isOpen ? null : group.label); }}
                        style={{ color: isOpen ? '#FF7300' : '#ccc', fontWeight: 500 }}
                      >
                        {group.label}
                      </button>
                      {isOpen && (
                        <div
                          className={"dropdown-menu show" + (shouldAlignEnd ? " dropdown-menu-end" : "")}
                          ref={(el) => { dropdownRefs.current[group.label] = el; }}
                          style={{ top: "100%", bottom: "auto", background: '#1e1f21', border: '1px solid #444', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                        >
                          <div className="dropdown-menu-columns">
                            {columns.map((col, idx) => (
                              <div key={idx} className="dropdown-menu-column">
                                {col.map((item) => (
                                  <DropdownItem key={item.href} item={item} pathname={pathname || "/"} onNavigate={closeMenu} />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
  const prunedChildren = item.children.map((c) => pruneItem(c, q)).filter((x): x is NavItem => !!x);
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
  return groups.map((g) => {
    const items = g.items.map((i) => pruneItem(i, q)).filter((x): x is NavItem => !!x);
    return { ...g, items };
  }).filter((g) => g.items.length > 0);
}

function toColumns(items: NavItem[]): NavItem[][] {
  const maxPerCol = 6;
  const cols = Math.min(5, Math.max(1, Math.ceil(items.length / maxPerCol)));
  if (cols === 1) return [items];
  const per = Math.ceil(items.length / cols);
  const result: NavItem[][] = [];
  for (let i = 0; i < cols; i++) {
    const start = i * per;
    const end = start + per;
    const chunk = items.slice(start, end);
    if (chunk.length) result.push(chunk);
  }
  return result.length ? result : [items];
}

function DropdownItem({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const hasChildren = !!item.children?.length;

  if (!hasChildren) {
    return (
      <Link
        className="dropdown-item d-flex align-items-center gap-2"
        href={item.href}
        onClick={onNavigate}
        style={{ color: active ? '#FF7300' : '#ccc', background: active ? 'rgba(255,115,0,0.1)' : 'transparent', borderRadius: '6px', padding: '8px 12px' }}
      >
        <Icon size={18} style={{ color: active ? '#FF7300' : '#888' }} />
        <span style={{ fontWeight: active ? 600 : 400 }}>{item.title}</span>
      </Link>
    );
  }

  return (
    <div className="dropdown-item-text px-2 py-2">
      <div className="text-uppercase fw-bold small mb-2" style={{ color: '#FF7300', letterSpacing: '0.5px' }}>{item.title}</div>
      <div className="d-grid gap-1">
        {item.children!.map((child) => (
          <DropdownChild key={child.href} child={child} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function DropdownChild({ child, pathname, onNavigate }: { child: NavItem; pathname: string; onNavigate: () => void }) {
  const ChildIcon = child.icon;
  const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
  const hasGrandChildren = !!child.children?.length;

  if (!hasGrandChildren) {
    return (
      <Link
        className="dropdown-item d-flex align-items-center gap-2"
        href={child.href}
        onClick={onNavigate}
        style={{ color: childActive ? '#FF7300' : '#bbb', background: childActive ? 'rgba(255,115,0,0.1)' : 'transparent', borderRadius: '6px', padding: '6px 10px' }}
      >
        <ChildIcon size={16} style={{ color: childActive ? '#FF7300' : '#666' }} />
        <span style={{ fontWeight: childActive ? 600 : 400 }}>{child.title}</span>
      </Link>
    );
  }

  return (
    <div className="dropdown-item-text">
      <div className="small fw-semibold mt-2 mb-1" style={{ color: '#888' }}>{child.title}</div>
      <div className="d-grid gap-1 ps-3" style={{ borderLeft: '2px solid #444' }}>
        {child.children!.map((sub) => {
          const SubIcon = sub.icon;
          const subActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
          return (
            <Link
              key={sub.href}
              className="dropdown-item d-flex align-items-center gap-2"
              href={sub.href}
              onClick={onNavigate}
              style={{ color: subActive ? '#FF7300' : '#999', background: subActive ? 'rgba(255,115,0,0.1)' : 'transparent', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
            >
              <SubIcon size={14} style={{ color: subActive ? '#FF7300' : '#555' }} />
              <span style={{ fontWeight: subActive ? 600 : 400 }}>{sub.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
