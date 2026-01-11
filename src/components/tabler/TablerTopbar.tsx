"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function TablerTopbar() {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <header className="navbar navbar-expand-md d-print-none">
      <div className="container-xl">
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#tabler-navbar-menu"
          aria-controls="tabler-navbar-menu"
          aria-expanded="false"
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

        <div className="navbar-nav flex-row order-md-last">
          <div className="nav-item d-none d-md-flex">
            <span className="nav-link text-muted">{isDashboard ? "Dashboard" : ""}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
