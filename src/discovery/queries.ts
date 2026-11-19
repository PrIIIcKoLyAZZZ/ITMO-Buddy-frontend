import { queryOptions } from '@tanstack/react-query'
import type { GoalCategory, PagedResult, ProfileCardResponse, RecommendationResponse } from '@/api/contracts'
import { api } from '@/auth/session'

export const searchKey = ['search', 'users'] as const
export const recommendationsKey = ['recommendations'] as const
export const maxFilterItems = 100
const pageSize = 20
export const maxPage = Math.floor(2_147_483_647 / pageSize)

export function searchUsers(query: {
  SearchText?: string
  GoalCategories: GoalCategory[]
  InterestIds: string[]
  SkillIds: string[]
  FacultyIds: string[]
  Courses: number[]
  Page: number
}, enabled: boolean) {
  return queryOptions({
    queryKey: [...searchKey, query],
    queryFn: ({ signal }) => api<PagedResult<ProfileCardResponse>>('/api/search/users', {
      signal, query: { ...query, PageSize: pageSize },
    }),
    enabled,
  })
}

export function recommendations(page: number, goal?: GoalCategory) {
  return queryOptions({
    queryKey: [...recommendationsKey, page, goal],
    queryFn: ({ signal }) => api<PagedResult<RecommendationResponse>>('/api/recommendations', {
      signal, query: { GoalCategory: goal, Page: page, PageSize: pageSize },
    }),
  })
}
