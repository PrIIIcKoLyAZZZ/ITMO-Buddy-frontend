import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PagedResult, ProfileCardResponse } from '@/api/contracts'
import { UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Chips, profileName } from '@/profile/ui'
import { maxPage } from './queries'

export function StudentCard({ user, badge, children, actions }: {
  user: ProfileCardResponse; badge?: ReactNode; children?: ReactNode; actions?: ReactNode
}) {
  const name = profileName(user)
  const study = [user.faculty?.name, user.course ? `${user.course} курс` : null].filter(Boolean).join(' · ')
  return <article className="social-card flex flex-col gap-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar name={name} photoUrl={user.photoUrl} className="size-14" />
        <div className="min-w-0">
          <h2 className="font-bold wrap-anywhere">
            <Link className="hover:underline" to={`/users/${user.userId}`}>{name}</Link>
          </h2>
          {study && <p className="text-sm text-secondary-ink wrap-anywhere">{study}</p>}
        </div>
      </div>
      {badge}
    </div>
    {user.interests.length > 0 && <Chips values={user.interests.map(item => item.name)} />}
    {children}
    {actions && <div className="mt-auto border-t border-border pt-4">{actions}</div>}
  </article>
}

export function Pagination({ result, onPage }: { result: PagedResult<unknown>; onPage: (page: number) => void }) {
  const { page, pageSize, totalCount, hasNextPage } = result
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))
  if (page === 1 && lastPage === 1) return null
  return <nav aria-label="Страницы результатов" className="flex flex-wrap items-center justify-between gap-2">
    <Button variant="outline" disabled={page <= 1} onClick={() => onPage(Math.min(page - 1, lastPage))}>
      <ChevronLeft size={16} /> Назад
    </Button>
    <span className="text-sm text-secondary-ink">Страница {page}{page <= lastPage && ` из ${lastPage}`}</span>
    <Button variant="outline" disabled={page >= maxPage || !(hasNextPage ?? page < lastPage)}
      onClick={() => onPage(page + 1)}>Далее <ChevronRight size={16} /></Button>
  </nav>
}
