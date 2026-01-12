"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TablerSidebar } from "@/components/tabler/TablerSidebar";
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
      <TablerSidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div className="page-wrapper">
        <TablerTopbar onToggleSidebar={() => setMobileOpen((v) => !v)} />
        <div className="page-body">
          <div className="container-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
