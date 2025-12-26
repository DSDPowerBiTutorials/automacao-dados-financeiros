"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ScopeType, SCOPE_CONFIG } from "@/lib/scope-utils";

interface ScopeSelectorProps {
  value: ScopeType;
  onValueChange: (value: ScopeType) => void;
  className?: string;
  label?: string;
  multiSelect?: boolean;
}

export function ScopeSelector({ value, onValueChange, className, label }: ScopeSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={label || "Select country"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ES">
          <span className="flex items-center gap-2">
            <span>{SCOPE_CONFIG.ES.icon}</span>
            <span>{SCOPE_CONFIG.ES.label}</span>
          </span>
        </SelectItem>
        <SelectItem value="US">
          <span className="flex items-center gap-2">
            <span>{SCOPE_CONFIG.US.icon}</span>
            <span>{SCOPE_CONFIG.US.label}</span>
          </span>
        </SelectItem>
        <SelectItem value="GLOBAL">
          <span className="flex items-center gap-2">
            <span>{SCOPE_CONFIG.GLOBAL.icon}</span>
            <span>{SCOPE_CONFIG.GLOBAL.label}</span>
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
