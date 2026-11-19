import { useQuery } from '@tanstack/react-query'
import { EyeOff, Pencil, UserRound } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api/http'
import type { ProfileResponse } from '@/api/contracts'
import { useSession } from '@/auth/session'
import { EmptyState, ErrorState, LoadingSkeleton, UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { myProfile, publicProfile, useProfilePhotoRefresh } from './queries'
import { SocialActions, useSocialStatus } from '@/social/actions'
import { Chips, goalLabel, profileName } from './ui'

const userIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function ProfileDetails({ profile, own }: { profile: ProfileResponse; own?: boolean }) {
  const name = profileName(profile)
  const refreshPhoto = useProfilePhotoRefresh(own ? undefined : profile.userId)
  const groups = [
    { title: 'Цели', values: profile.goals.map(goalLabel) },
    { title: 'Интересы', values: profile.interests.map(item => item.name) },
    { title: 'Навыки', values: profile.skills.map(item => item.name) },
  ]
  return <div className="space-y-5">
    <h1 className="page-title">{own ? 'Мой профиль' : name}</h1>
    <section className="social-card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={name} photoUrl={profile.photoUrl} onPhotoError={refreshPhoto} />
          <div className="min-w-0">
            {own && <h2 className="text-xl font-bold wrap-anywhere">{name}</h2>}
            <p className="text-sm text-secondary-ink wrap-anywhere">
              {[profile.faculty?.name, profile.course ? `${profile.course} курс` : null].filter(Boolean).join(' · ') || 'Факультет и курс не указаны'}
            </p>
          </div>
        </div>
        {own && <div className="flex flex-wrap gap-2">
          <Button asChild><Link to="/profile/edit"><Pencil size={16} /> Редактировать</Link></Button>
          <Button asChild variant="outline"><Link to="/settings">Настройки</Link></Button>
        </div>}
      </div>
      {!own && <SocialActions userId={profile.userId} />}
      {own && <div className="flex flex-wrap gap-2">
        <span className="social-chip">{profile.isVisible ? 'Виден другим студентам' : 'Профиль скрыт'}</span>
        {!profile.isComplete && <span className="social-chip">Анкета пока заполнена не полностью</span>}
      </div>}
      <div>
        <h2 className="font-bold">О себе</h2>
        <p className="mt-1 whitespace-pre-wrap text-secondary-ink wrap-anywhere">{profile.aboutMe || 'Описание пока не добавлено.'}</p>
      </div>
      {own && profile.contact && <div>
        <h2 className="font-bold">Контакты</h2>
        <p className="mt-1 whitespace-pre-wrap text-secondary-ink wrap-anywhere">{profile.contact}</p>
      </div>}
    </section>
    <div className="social-grid">
      {groups.map(group => <section key={group.title} className="social-card space-y-3">
        <h2 className="font-bold">{group.title}</h2>
        {group.values.length ? <Chips values={group.values} /> : <p className="text-sm text-secondary-ink">Пока не указаны.</p>}
      </section>)}
    </div>
  </div>
}

export function MyProfilePage() {
  const profile = useQuery(myProfile)
  if (profile.isPending) return <LoadingSkeleton label="Загружаем профиль" />
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />
  if (!profile.data.isComplete && !profile.data.firstName && !profile.data.lastName &&
    !profile.data.faculty && !profile.data.course && !profile.data.aboutMe && !profile.data.contact &&
    !profile.data.photoUrl && !profile.data.goals.length && !profile.data.interests.length && !profile.data.skills.length) {
    return <>
      <h1 className="page-title">Мой профиль</h1>
      <EmptyState icon={<UserRound />} title="Анкета пока пуста"
        description={profile.data.isVisible ? 'Профиль доступен другим студентам. Добавь сведения о себе.' : 'Профиль скрыт. Заполни анкету и настрой её видимость.'}
        action={<div className="flex flex-wrap justify-center gap-2">
          <Button asChild><Link to="/profile/edit">Заполнить профиль</Link></Button>
          <Button asChild variant="outline"><Link to="/settings">Настройки</Link></Button>
        </div>} />
    </>
  }
  return <ProfileDetails profile={profile.data} own />
}

function PublicProfile({ userId }: { userId: string }) {
  const profile = useQuery(publicProfile(userId))
  const { data: social } = useSocialStatus(userId)
  if (social?.blocked) {
    return <EmptyState icon={<EyeOff />} title="Пользователь заблокирован"
      description="Разблокируй пользователя, чтобы снова открыть его профиль, если анкета доступна."
      action={<SocialActions userId={userId} onlyUnblock />} />
  }
  if (profile.error instanceof ApiError && profile.error.status === 404) {
    return <EmptyState icon={<EyeOff />} title="Профиль недоступен"
      description="Студент мог скрыть анкету или ссылка устарела." />
  }
  if (profile.isPending) return <LoadingSkeleton label="Загружаем профиль" />
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />
  if (profile.isFetching) return <LoadingSkeleton label="Проверяем доступность профиля" />
  return <ProfileDetails profile={profile.data} />
}

export function PublicProfilePage() {
  const { userId } = useParams()
  const session = useSession()
  if (!userId || !userIdPattern.test(userId)) {
    return <EmptyState icon={<UserRound />} title="Профиль не найден" description="Проверь ссылку на студента."
      action={<Button asChild><Link to="/profile">К моему профилю</Link></Button>} />
  }
  const normalized = userId.toLowerCase()
  if (session.status === 'authenticated' && session.session.userId === normalized) return <Navigate to="/profile" replace />
  return <PublicProfile key={normalized} userId={normalized} />
}
