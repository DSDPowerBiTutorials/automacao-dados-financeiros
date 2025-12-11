"use client";

import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewMetrics } from "@/lib/supabase/queries/contas-a-pagar";

const items: { key: keyof OverviewMetrics; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "pending", label: "Pendentes" },
  { key: "incurred", label: "Incurred" },
  { key: "paid", label: "Pagas" },
  { key: "conciliated", label: "Conciliadas" },
  { key: "differences", label: "Diferenças" },
];

export function OverviewCards({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <Card key={item.key} className="border border-gray-200 shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-gray-600 font-medium">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1a2b4a]">
              {item.key === "total"
                ? formatCurrency(metrics[item.key] || 0)
                : metrics[item.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
