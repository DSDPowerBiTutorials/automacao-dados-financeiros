"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ButtonExportProps {
  onClick: () => void
  disabled?: boolean
}

export function ButtonExport({ onClick, disabled }: ButtonExportProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      className="border-[#1a2b4a] text-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white"
    >
      <Download className="mr-2 h-4 w-4" />
      Export Data
    </Button>
  )
}
