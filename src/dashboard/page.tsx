import { useQuery } from '@tanstack/react-query'
import { Bell, ClipboardList, Compass, MessageCircle, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingSkeleton, UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { recommendations } from '@/discovery/queries'
import { StudentCard } from '@/discovery/ui'
import { listingFeed } from '@/listings/queries'
import { ListingCard } from '@/listings/ui'
import { notifications } from '@/notifications/queries'
import { myProfile } from '@/profile/queries'
import { profileName } from '@/profile/ui'

export default function DashboardPage() {
  const profile = useQuery(myProfile)
  const suggestions = useQuery(recommendations(1))
  const listings = useQuery(listingFeed({ Page: 1 }, true))
  const unread = useQuery(notifications(1))

  return <div className="space-y-7">
    <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-3xl bg-[#101e62] p-6 text-white sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight wrap-anywhere sm:text-4xl">
          {profile.data?.firstName ? `Привет, ${profile.data.firstName}!` : 'Главная'}
        </h1>
        <p className="mt-3 max-w-md text-[#dbe3ff]">Найди команду, присоединяйся к проектам и продолжай общение со студентами ИТМО.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild className="bg-[#a9ff84] text-foreground hover:bg-[#c5ffa9]"><Link to="/search"><Compass size={17} /> Найти студентов</Link></Button>
          <Button asChild variant="outline"><Link to="/listings/new"><Plus size={17} /> Создать объявление</Link></Button>
        </div>
      </div>
      <section aria-label="Мой профиль">
        {profile.isPending ? <LoadingSkeleton label="Загружаем профиль" />
          : profile.isError ? <ErrorState error={profile.error} retry={() => void profile.refetch()} />
          : <div className="social-card h-full space-y-4">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={profileName(profile.data)} photoUrl={profile.data.photoUrl} />
              <div className="min-w-0">
                <Link className="font-bold wrap-anywhere hover:underline" to="/profile">{profileName(profile.data)}</Link>
                <p className="text-sm text-secondary-ink wrap-anywhere">
                  {[profile.data.faculty?.name, profile.data.course && `${profile.data.course} курс`].filter(Boolean).join(' · ') || 'Учебные данные не указаны'}
                </p>
              </div>
            </div>
            <p className="social-chip">{profile.data.isComplete ? 'Анкета заполнена' : 'Анкета заполнена не полностью'}</p>
            <div><Button asChild variant="outline"><Link to="/profile/edit">Редактировать анкету</Link></Button></div>
          </div>}
      </section>
    </section>

    <div className="grid gap-3 sm:grid-cols-2">
      <Button asChild variant="outline" className="justify-start bg-white"><Link to="/messages"><MessageCircle size={19} /> Сообщения</Link></Button>
      <div>
        <Button asChild variant="outline" className="w-full justify-start bg-white"><Link to="/notifications">
          <Bell size={19} /> Уведомления {unread.data ? `· ${unread.data.unreadCount} новых` : ''}
        </Link></Button>
        {unread.isPending && <p role="status" className="mt-1 text-sm text-secondary-ink">Проверяем уведомления…</p>}
        {unread.isError && <button className="mt-1 text-sm text-primary underline" onClick={() => void unread.refetch()}>Повторить загрузку счётчика</button>}
      </div>
    </div>

    <section aria-labelledby="dashboard-recommendations" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-recommendations" className="text-xl font-extrabold">Рекомендации</h2>
        <Button asChild variant="outline"><Link to="/recommendations">Все рекомендации</Link></Button>
      </div>
      {suggestions.isPending ? <LoadingSkeleton label="Загружаем рекомендации" />
        : suggestions.isError ? <ErrorState error={suggestions.error} retry={() => void suggestions.refetch()} />
        : suggestions.data.items.length ? <div className="social-grid">
          {suggestions.data.items.slice(0, 3).map(item => <StudentCard key={item.user.userId} user={item.user}
            badge={<span className="social-chip">{new Intl.NumberFormat('ru', { style: 'percent', maximumFractionDigits: 1 }).format(item.score)}</span>} />)}
        </div> : <EmptyState icon={<Sparkles />} title="Рекомендаций пока нет" description="Подбери команду через поиск студентов." />}
    </section>

    <section aria-labelledby="dashboard-listings" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-listings" className="text-xl font-extrabold">Последние объявления</h2>
        <Button asChild variant="outline"><Link to="/listings">Все объявления</Link></Button>
      </div>
      {listings.isPending ? <LoadingSkeleton label="Загружаем объявления" />
        : listings.isError ? <ErrorState error={listings.error} retry={() => void listings.refetch()} />
        : listings.data.items.length ? <div className="social-grid">
          {listings.data.items.slice(0, 3).map(listing => <ListingCard key={listing.id} listing={listing} />)}
        </div> : <EmptyState icon={<ClipboardList />} title="Открытых объявлений пока нет" description="Создай объявление, чтобы собрать команду." />}
    </section>
  </div>
}
