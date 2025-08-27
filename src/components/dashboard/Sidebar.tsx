import { Home, Clock3, MessagesSquare, User2, Users2, Building2, DollarSign, Bell, Settings, HelpCircle, ShieldCheck, Wrench } from 'lucide-react'

const Item = ({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) => (
  <div className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer ${active ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}>
    <Icon size={18} className="text-zinc-600" />
    <span className="text-sm">{label}</span>
  </div>
)

export default function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 bg-zinc-50 border-r">
      <div className="h-16 px-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-black" />
        <div className="font-semibold">Task Dasher</div>
      </div>

      <nav className="px-3 space-y-1">
        <Item icon={Home} label="All Tasks" active />
        <Item icon={Clock3} label="Timeline" />
        <Item icon={MessagesSquare} label="Messages" />
        <Item icon={User2} label="Profile" />
        <Item icon={Users2} label="Contacts" />
        <Item icon={Building2} label="Company" />
        <Item icon={DollarSign} label="Pricing" />
        <Item icon={Bell} label="Notifications" />
      </nav>

      <div className="px-3 mt-6 space-y-1">
        <Item icon={Settings} label="Settings" />
        <Item icon={HelpCircle} label="Help Center" />
        <Item icon={ShieldCheck} label="Authentication" />
        <Item icon={Wrench} label="Admin Pages" />
      </div>

      <div className="mt-auto p-4">
        <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
          <div className="h-9 w-9 rounded-full bg-zinc-200" />
          <div className="text-sm leading-4">
            <div className="font-medium">Jane Doe</div>
            <div className="text-zinc-500 text-xs">UX/UI Designer</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
