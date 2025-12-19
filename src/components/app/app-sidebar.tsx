"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { NAV } from "@/config/navigation"
import { CompanyViewSelector } from "./company-view-selector"

function isActivePath(pathname: string, href: string) {
  try {
    const url = new URL(href, "http://local")
    return pathname === url.pathname || pathname.startsWith(url.pathname + "/")
  } catch {
    return pathname === href || pathname.startsWith(href + "/")
  }
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const width = expanded ? "16rem" : "5rem"
    document.documentElement.style.setProperty("--sidebar-width", width)
  }, [expanded])

  useEffect(() => {
    // Auto-open groups and items containing active path
    NAV.forEach((group) => {
      group.items.forEach((item) => {
        if (isActivePath(pathname, item.href)) {
          setOpenGroups(prev => ({ ...prev, [group.label]: true }))
        }
        if (item.children) {
          item.children.forEach((child) => {
            if (isActivePath(pathname, child.href)) {
              setOpenGroups(prev => ({ ...prev, [group.label]: true }))
              setOpenItems(prev => ({ ...prev, [item.href]: true }))
            }
          })
        }
      })
    })
  }, [pathname])

  const handleNavigate = (href: string) => {
    router.push(href)
  }

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const toggleItem = (href: string) => {
    setOpenItems(prev => ({ ...prev, [href]: !prev[href] }))
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-gray-100 border-r border-gray-200 shadow-sm transition-all duration-300 flex flex-col z-50"
      style={{ width: expanded ? '16rem' : '5rem' }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 flex-shrink-0">
        <Image src="/favicon-32x32.png" alt="DSD Logo" width={24} height={24} />
        {expanded && (
          <div>
            <p className="text-sm font-semibold text-[#243140]">DSD Finance</p>
            <p className="text-[9px] text-gray-500 leading-tight">Proprietary Software</p>
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex-shrink-0">
          <CompanyViewSelector />
        </div>
      )}

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <div className="space-y-1">
          {NAV.map((group) => {
            const isGroupOpen = openGroups[group.label]
            const isGroupActive = group.items.some(item => isActivePath(pathname, item.href))

            return (
              <div key={group.label} className="mb-2">
                <button
                  onClick={() => expanded && toggleGroup(group.label)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${isGroupActive
                      ? "bg-[#243140] text-gray-100"
                      : "text-[#243140] hover:bg-gray-200"
                    }
                  `}
                >
                  {(() => {
                    const GroupIcon = group.items[0]?.icon
                    return GroupIcon ? <GroupIcon className="h-5 w-5 flex-shrink-0" /> : null
                  })()}
                  {expanded && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{group.label}</span>
                      {isGroupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>

                {expanded && isGroupOpen && (
                  <div className="mt-1 ml-2 space-y-0.5">
                    {group.items.map((item) => {
                      const isItemActive = isActivePath(pathname, item.href)
                      const hasChildren = item.children && item.children.length > 0
                      const isItemOpen = openItems[item.href]

                      return (
                        <div key={item.href}>
                          <div className="flex items-center">
                            <button
                              onClick={() => hasChildren ? toggleItem(item.href) : handleNavigate(item.href)}
                              className={`
                                flex-1 flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-left
                                ${isItemActive
                                  ? "bg-[#243140] text-gray-100"
                                  : "text-[#243140] hover:bg-gray-100"
                                }
                              `}
                            >
                              {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                              <span className="text-sm font-medium flex-1">{item.title}</span>
                              {hasChildren && (
                                isItemOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          {hasChildren && isItemOpen && (
                            <div className="mt-1 ml-6 space-y-0.5">
                              {item.children!.map((child) => {
                                const isChildActive = isActivePath(pathname, child.href)
                                return (
                                  <button
                                    key={child.href}
                                    onClick={() => handleNavigate(child.href)}
                                    className={`
                                      w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-left
                                      ${isChildActive
                                        ? "bg-[#243140] text-gray-100"
                                        : "text-[#243140] hover:bg-gray-100"
                                      }
                                    `}
                                  >
                                    {child.icon && <child.icon className="h-3.5 w-3.5 flex-shrink-0" />}
                                    <span className="text-xs font-medium">{child.title}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {expanded && (
        <footer className="flex-shrink-0 text-center text-[10px] text-gray-500 border-t border-gray-200 py-4">
          <p className="font-medium">DSD Finance Hub</p>
          <p className="mt-0.5">© 2025</p>
        </footer>
      )}
    </aside>
  )
}
