"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ScopeType } from "@/lib/scope-utils";

interface ScopeSelectorProps {
  value: ScopeType;
  onValueChange: (value: ScopeType) => void;
  className?: string;
}

export function ScopeSelector({ value, onValueChange, className }: ScopeSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="dsd">DSD</SelectItem>
        <SelectItem value="lh">LH</SelectItem>
        <SelectItem value="dsd_lh">DSD+LH</SelectItem>
      </SelectContent>
    </Select>
  );
}
