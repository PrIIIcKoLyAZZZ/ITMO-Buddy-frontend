import type { ReactNode } from 'react'
import { CalendarDays, ClipboardList, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { goalLabel, profileName } from '@/profile/ui'
import type { ListingCardResponse, ListingFormat, ListingResponse, ListingStatus, ResponseStatus } from './contracts'

export const formatLabels: Record<ListingFormat, string> = { Online: 'Онлайн', Offline: 'Очно' }
const statuses: Record<ListingStatus | ResponseStatus, string> = {
  Open: 'Открыто', Closed: 'Закрыто', Pending: 'На рассмотрении', Accepted: 'Принят', Rejected: 'Отклонён',
}
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export function DateStamp({ date }: { date: string }) {
  return <time dateTime={date}>{dateFormatter.format(new Date(date))} UTC</time>
}

export function StatusBadge({ status }: { status: ListingStatus | ResponseStatus }) {
  return <span className={cn('social-chip', {
    'bg-emerald-50 text-emerald-800': status === 'Open' || status === 'Accepted',
    'bg-amber-50 text-amber-900': status === 'Pending',
    'bg-slate-100 text-slate-700': status === 'Closed' || status === 'Rejected',
  })}>{statuses[status] ?? status}</span>
}

export function ListingFacts({ listing, refreshing }: {
  listing: ListingCardResponse | ListingResponse; refreshing?: boolean
}) {
  return <>
    <div className="flex flex-wrap gap-2">
      <StatusBadge status={listing.status} />
      <span className="social-chip">{goalLabel(listing.category)}</span>
      <span className="social-chip">{formatLabels[listing.format]}</span>
    </div>
    <ul className="space-y-2 text-sm text-secondary-ink">
      <li className="flex items-center gap-2">
        <Users size={16} className="shrink-0" aria-hidden="true" />
        {refreshing ? <span role="status">Обновляем число участников…</span>
          : <span>Принято {listing.acceptedParticipantsCount} из {listing.requiredParticipantsCount}</span>}
      </li>
      {listing.deadlineUtc && <li className="flex items-start gap-2">
        <CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Дедлайн · <DateStamp date={listing.deadlineUtc} /></span>
      </li>}
      {listing.eventAtUtc && <li className="flex items-start gap-2">
        <CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Мероприятие · <DateStamp date={listing.eventAtUtc} /></span>
      </li>}
    </ul>
  </>
}

export function ListingAuthor({ author }: { author: ListingResponse['author'] }) {
  return <Link to={`/users/${author.userId}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline">
    <UserAvatar name={profileName(author)} photoUrl={author.photoUrl} className="size-8" />
    <span className="wrap-anywhere">{profileName(author)}</span>
  </Link>
}

export function ListingCard({ listing }: { listing: ListingCardResponse }) {
  return <article className="social-card flex flex-col gap-4 shadow-sm">
    <h2 className="text-lg font-bold wrap-anywhere">
      <Link className="hover:text-primary hover:underline" to={`/listings/${listing.id}`}>{listing.title}</Link>
    </h2>
    <p className="line-clamp-3 text-sm text-secondary-ink wrap-anywhere">{listing.descriptionPreview}</p>
    <ListingFacts listing={listing} />
    <div className="mt-auto border-t border-border pt-3"><ListingAuthor author={listing.author} /></div>
  </article>
}

export function ListingsNavigation() {
  return <nav aria-label="Объявления и отклики" className="flex flex-wrap gap-2">
    <Button asChild><Link to="/listings/new">Создать объявление</Link></Button>
    <Button variant="outline" asChild><Link to="/listings/my">Мои объявления</Link></Button>
    <Button variant="outline" asChild><Link to="/responses/my">Мои отклики</Link></Button>
  </nav>
}

export function ListingUnavailable({ forbidden, closed }: { forbidden?: boolean; closed?: boolean }) {
  return <EmptyState icon={<ClipboardList />} title={forbidden || closed ? 'Редактирование недоступно' : 'Объявление недоступно'}
    description={forbidden ? 'Редактировать объявление может его автор.' : closed ? 'Объявление закрыто.' : 'Оно могло быть закрыто, удалено или устареть.'}
    action={<Button asChild variant="outline"><Link to="/listings">К объявлениям</Link></Button>} />
}

export function ListingField({ name, label, error, children }: {
  name: string; label: string; error?: string; children: ReactNode
}) {
  return <div className="form-field">
    <label className="text-sm font-semibold" htmlFor={name}>{label}</label>
    {children}
    {error && <p id={`${name}-error`} className="field-error">{error}</p>}
  </div>
}

export const selectClass = 'min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-primary'
export const textareaClass = 'w-full rounded-xl border border-border bg-white p-3 text-base focus-visible:outline-2 focus-visible:outline-primary'
