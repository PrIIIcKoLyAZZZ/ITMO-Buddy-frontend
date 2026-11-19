import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { ProfileResponse, UpdateProfileRequest } from '@/api/contracts'
import { api, deleteAccount, logout, useSession } from '@/auth/session'
import { ConfirmDialog, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { DateStamp } from '@/listings/ui'
import { myProfile } from '@/profile/queries'

export default function SettingsPage() {
  const session = useSession()
  const client = useQueryClient()
  const profile = useQuery(myProfile)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const visibilityKey = ['profile', 'visibility'] as const
  const deleteKey = ['account', 'delete'] as const
  const visibility = useMutation({
    mutationKey: visibilityKey,
    mutationFn: async (isVisible: boolean) => {
      const current = await api<ProfileResponse>('/api/profiles/me')
      const body: UpdateProfileRequest = {
        firstName: current.firstName, lastName: current.lastName, facultyId: current.faculty?.id ?? null,
        course: current.course, aboutMe: current.aboutMe, contact: current.contact, goals: current.goals,
        interestIds: current.interests.map(item => item.id), skillIds: current.skills.map(item => item.id), isVisible,
      }
      return api<ProfileResponse>('/api/profiles/me', { method: 'PUT', body })
    },
    onSuccess: async saved => {
      await Promise.all([
        client.invalidateQueries({ queryKey: myProfile.queryKey }),
        client.invalidateQueries({ queryKey: ['profile', 'user', saved.userId] }),
        client.invalidateQueries({ queryKey: ['search'] }),
        client.invalidateQueries({ queryKey: ['recommendations'] }),
      ])
      toast.success(saved.isVisible ? 'Профиль виден студентам' : 'Профиль скрыт')
    },
  })
  const deletion = useMutation({
    mutationKey: deleteKey,
    mutationFn: deleteAccount,
    onSuccess: () => { toast.success('Аккаунт удалён') },
  })

  return <div className="max-w-3xl space-y-5">
    <h1 className="page-title">Настройки</h1>
    <section className="social-card space-y-4">
      <h2 className="text-lg font-bold">Профиль</h2>
      <Button variant="outline" asChild><Link to="/profile/edit"><Pencil size={16} /> Редактировать профиль</Link></Button>
      {profile.isPending ? <LoadingSkeleton label="Проверяем видимость профиля" />
        : profile.isError ? <ErrorState error={profile.error} retry={() => void profile.refetch()} />
        : <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={profile.data.isVisible}
            disabled={visibility.isPending || deletion.isPending} onChange={event => {
              if (client.isMutating({ mutationKey: visibilityKey }) || client.isMutating({ mutationKey: deleteKey })) return
              visibility.mutate(event.target.checked)
            }} />
          <span><span className="block font-semibold">Показывать профиль другим студентам</span>
            {visibility.isPending ? 'Сохраняем…' : profile.data.isVisible ? 'Профиль виден в поиске и рекомендациях.' : 'Публичная анкета скрыта.'}
          </span>
        </label>}
      {visibility.error && <p className="form-error" role="alert">{visibility.error.message}</p>}
    </section>
    <section className="social-card space-y-3">
      <h2 className="text-lg font-bold">Текущая сессия</h2>
      {session.status === 'authenticated' && <p className="text-sm text-secondary-ink">
        Ты вошёл в аккаунт. Токен действует до <DateStamp date={session.session.expiresAtUtc} /> и обновляется автоматически.
      </p>}
      <ConfirmDialog trigger={<Button variant="outline" disabled={deletion.isPending || visibility.isPending}><LogOut size={17} /> Выйти</Button>}
        title="Выйти из аккаунта?" description="Для доступа к личным разделам потребуется снова войти."
        confirmLabel="Выйти" onConfirm={() => { void logout() }} />
    </section>
    <section className="social-card space-y-3 border-destructive/30">
      <h2 className="text-lg font-bold">Удаление аккаунта</h2>
      <p className="text-sm text-secondary-ink">Ты потеряешь доступ к аккаунту, профилю и перепискам. Удаление нельзя отменить.</p>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} destructive
        trigger={<Button variant="destructive" disabled={deletion.isPending || visibility.isPending}>
          <Trash2 size={17} /> {deletion.isPending ? 'Удаляем…' : 'Удалить аккаунт'}
        </Button>}
        title="Удалить аккаунт без возможности восстановления?"
        description="После подтверждения сервер удалит аккаунт и завершит сессию. Вернуть доступ к аккаунту не получится."
        confirmLabel="Удалить аккаунт" onConfirm={() => {
          if (client.isMutating({ mutationKey: deleteKey })) return
          setConfirmDelete(false)
          deletion.mutate()
        }} />
      {deletion.error && <p role="alert" className="form-error">{deletion.error.message}</p>}
    </section>
  </div>
}
