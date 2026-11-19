import { HubConnectionBuilder, HubConnectionState, HttpTransportType, LogLevel } from '@microsoft/signalr'
import { toast } from 'sonner'
import { apiOrigin } from '@/api/http'
import type { MatchResponse, MessageResponse } from '@/api/contracts'
import { authenticatedUserId, realtimeAccessToken, subscribeSession } from '@/auth/session'
import { conversationsKey, historyKey, mergeMessage } from '@/chat/queries'
import { recommendationsKey, searchKey } from '@/discovery/queries'
import type { ListingResponseDto } from '@/listings/contracts'
import { refreshListings } from '@/listings/queries'
import { queryClient } from '@/lib/query'
import { notificationsKey, rememberNotificationTarget, updateUnreadCount } from '@/notifications/queries'

import { setConnected } from './status'

export function startRealtime(navigate: (path: string) => void) {
  let userId: string | undefined
  let disconnect: (() => Promise<void>) | undefined
  let transition = Promise.resolve()
  let disposed = false

  function syncSession() {
    const next = disposed ? undefined : authenticatedUserId()
    if (next === userId) return
    userId = next
    setConnected(false)
    const stop = disconnect?.()
    disconnect = undefined
    transition = transition.then(async () => {
      await stop
      if (!next || next !== userId || disposed) return
      disconnect = connect(next, navigate)
    }).catch(() => undefined)
  }

  const unsubscribe = subscribeSession(syncSession)
  syncSession()
  return () => {
    disposed = true
    unsubscribe()
    syncSession()
  }
}

function connect(userId: string, navigate: (path: string) => void) {
  const connection = new HubConnectionBuilder()
    .withUrl(new URL('/hubs/chat', apiOrigin).href, {
      // The browser can send the JWT in a header with Long Polling.
      transport: HttpTransportType.LongPolling,
      accessTokenFactory: () => realtimeAccessToken(userId),
    })
    .configureLogging(LogLevel.None)
    .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
    .build()

  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  const isActive = () => !stopped && authenticatedUserId() === userId

  function synchronize() {
    if (!isActive()) return
    attempts = 0
    setConnected(true)
    for (const queryKey of [conversationsKey, historyKey, notificationsKey, ['listings'], ['responses'], recommendationsKey]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  function scheduleRetry() {
    if (!isActive() || retry !== undefined) return
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(attempts++, 4))
    retry = setTimeout(() => {
      retry = undefined
      void start()
    }, delay)
  }

  async function start() {
    if (!isActive() || connection.state !== HubConnectionState.Disconnected) return
    try {
      await connection.start()
      synchronize()
    } catch {
      scheduleRetry()
    }
  }

  const message = (payload: MessageResponse) => {
    if (!isActive()) return
    mergeMessage(queryClient, payload)
    rememberNotificationTarget(queryClient, payload.id, `/messages/${payload.conversationId}`)
    void queryClient.invalidateQueries({ queryKey: [...historyKey, payload.conversationId] })
    void queryClient.invalidateQueries({ queryKey: conversationsKey })
    void queryClient.invalidateQueries({ queryKey: notificationsKey })
  }
  const match = (payload: MatchResponse) => {
    if (!isActive()) return
    const conversationId = payload.conversationId
    if (conversationId && conversationId !== '00000000-0000-0000-0000-000000000000') {
      rememberNotificationTarget(queryClient, payload.matchId, `/messages/${conversationId}`)
    }
    toast.success('У вас взаимный мэтч!', {
      id: `match-${payload.matchId}`,
      action: conversationId && conversationId !== '00000000-0000-0000-0000-000000000000'
        ? { label: 'К переписке', onClick: () => { if (isActive()) navigate(`/messages/${conversationId}`) } }
        : undefined,
    })
    for (const queryKey of [conversationsKey, recommendationsKey, searchKey, ['profile', 'user', payload.otherUser.userId]]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
  const responseCreated = (response: ListingResponseDto) => {
    if (!isActive()) return
    void refreshListings(queryClient, response.listingId)
    rememberNotificationTarget(queryClient, response.id, `/listings/${response.listingId}`)
    toast.info('На твоё объявление откликнулись', {
      id: `listing-response-${response.id}`,
      action: { label: 'К объявлению', onClick: () => { if (isActive()) navigate(`/listings/${response.listingId}`) } },
    })
  }
  const responseReviewed = (response: ListingResponseDto) => {
    if (!isActive()) return
    void refreshListings(queryClient, response.listingId)
    void queryClient.invalidateQueries({ queryKey: conversationsKey })
  }
  const unread = (count: number) => {
    if (isActive()) updateUnreadCount(queryClient, count)
  }

  connection.on('MessageReceived', message)
  connection.on('MatchCreated', match)
  connection.on('ListingResponseCreated', responseCreated)
  connection.on('ListingResponseReviewed', responseReviewed)
  connection.on('NotificationUnreadCountChanged', unread)
  connection.onreconnecting(() => { if (isActive()) setConnected(false) })
  connection.onreconnected(synchronize)
  connection.onclose(() => {
    if (!isActive()) return
    setConnected(false)
    scheduleRetry()
  })
  void start()

  return async () => {
    stopped = true
    clearTimeout(retry)
    connection.off('MessageReceived', message)
    connection.off('MatchCreated', match)
    connection.off('ListingResponseCreated', responseCreated)
    connection.off('ListingResponseReviewed', responseReviewed)
    connection.off('NotificationUnreadCountChanged', unread)
    await connection.stop().catch(() => undefined)
  }
}
