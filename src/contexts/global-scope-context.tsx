"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { type ScopeType } from "@/lib/scope-utils";

interface GlobalScopeContextType {
    selectedScope: ScopeType;
    setSelectedScope: (scope: ScopeType) => void;
}

const GlobalScopeContext = createContext<GlobalScopeContextType | undefined>(undefined);

export function GlobalScopeProvider({ children }: { children: React.ReactNode }) {
    // Inicializar com valor do localStorage ou ES como padrão
    const [selectedScope, setSelectedScopeState] = useState<ScopeType>("ES");

    // Carregar do localStorage na montagem
    useEffect(() => {
        const savedScope = localStorage.getItem("globalScope");
        if (savedScope && (savedScope === "ES" || savedScope === "US" || savedScope === "GLOBAL")) {
            setSelectedScopeState(savedScope as ScopeType);
        }
    }, []);

    // Salvar no localStorage quando mudar
    const setSelectedScope = (scope: ScopeType) => {
        setSelectedScopeState(scope);
        localStorage.setItem("globalScope", scope);
    };

    return (
        <GlobalScopeContext.Provider value={{ selectedScope, setSelectedScope }}>
            {children}
        </GlobalScopeContext.Provider>
    );
}

export function useGlobalScope() {
    const context = useContext(GlobalScopeContext);
    if (context === undefined) {
        throw new Error("useGlobalScope must be used within a GlobalScopeProvider");
    }
    return context;
}
