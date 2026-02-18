"use client";

import { useState } from "react";
import { ScopeSelector } from "@/components/app/scope-selector";
import type { ScopeType } from "@/lib/scope-utils";

export function CompanyViewSelector() {
  const [scope, setScope] = useState<ScopeType>("all");

  return (
    <div className="px-3 py-2 border-t border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1f21]">
      <label className="block text-[11px] text-gray-500 mb-1">Company View</label>
      <ScopeSelector
        value={scope}
        onValueChange={(val) => setScope(val)}
        className="w-full text-sm"
      />
    </div>
  );
}