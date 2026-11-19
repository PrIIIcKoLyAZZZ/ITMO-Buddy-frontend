import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { PagedResult } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { api } from '@/auth/session'
import type { ListingCardResponse, ListingResponse, ListingResponseDto, SearchListingsRequest } from './contracts'

const pageSize = 20
const feedKey = ['listings', 'feed'] as const
const mineKey = ['listings', 'mine'] as const
const myResponsesKey = ['responses', 'mine'] as const
export const listingResponsesKey = (id: string) => ['responses', 'listing', id] as const
export const listingActionKey = (id: string) => ['listing-action', id] as const
export const listingPath = (id: string) => `/api/listings/${id}`

export function listingFeed(filters: Omit<SearchListingsRequest, 'PageSize'>, enabled: boolean) {
  const query: SearchListingsRequest = { ...filters, PageSize: pageSize }
  return queryOptions({
    queryKey: [...feedKey, query],
    queryFn: ({ signal }) => api<PagedResult<ListingCardResponse>>('/api/listings', { query: { ...query }, signal }),
    enabled,
    staleTime: 0,
  })
}

export function myListings(page: number) {
  return queryOptions({
    queryKey: [...mineKey, page],
    queryFn: ({ signal }) => api<PagedResult<ListingCardResponse>>('/api/listings/my', {
      query: { Page: page, PageSize: pageSize }, signal,
    }),
    staleTime: 0,
  })
}

export function listingDetail(id: string) {
  return queryOptions({
    queryKey: ['listings', 'detail', id],
    queryFn: ({ signal }) => api<ListingResponse>(listingPath(id), { signal }),
    staleTime: 0,
  })
}

export function listingResponses(id: string, page: number) {
  return queryOptions({
    queryKey: [...listingResponsesKey(id), page],
    queryFn: ({ signal }) => api<PagedResult<ListingResponseDto>>(`${listingPath(id)}/responses`, {
      query: { Page: page, PageSize: pageSize }, signal,
    }),
    staleTime: 0,
  })
}

export function myResponses(page: number) {
  return queryOptions({
    queryKey: [...myResponsesKey, page],
    queryFn: ({ signal }) => api<PagedResult<ListingResponseDto>>('/api/responses/my', {
      query: { Page: page, PageSize: pageSize }, signal,
    }),
    staleTime: 0,
  })
}

export async function refreshListings(client: QueryClient, id: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: feedKey }),
    client.invalidateQueries({ queryKey: mineKey }),
    client.invalidateQueries({ queryKey: listingDetail(id).queryKey }),
    client.invalidateQueries({ queryKey: listingResponsesKey(id) }),
    client.invalidateQueries({ queryKey: myResponsesKey }),
  ])
}

const errorMessages: Record<string, string> = {
  'listing.participants.full': 'Свободных мест больше нет.',
  'listing.response.duplicate': 'Ты уже отправил отклик на это объявление.',
  'listing_response.already_decided': 'Этот отклик уже обработан.',
  'listing.closed': 'Объявление закрыто.',
  'listing.response.window_closed': 'Срок приёма откликов закончился.',
  'listing.participants.below_accepted': 'Количество мест меньше числа уже принятых участников.',
  'persistence.concurrent_change': 'Данные изменились, пока выполнялось действие. Проверь обновлённое состояние.',
  'persistence.serialization_conflict': 'Данные изменились, пока выполнялось действие. Проверь обновлённое состояние.',
  'listing.response.candidate_unavailable': 'Кандидат недоступен.',
  'listing.owner_required': 'Это действие доступно автору объявления.',
  'listing.skill_not_found': 'Один из выбранных навыков больше недоступен.',
}

export function listingError(error: Error) {
  return error instanceof ApiError ? errorMessages[error.payload?.code ?? ''] ?? error.payload?.message ?? error.message : error.message
}

interface ConversationListItem {
  conversationId: string
  otherParticipant: { userId: string }
}

export function responseConversation(otherUserId: string, enabled: boolean) {
  return queryOptions({
    queryKey: ['conversations', 'participant', otherUserId],
    queryFn: async ({ signal }) => {
      let page = 1
      for (;;) {
        const result = await api<PagedResult<ConversationListItem>>('/api/conversations', {
          query: { Page: page, PageSize: pageSize }, signal,
        })
        const conversation = result.items.find(item => item.otherParticipant.userId === otherUserId)
        if (conversation) return conversation.conversationId
        if (!(result.hasNextPage ?? page * pageSize < result.totalCount)) return null
        page++
      }
    },
    enabled,
    staleTime: 0,
  })
}
