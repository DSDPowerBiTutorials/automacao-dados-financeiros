"use client";

import "./globals.css";
import "../lib/fonts";
import type { Metadata } from "next";
import Script from "next/script";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "DSD Finance Hub",
  description:
    "Sistema financeiro inteligente de conciliação bancária e relatórios.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <Script src="/lasy-bridge.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
