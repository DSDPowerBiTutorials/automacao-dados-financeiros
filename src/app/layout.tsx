import "./globals.css"
import { AppSidebar } from "@/components/app/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { CompanyViewProvider } from "@/contexts/company-view-context"

export const metadata = {
  title: "DSD Finance Hub",
  description: "Financial management system by Digital Smile Design",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex bg-[#2c3e5f] text-neutral-900">
        <CompanyViewProvider>
          <AppSidebar />
          <main className="flex-1 bg-white min-h-screen transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width)' }}>
            {children}
          </main>
          <Toaster />
        </CompanyViewProvider>
      </body>
    </html>
  )
}
