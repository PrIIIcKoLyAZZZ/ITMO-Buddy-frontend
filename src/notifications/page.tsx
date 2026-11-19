import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/auth/session'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/discovery/ui'
import { DateStamp } from '@/listings/ui'
import { useRealtimeConnected } from '@/realtime/status'
import { notifications, notificationsKey, notificationTargets } from './queries'

const notificationTypes: Record<string, { label: string; path: string; action: string }> = {
  MatchCreated: { label: 'Новый взаимный мэтч', path: '/messages', action: 'К сообщениям' },
  MessageReceived: { label: 'Новое сообщение', path: '/messages', action: 'К сообщениям' },
  ListingResponseCreated: { label: 'Новый отклик на твоё объявление', path: '/listings/my', action: 'К моим объявлениям' },
  ListingResponseAccepted: { label: 'Твой отклик принят', path: '/responses/my', action: 'К моим откликам' },
  ListingResponseRejected: { label: 'Твой отклик отклонён', path: '/responses/my', action: 'К моим откликам' },
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const connected = useRealtimeConnected()
  const feed = useQuery({ ...notifications(page), refetchInterval: connected ? false : 20_000 })
  const targets = useQuery(notificationTargets).data
  const mark = useMutation({
    mutationKey: [...notificationsKey, 'read'],
    mutationFn: (id: string | null) => api<void>('/api/notifications/read', {
      method: 'POST', body: { markAll: id === null, notificationIds: id === null ? null : [id] },
    }),
    onSuccess: async (_, id) => {
      await client.invalidateQueries({ queryKey: notificationsKey })
      toast.success(id === null ? 'Все уведомления прочитаны' : 'Уведомление прочитано')
    },
  })
  function markRead(id: string | null) {
    if (client.isMutating({ mutationKey: [...notificationsKey, 'read'] })) return
    mark.mutate(id)
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="page-title mb-0">Уведомления</h1>
      <Button variant="outline" disabled={mark.isPending || !feed.data?.unreadCount} onClick={() => markRead(null)}>
        <CheckCheck size={17} aria-hidden="true" /> {mark.isPending && mark.variables === null ? 'Отмечаем…' : 'Прочитать все'}
      </Button>
    </div>
    {mark.error && <p role="alert" className="form-error">{mark.error.message}</p>}
    {feed.isPending ? <LoadingSkeleton label="Загружаем уведомления" />
      : feed.isError ? <ErrorState error={feed.error} retry={() => void feed.refetch()} />
      : <>
        <p className="text-sm text-secondary-ink">Непрочитанных: {feed.data.unreadCount}</p>
        {feed.data.notifications.items.length ? <ul className="grid gap-3">{feed.data.notifications.items.map(item => {
          const type = notificationTypes[item.type]
          return <li key={item.id} className={`social-card flex flex-wrap items-center justify-between gap-3 ${item.isRead ? '' : 'border-primary/30 bg-blue-50/50'}`}>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{type?.label ?? 'Уведомление'}</p>
              <p className="text-sm text-secondary-ink"><DateStamp date={item.createdAtUtc} /> · {item.isRead ? 'Прочитано' : 'Новое'}</p>
              {type && <Link to={targets?.[item.relatedEntityId] ?? type.path} className="text-sm font-semibold text-primary hover:underline">{type.action}</Link>}
            </div>
            {!item.isRead && <Button variant="outline" disabled={mark.isPending} onClick={() => markRead(item.id)}>
              <Check size={16} aria-hidden="true" /> {mark.isPending && mark.variables === item.id ? 'Отмечаем…' : 'Отметить прочитанным'}
            </Button>}
          </li>
        })}</ul> : <EmptyState icon={<Bell />} title="Уведомлений пока нет" description="Здесь появятся сообщения, мэтчи и новости об откликах." />}
        <Pagination result={feed.data.notifications} onPage={setPage} />
      </>}
  </div>
}
