import React from "react";
import { BarChart3 } from "lucide-react";

export const metadata = {
    title: "Executive Insights | FinanceFlow",
    description: "Strategic business intelligence and executive dashboards",
};

export default function ExecutiveInsightsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="flex-1">
            {children}
        </main>
    );
}
