import { MobileNav, DesktopNav } from '@/components/ui/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopNav />
      <main className="md:ml-64 pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
