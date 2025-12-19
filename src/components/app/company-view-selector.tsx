"use client";

import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompanyViewSelector() {
  return (
    <div className="px-3 py-2 border-b border-gray-200">
      <Select defaultValue="all">
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span>🌐</span>
              <span>All Companies</span>
            </div>
          </SelectItem>
          <SelectItem value="dsd">
            <div className="flex items-center gap-2">
              <Image src="/spain.svg" alt="Spain" width={16} height={12} />
              <span>DSD Spain</span>
            </div>
          </SelectItem>
          <selectItem value="lh">
            <div className="flex items-center gap-2">
              <Image src="/united-states.svg" alt="USA" width={16} height={12} />
              <span>LH United States</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
