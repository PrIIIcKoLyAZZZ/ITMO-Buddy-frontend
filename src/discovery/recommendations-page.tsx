import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import type { GoalCategory } from '@/api/contracts'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { goals } from '@/profile/ui'
import { SocialActions } from '@/social/actions'
import { recommendations } from './queries'
import { Pagination, StudentCard } from './ui'

export default function RecommendationsPage() {
  const [goal, setGoal] = useState<GoalCategory | ''>('')
  const [page, setPage] = useState(1)
  const result = useQuery(recommendations(page, goal || undefined))

  return <div className="space-y-5">
    <h1 className="page-title">Рекомендации</h1>
    <label className="social-card flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
      Категория цели
      <select className="w-full rounded-lg border border-border bg-white px-3 py-2 sm:w-auto"
        value={goal} onChange={event => { setGoal(event.target.value as GoalCategory | ''); setPage(1) }}>
        <option value="">Все цели</option>
        {Object.entries(goals).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {result.isPending ? <LoadingSkeleton label="Подбираем рекомендации" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <>
        {result.data.items.length > 0 ? <div className="social-grid">{result.data.items.map(({ user, score, reasons }) =>
          <StudentCard key={user.userId} user={user}
            badge={<span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-800">
              <Sparkles size={14} aria-hidden="true" /> {new Intl.NumberFormat('ru', { style: 'percent', maximumFractionDigits: 1 }).format(score)} совместимость
            </span>}
            actions={<SocialActions userId={user.userId} canSkip />}>
            {reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-ink wrap-anywhere">
              {reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.description}</li>)}
            </ul>}
          </StudentCard>)}</div>
          : <EmptyState icon={<Sparkles />} title="Рекомендаций пока нет"
            description={goal ? 'Попробуй выбрать другую категорию цели.' : 'Попробуй позже или найди студентов через поиск.'} />}
        <Pagination result={result.data} onPage={setPage} />
      </>}
  </div>
}
