"use client";

import React from "react";
import { Button } from "@/components/ui/button";

type BankinterEURUploadFixedProps = {
  handleUpload: React.ChangeEventHandler<HTMLInputElement>;
};

export function BankinterEURUploadFixed({
  handleUpload,
}: BankinterEURUploadFixedProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        id="file-upload-bankinter"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={handleUpload}
      />
      <label htmlFor="file-upload-bankinter">
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-[#1a2b4a]"
        >
          📤 Upload Bankinter EUR
        </Button>
      </label>
    </div>
  );
}
