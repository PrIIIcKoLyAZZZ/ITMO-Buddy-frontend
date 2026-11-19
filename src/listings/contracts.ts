import type { DictionaryItemResponse, GoalCategory, ProfileCardResponse } from '@/api/contracts'

export const listingCategories = ['Studies', 'Projects', 'Events', 'Interests'] as const
export const listingFormats = ['Online', 'Offline'] as const
export type ListingFormat = typeof listingFormats[number]
export type ListingStatus = 'Open' | 'Closed'
export type ResponseStatus = 'Pending' | 'Accepted' | 'Rejected'
export type ResponseDecision = 'Accept' | 'Reject'

type ListingAuthor = Pick<ProfileCardResponse, 'userId' | 'firstName' | 'lastName' | 'photoUrl'>

interface ListingSummary {
  id: string
  author: ListingAuthor
  title: string
  category: GoalCategory
  format: ListingFormat
  requiredParticipantsCount: number
  acceptedParticipantsCount: number
  deadlineUtc: string | null
  eventAtUtc: string | null
  status: ListingStatus
  createdAtUtc: string
}

export interface ListingCardResponse extends ListingSummary {
  descriptionPreview: string
}

export interface ListingResponse extends ListingSummary {
  description: string
  requiredSkills: DictionaryItemResponse[]
  updatedAtUtc: string
}

export interface SearchListingsRequest {
  SearchText?: string
  Category?: GoalCategory
  SkillIds?: string[]
  Format?: ListingFormat
  Page: number
  PageSize: number
}

// Both write contracts require the same complete set of fields.
export interface UpdateListingRequest {
  title: string
  description: string
  category: GoalCategory
  requiredSkillIds: string[]
  requiredParticipantsCount: number
  format: ListingFormat
  deadlineUtc: string | null
  eventAtUtc: string | null
}
export type CreateListingRequest = UpdateListingRequest

export interface ListingResponseDto {
  id: string
  listingId: string
  candidate: ProfileCardResponse
  message: string | null
  status: ResponseStatus
  createdAtUtc: string
  decidedAtUtc: string | null
}

export const listingLimits = { title: 100, description: 2000, minParticipants: 1, maxParticipants: 10, skills: 100 }
export const responseMessageLimit = 500

export function isNonEmptyGuid(id: string | undefined): id is string {
  return !!id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) &&
    id !== '00000000-0000-0000-0000-000000000000'
}
