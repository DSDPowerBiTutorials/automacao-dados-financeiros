import "./globals.css"
import { Sidebar } from "@/components/custom/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { CompanyViewProvider } from "@/contexts/company-view-context"

export const metadata = {
  title: "DSD Finance Hub",
  description: "Financial management system by Digital Smile Design",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex bg-gradient-to-br from-gray-50 to-gray-100 text-neutral-900">
        <CompanyViewProvider>
          <Sidebar />
          <main className="flex-1 min-h-screen transition-all duration-300 ml-20 md:ml-20" style={{ marginLeft: 'var(--sidebar-width, 5rem)' }}>
            <div className="p-6">
              <div className="bg-white rounded-3xl shadow-xl min-h-[calc(100vh-3rem)] p-8">
                {children}
              </div>
            </div>
          </main>
          <Toaster />
        </CompanyViewProvider>
      </body>
    </html>
  )
}
