/* eslint-disable */
/* prettier-ignore-start */
/* @auto-fix-disable */
/* @formatter:off */

import "./globals.css";
import "../lib/fonts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DSD Finance Hub",
  description:
    "Sistema financeiro inteligente de conciliação bancária e relatórios.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

/* prettier-ignore-end */
