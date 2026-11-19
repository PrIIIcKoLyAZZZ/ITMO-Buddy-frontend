import { queryOptions, useQueryClient } from '@tanstack/react-query'
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

const photoRefreshCooldown = 5 * 60_000

export function useProfilePhotoRefresh(userId?: string) {
  const client = useQueryClient()
  return (failedUrl: string) => {
    const profile = userId ? publicProfile(userId) : myProfile
    const current = client.getQueryCache().find({ queryKey: profile.queryKey, exact: true })
    if (client.getQueryData<ProfileResponse>(profile.queryKey)?.photoUrl !== failedUrl) return

    const path = userId ? `/api/profiles/${userId}` : '/api/profiles/me'
    const key = ['profile-photo-refresh', ...profile.queryKey]
    const refreshedAt = client.getQueryState(key)?.dataUpdatedAt ?? 0
    if (Date.now() - refreshedAt < photoRefreshCooldown || client.isFetching({ queryKey: key, exact: true })) return

    // Keep the failed attempt in cache too, so a bad photo cannot trigger a request on every mount.
    void client.fetchQuery({
      queryKey: key,
      staleTime: photoRefreshCooldown,
      gcTime: photoRefreshCooldown,
      retry: false,
      queryFn: async ({ signal }) => {
        try {
          const { photoUrl } = await api<ProfileResponse>(path, { signal })
          if (current === client.getQueryCache().find({ queryKey: profile.queryKey, exact: true })) {
            client.setQueryData<ProfileResponse>(profile.queryKey, previous =>
              previous?.photoUrl === failedUrl ? { ...previous, photoUrl } : previous)
          }
        } catch {
          // The avatar keeps its fallback while the profile remains available.
        }
        return true
      },
    }).catch(() => undefined)
  }
}
