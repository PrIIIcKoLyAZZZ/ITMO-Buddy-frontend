import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { NotificationsPageResponse } from '@/api/contracts'
import { api } from '@/auth/session'

export const notificationsKey = ['notifications'] as const

export function notifications(page: number) {
  return queryOptions({
    queryKey: [...notificationsKey, page],
    queryFn: ({ signal }) => api<NotificationsPageResponse>('/api/notifications', {
      signal, query: { Page: page, PageSize: 20 },
    }),
  })
}

export function updateUnreadCount(client: QueryClient, unreadCount: number) {
  client.setQueriesData<NotificationsPageResponse>({ queryKey: notificationsKey }, current =>
    current ? { ...current, unreadCount } : current)
  void client.invalidateQueries({ queryKey: notificationsKey })
}

const targetsKey = ['notification-targets'] as const

export const notificationTargets = queryOptions({
  queryKey: targetsKey,
  queryFn: (): Record<string, string> => ({}),
  enabled: false,
  gcTime: Infinity,
})

export function rememberNotificationTarget(client: QueryClient, relatedEntityId: string, path: string) {
  client.setQueryData(notificationTargets.queryKey, known => {
    const entries = Object.entries(known ?? {}).filter(([id]) => id !== relatedEntityId)
    return Object.fromEntries([...entries.slice(-499), [relatedEntityId, path]])
  })
}
