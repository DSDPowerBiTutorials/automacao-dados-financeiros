"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TablerTopbar } from "@/components/tabler/TablerTopbar";
import Image from "next/image";

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
    <div className="page relative min-h-screen">
      {/* Background with logos - fixed behind everything (dark mode only via opacity) */}
      <div className="fixed inset-0 z-0" style={{ opacity: 'var(--bg-image-opacity)' }}>
        <Image
          src="/LoginBackgroundLogo.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, var(--overlay-from), var(--overlay-via), var(--overlay-to))` }} />
      </div>

      <div className="page-wrapper relative z-10">
        <TablerTopbar
          mobileOpen={mobileOpen}
          navVisible={navVisible}
          onToggleMobileMenu={() => setMobileOpen((v) => !v)}
          onToggleNavVisible={toggleNavVisible}
        />
        <div className="page-body">
          <div className="app-container">
            <div className="app-content-wrapper rounded-lg shadow-xl my-4 min-h-[calc(100vh-120px)]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
