"use client";

import { useCompanyView, type CompanyViewType } from "@/contexts/company-view-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompanyViewSelector() {
  const { companyView, setCompanyView } = useCompanyView();

  return (
    <div className="px-3 py-2 border-t border-b border-gray-200 bg-white">
      <label className="block text-[11px] text-gray-500 mb-1">Company View</label>
      <Select value={companyView} onValueChange={(val) => setCompanyView(val as CompanyViewType)}>
        <SelectTrigger className="w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ES">🇪🇸 DSD Spain</SelectItem>
          <SelectItem value="US">🇺🇸 DSD USA</SelectItem>
          <SelectItem value="GLOBAL">🌐 Global (All)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
