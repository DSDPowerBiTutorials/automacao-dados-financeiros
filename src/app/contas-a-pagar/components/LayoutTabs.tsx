"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { value: "overview", label: "Overview", href: "/contas-a-pagar" },
  { value: "despesas", label: "Despesas", href: "/contas-a-pagar/despesas" },
  { value: "fornecedores", label: "Fornecedores", href: "/contas-a-pagar/fornecedores" },
  { value: "contas", label: "Contas Gerenciais", href: "/contas-a-pagar/contas-gerenciais" },
  { value: "conciliation", label: "Conciliation", href: "/contas-a-pagar/conciliation" },
];

export function LayoutTabs() {
  const pathname = usePathname();
  const active =
    tabs.find((tab) =>
      tab.href === "/contas-a-pagar"
        ? pathname === tab.href
        : pathname?.startsWith(tab.href),
    )?.value ?? "overview";

  return (
    <Tabs value={active} className="w-full">
      <TabsList className="grid w-full grid-cols-5 bg-[#1a2b4a]/10">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="data-[state=active]:bg-[#1a2b4a] data-[state=active]:text-white"
            asChild
          >
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
