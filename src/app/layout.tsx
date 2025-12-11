/* eslint-disable */
/* prettier-ignore-start */
/* @auto-fix-disable */
/* @formatter:off */

// 🚫 This file MUST remain a Server Component.
// 🚫 DO NOT ADD client directives — It breaks metadata export and Vercel builds.

import "../lib/fonts"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "DSD Finance Hub",
  description:
    "Sistema financeiro inteligente de conciliação bancária e relatórios.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

/* prettier-ignore-end */
