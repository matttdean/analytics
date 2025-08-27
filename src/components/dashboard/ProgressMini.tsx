type Props = {
    title: string
    meta?: string
    percent: number
    chip?: 'Low' | 'Mild' | 'High'
    tone?: 'blue' | 'pink' | 'amber' | 'emerald'
    avatars?: number
  }
  
  const toneClasses: Record<NonNullable<Props['tone']>, string> = {
    blue: 'bg-blue-500',
    pink: 'bg-pink-500',
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-500',
  }
  
  export default function ProgressMini({ title, meta, percent, chip = 'Mild', tone = 'blue', avatars = 3 }: Props) {
    return (
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-medium leading-5">{title}</div>
            {meta && <div className="text-xs text-zinc-500">{meta}</div>}
          </div>
          <span className="text-xs rounded-full px-2 py-1 bg-zinc-100">{chip}</span>
        </div>
  
        <div className="h-2 w-full rounded-full bg-zinc-100">
          <div className={`h-2 rounded-full ${toneClasses[tone]}`} style={{ width: `${percent}%` }} />
        </div>
  
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex -space-x-2">
            {Array.from({ length: avatars }).map((_, i) => (
              <div key={i} className="h-6 w-6 rounded-full bg-zinc-200 border-2 border-white" />
            ))}
          </div>
          <span>{percent}%</span>
        </div>
      </div>
    )
  }  