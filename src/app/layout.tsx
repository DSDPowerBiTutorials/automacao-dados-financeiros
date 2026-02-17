import "@tabler/core/dist/css/tabler.min.css"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { CompanyViewProvider } from "@/contexts/company-view-context"
import { GlobalScopeProvider } from "@/contexts/global-scope-context"
import { AuthProvider } from "@/contexts/auth-context"
import { TimezoneProvider } from "@/contexts/timezone-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { LayoutContent } from "@/components/layout/LayoutContent"
import { ThemeProvider } from "@/components/ui/theme-provider"

export const metadata = {
  title: "DSD Finance Hub",
  description: "Financial management system by Digital Smile Design",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="text-neutral-900">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <TimezoneProvider>
              <NotificationProvider>
                <CompanyViewProvider>
                  <GlobalScopeProvider>
                    <LayoutContent>
                      {children}
                    </LayoutContent>
                    <Toaster />
                  </GlobalScopeProvider>
                </CompanyViewProvider>
              </NotificationProvider>
            </TimezoneProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
