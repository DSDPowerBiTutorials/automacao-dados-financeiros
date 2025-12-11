1 | /* eslint-disable */
2 | /* prettier-ignore-start */
3 | /* @auto-fix-disable */
4 | /* @formatter:off */
5 | 
6 | // 🚫 This file MUST remain a Server Component.
7 | // 🚫 DO NOT ADD client directives — It breaks metadata export and Vercel builds.
8 | 
9 | import "../lib/fonts";
10| import type { Metadata } from "next";
11|
12| export const metadata: Metadata = {
13|   title: "DSD Finance Hub",
14|   description:
15|     "Sistema financeiro inteligente de conciliação bancária e relatórios.",
16| };
17|
18| export default function RootLayout({
19|   children,
20| }: {
21|   children: React.ReactNode;
22| }) {
23|   return (
24|     <html lang="pt-BR">
25|       <body>{children}</body>
26|     </html>
27|   );
28| }
29|
30| /* prettier-ignore-end */
