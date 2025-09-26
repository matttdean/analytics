import Footer from '../../components/Footer'
import Topbar from '../../components/dashboard/Topbar'
import Sidebar from '../../components/dashboard/Sidebar'
import AuthGuard from '../../components/AuthGuard'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </AuthGuard>
  )
}
