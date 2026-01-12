"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TablerTopbar } from "@/components/tabler/TablerTopbar";

const NAV_VISIBILITY_STORAGE_KEY = "tblr.nav.visible";

export function TablerAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  useEffect(() => {
    import("@tabler/core/dist/js/tabler.min.js");
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);
      if (raw === null) return;
      setNavVisible(raw === "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleNavVisible = () => {
    setNavVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NAV_VISIBILITY_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="page">
      <div className="page-wrapper">
        <TablerTopbar
          mobileOpen={mobileOpen}
          navVisible={navVisible}
          onToggleMobileMenu={() => setMobileOpen((v) => !v)}
          onToggleNavVisible={toggleNavVisible}
        />
        <div className="page-body">
          <div className="container-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
