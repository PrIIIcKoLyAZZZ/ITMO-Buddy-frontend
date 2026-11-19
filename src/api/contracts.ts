// Wire contracts from Backend commit 6c8997b74ae2394797eb0fc1493ad2f22bd5d554.
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  consentToPersonalDataProcessing: boolean
}

export interface AuthResponse {
  userId: string
  accessToken: string
  expiresAtUtc: string
}

export interface ValidationError {
  field: string
  messages: string[]
}

export interface ErrorResponse {
  code: string
  message: string
  category: string
  details?: string | null
  validationErrors?: ValidationError[]
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  hasNextPage: boolean
}

export interface DictionaryItemResponse {
  id: string
  name: string
}

export interface ProfileCardResponse {
  userId: string
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  course: number | null
  faculty: DictionaryItemResponse | null
  goals: string[]
  interests: DictionaryItemResponse[]
}

export interface ProfileResponse extends ProfileCardResponse {
  id: string
  aboutMe: string | null
  contact: string | null
  skills: DictionaryItemResponse[]
  isVisible: boolean
  isComplete: boolean
}

export interface RecommendationResponse {
  user: ProfileCardResponse
  score: number
  reasons: { code: string; description: string }[]
}

export type GoalCategory = 'Studies' | 'Projects' | 'Events' | 'Interests'

export interface UpdateProfileRequest {
  firstName: string | null
  lastName: string | null
  facultyId: string | null
  course: number | null
  aboutMe: string | null
  contact: string | null
  goals: string[]
  interestIds: string[]
  skillIds: string[]
  isVisible: boolean
}

export interface UploadPhotoResponse {
  photoUrl: string
}

export interface LikeResponse {
  targetUserId: string
  isLiked: boolean
  isMatch: boolean
  match?: {
    matchId: string
    otherUser: Pick<ProfileCardResponse, 'userId' | 'firstName' | 'lastName' | 'photoUrl'>
    createdAtUtc: string
    conversationId: string | null
  } | null
}
