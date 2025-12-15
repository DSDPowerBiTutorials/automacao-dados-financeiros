/* eslint-disable */
/* prettier-ignore-start */
/* @auto-fix-disable */
/* @formatter:off */

/*
🚫 Arquivo protegido — NÃO EDITAR.
Este layout é um Server Component. 
Não adicione "use client" sob nenhuma circunstância.
Qualquer modificação deve ser feita manualmente com autorização de Dev Lead.
*/

import "./globals.css";
import "../styles/dsd-theme.css";
import "../lib/fonts";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/theme-provider";

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
      <body suppressHydrationWarning={true}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

/* prettier-ignore-end */
