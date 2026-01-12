"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV, type NavGroup, type NavItem } from "@/config/navigation";

export function TablerTopbar({
  mobileOpen,
  onToggleMobileMenu,
}: {
  mobileOpen: boolean;
  onToggleMobileMenu: () => void;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] = NAV;

  return (
    <header className="navbar navbar-expand-md d-print-none">
      <div className="container-xl">
        <button
          className="navbar-toggler"
          type="button"
          onClick={onToggleMobileMenu}
          aria-controls="tabler-topnav"
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

        <div className={"collapse navbar-collapse" + (mobileOpen ? " show" : "")} id="tabler-topnav">
          <ul className="navbar-nav">
            {groups.map((group) => (
              <li key={group.label} className="nav-item dropdown">
                <a
                  className="nav-link dropdown-toggle"
                  href="#"
                  role="button"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="outside"
                  aria-expanded="false"
                  onClick={(e) => e.preventDefault()}
                >
                  <span className="nav-link-title">{group.label}</span>
                </a>
                <div className="dropdown-menu">
                  {group.items.map((item) => (
                    <DropdownItem key={item.href} item={item} pathname={pathname || "/"} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
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
