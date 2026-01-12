"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV, type NavGroup, type NavItem } from "@/config/navigation";
import { UserMenu } from "@/components/auth/UserMenu";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { SCOPE_CONFIG } from "@/lib/scope-utils";

export function TablerTopbar({
  mobileOpen,
  onToggleMobileMenu,
}: {
  mobileOpen: boolean;
  onToggleMobileMenu: () => void;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] = useMemo(() => NAV, []);
  const { selectedScope, setSelectedScope } = useGlobalScope();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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
      <header className="navbar navbar-expand-md d-print-none">
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

      <header className="navbar-expand-md">
        <div className={"collapse navbar-collapse" + (mobileOpen ? " show" : "")} id="navbar-menu">
          <div className="navbar navbar-light">
            <div className="container-xl">
              <ul className="navbar-nav">
                {groups.map((group) => {
                  const isOpen = openGroup === group.label;
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
                      <div className={"dropdown-menu" + (isOpen ? " show" : "")}>
                        {group.items.map((item) => (
                          <DropdownItem key={item.href} item={item} pathname={pathname || "/"} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
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
        {item.children!.map((child) => {
          const ChildIcon = child.icon;
          const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
          return (
            <Link
              key={child.href}
              className={"dropdown-item" + (childActive ? " active" : "")}
              href={child.href}
            >
              <span className="dropdown-item-icon">
                <ChildIcon size={18} />
              </span>
              {child.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
