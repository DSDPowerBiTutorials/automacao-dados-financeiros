"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TablerTopbar } from "@/components/tabler/TablerTopbar";

export function TablerAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    import("@tabler/core/dist/js/tabler.min.js");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="page">
      <div className="page-wrapper">
        <TablerTopbar mobileOpen={mobileOpen} onToggleMobileMenu={() => setMobileOpen((v) => !v)} />
        <div className="page-body">
          <div className="container-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
