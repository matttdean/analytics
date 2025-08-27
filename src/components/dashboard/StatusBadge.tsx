type Props = { value: string; tone?: 'status' | 'priority' }

export default function StatusBadge({ value, tone = 'status' }: Props) {
  const t = value.toLowerCase()
  const map =
    tone === 'priority'
      ? {
          high: 'bg-red-100 text-red-700',
          mild: 'bg-amber-100 text-amber-700',
          low: 'bg-emerald-100 text-emerald-700',
        }
      : {
          completed: 'bg-emerald-100 text-emerald-700',
          review: 'bg-amber-100 text-amber-700',
          'on review': 'bg-amber-100 text-amber-700',
          'in queue': 'bg-blue-100 text-blue-700',
          'in progress': 'bg-indigo-100 text-indigo-700',
        }
  const cls = map[t as keyof typeof map] || 'bg-zinc-100 text-zinc-700'
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${cls}`}>{value}</span>
}
