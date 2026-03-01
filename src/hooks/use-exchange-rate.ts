import { useState, useEffect } from "react";

interface ExchangeRateData {
    usdToEur: number;
    eurToUsd: number;
    isLoading: boolean;
    date: string;
    source: string;
}

export function useExchangeRate(): ExchangeRateData {
    const [usdToEur, setUsdToEur] = useState(0.92);
    const [eurToUsd, setEurToUsd] = useState(1.087);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState("");
    const [source, setSource] = useState("default");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/exchange-rate");
                const data = await res.json();
                if (!cancelled && data.success) {
                    setUsdToEur(data.usdToEur);
                    setEurToUsd(data.eurToUsd);
                    setDate(data.date || "");
                    setSource(data.source || "api");
                }
            } catch {
                // keep defaults
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { usdToEur, eurToUsd, isLoading, date, source };
}
