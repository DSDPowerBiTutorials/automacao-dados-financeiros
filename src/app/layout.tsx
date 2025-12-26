import "./globals.css"
import Sidebar from "@/components/custom/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { CompanyViewProvider } from "@/contexts/company-view-context"
import { GlobalScopeProvider } from "@/contexts/global-scope-context"

export const metadata = {
  title: "DSD Finance Hub",
  description: "Financial management system by Digital Smile Design",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex bg-gradient-to-br from-gray-50 to-gray-100 text-neutral-900">
        <CompanyViewProvider>
          <GlobalScopeProvider>
            <Sidebar />
            <main className="flex-1 min-h-screen transition-all duration-300 ease-in-out" style={{ marginLeft: 'var(--sidebar-width, 4rem)' }}>
              <div className="p-6">
                <div className="bg-white rounded-3xl shadow-xl min-h-[calc(100vh-3rem)] p-8">
                  {children}
                </div>
              </div>
            </main>
            <Toaster />
          </GlobalScopeProvider>
        </CompanyViewProvider>
      </body>
    </html>
  )
}
