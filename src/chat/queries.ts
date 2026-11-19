import { infiniteQueryOptions, queryOptions, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import type { ConversationResponse, MessageResponse, PagedResult } from '@/api/contracts'
import { api } from '@/auth/session'

const pageSize = 20
export const conversationsKey = ['conversations'] as const
export const historyKey = ['messages', 'history'] as const
export const conversationPath = (id: string) => `/api/conversations/${id}/messages`

function getConversationPage(page: number, signal: AbortSignal) {
  return api<PagedResult<ConversationResponse>>('/api/conversations', {
    signal, query: { Page: page, PageSize: pageSize },
  })
}

function nextPage<T>(result: PagedResult<T>) {
  return (result.hasNextPage ?? result.page * result.pageSize < result.totalCount) ? result.page + 1 : undefined
}

export function conversations(page: number) {
  return queryOptions({
    queryKey: [...conversationsKey, 'page', page],
    queryFn: ({ signal }) => getConversationPage(page, signal),
    staleTime: 0,
  })
}

async function findConversation(matches: (item: ConversationResponse) => boolean, signal: AbortSignal) {
  let page: number | undefined = 1
  while (page !== undefined) {
    const result = await getConversationPage(page, signal)
    const conversation = result.items.find(matches)
    if (conversation) return conversation
    page = nextPage(result)
  }
  return null
}

export function conversationParticipant(otherUserId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...conversationsKey, 'participant', otherUserId],
    queryFn: async ({ signal }) => (await findConversation(item => item.otherParticipant.userId === otherUserId, signal))?.conversationId ?? null,
    enabled,
    staleTime: 0,
  })
}

export function conversationInfo(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...conversationsKey, 'info', id],
    queryFn: ({ signal }) => findConversation(item => item.conversationId === id, signal),
    enabled,
  })
}

export function conversationHistory(id: string) {
  return infiniteQueryOptions({
    queryKey: [...historyKey, id],
    queryFn: ({ signal, pageParam }) => api<PagedResult<MessageResponse>>(conversationPath(id), {
      signal, query: { Page: pageParam, PageSize: pageSize },
    }),
    initialPageParam: 1,
    getNextPageParam: nextPage<MessageResponse>,
    staleTime: 0,
  })
}

export function cachedConversation(client: QueryClient, id: string) {
  return client.getQueriesData<PagedResult<ConversationResponse>>({ queryKey: [...conversationsKey, 'page'] })
    .flatMap(([, page]) => page?.items ?? []).find(item => item.conversationId === id)
}

export function mergeMessage(client: QueryClient, message: MessageResponse) {
  const key = [...historyKey, message.conversationId]
  client.setQueryData<InfiniteData<PagedResult<MessageResponse>>>(key, history => {
    if (!history?.pages.length || history.pages.some(page => page.items.some(item => item.id === message.id))) return history
    const [recent, ...older] = history.pages
    if (!recent) return history
    return { ...history, pages: [{ ...recent, items: [message, ...recent.items] }, ...older] }
  })
}
