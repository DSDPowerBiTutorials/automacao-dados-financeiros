"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

/**
 * Company View Context
 * Manages the global company filter (Spain, USA, or Consolidated/Global)
 * Persists selection in localStorage
 * Used throughout the app to filter data by company_id
 */

export type CompanyViewType = "ES" | "US" | "GLOBAL";

interface CompanyViewContextType {
  companyView: CompanyViewType;
  setCompanyView: (view: CompanyViewType) => void;
  companyIds: number[]; // Derived: [1] for ES, [2] for US, [1,2] for GLOBAL
  companyName: string;  // User-friendly: "DSD Spain", "DSD USA", "Global (All)"
}

const CompanyViewContext = createContext<CompanyViewContextType | undefined>(undefined);

const STORAGE_KEY = "dsd-company-view";

// Company ID mapping (matches Supabase companies table)
const COMPANY_MAP = {
  ES: { id: 1, name: "DSD Spain" },
  US: { id: 2, name: "DSD USA" },
  GLOBAL: { ids: [1, 2], name: "Global (All)" },
};

export function CompanyViewProvider({ children }: { children: ReactNode }) {
  const [companyView, setCompanyViewState] = useState<CompanyViewType>("GLOBAL");

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ES" || stored === "US" || stored === "GLOBAL") {
      setCompanyViewState(stored);
    }
  }, []);

  // Save to localStorage on change
  const setCompanyView = (view: CompanyViewType) => {
    setCompanyViewState(view);
    localStorage.setItem(STORAGE_KEY, view);
  };

  // Derive company_ids for API queries
  const companyIds =
    companyView === "ES"
      ? [COMPANY_MAP.ES.id]
      : companyView === "US"
      ? [COMPANY_MAP.US.id]
      : COMPANY_MAP.GLOBAL.ids;

  const companyName =
    companyView === "ES"
      ? COMPANY_MAP.ES.name
      : companyView === "US"
      ? COMPANY_MAP.US.name
      : COMPANY_MAP.GLOBAL.name;

  return (
    <CompanyViewContext.Provider value={{ companyView, setCompanyView, companyIds, companyName }}>
      {children}
    </CompanyViewContext.Provider>
  );
}

export function useCompanyView() {
  const context = useContext(CompanyViewContext);
  if (!context) {
    throw new Error("useCompanyView must be used within CompanyViewProvider");
  }
  return context;
}
