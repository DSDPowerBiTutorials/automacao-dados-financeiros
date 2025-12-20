"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type CompanyViewType = "ES" | "US" | "GLOBAL";

interface CompanyViewContextType {
  companyView: CompanyViewType;
  setCompanyView: (view: CompanyViewType) => void;
  companyIds: number[];
  companyName: string;
}

const CompanyViewContext = createContext<CompanyViewContextType | undefined>(undefined);

const STORAGE_KEY = "dsd-company-view";

const COMPANY_MAP = {
  ES: { id: 1, name: "DSD Spain" },
  US: { id: 2, name: "DSD USA" },
  GLOBAL: { ids: [1, 2], name: "Global (All)" },
};

export function CompanyViewProvider({ children }: { children: ReactNode }) {
  const [companyView, setCompanyViewState] = useState<CompanyViewType>("GLOBAL");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ES" || stored === "US" || stored === "GLOBAL") {
      setCompanyViewState(stored);
    }
  }, []);

  const setCompanyView = (view: CompanyViewType) => {
    setCompanyViewState(view);
    localStorage.setItem(STORAGE_KEY, view);
  };

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
