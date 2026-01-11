"use client";

import { useEffect } from "react";
import { TablerSidebar } from "@/components/tabler/TablerSidebar";
import { TablerTopbar } from "@/components/tabler/TablerTopbar";

export function TablerAppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    import("@tabler/core/dist/js/tabler.min.js");
  }, []);

  return (
    <div className="page">
      <TablerSidebar />
      <div className="page-wrapper">
        <TablerTopbar />
        <div className="page-body">
          <div className="container-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
