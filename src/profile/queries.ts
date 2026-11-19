import { queryOptions } from '@tanstack/react-query'
import type {
  DictionaryItemResponse, ProfileResponse,
} from '@/api/contracts'
import { api } from '@/auth/session'

export type Dictionary = 'faculties' | 'interests' | 'skills'

export const myProfile = queryOptions({
  queryKey: ['profile', 'me'],
  queryFn: ({ signal }) => api<ProfileResponse>('/api/profiles/me', { signal }),
})

export function publicProfile(userId: string) {
  return queryOptions({
    queryKey: ['profile', 'user', userId],
    queryFn: ({ signal }) => api<ProfileResponse>(`/api/profiles/${userId}`, { signal }),
    staleTime: 0,
  })
}

export function dictionary(type: Dictionary, searchText = '', enabled = true) {
  return queryOptions({
    queryKey: ['dictionary', type, searchText],
    queryFn: ({ signal }) => api<DictionaryItemResponse[]>(`/api/dictionaries/${type}`, {
      signal, query: type === 'faculties' ? undefined : { searchText: searchText || undefined, limit: 20 },
    }),
    staleTime: 5 * 60_000,
    enabled,
  })
}
