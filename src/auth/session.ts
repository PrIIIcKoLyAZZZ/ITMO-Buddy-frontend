import { useSyncExternalStore } from 'react'
import { ApiError, request, type RequestOptions } from '@/api/http'
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/api/contracts'
import { queryClient } from '@/lib/query'

type SessionState =
  | { status: 'loading' | 'anonymous' | 'signingOut' }
  | { status: 'logoutFailed'; error: Error }
  | { status: 'unavailable'; error: Error }
  | { status: 'authenticated'; session: AuthResponse }

let state: SessionState = { status: 'loading' }
let sessionVersion = 0
let refreshFlight: Promise<AuthResponse> | undefined
let authMutation = false
let deletingAccount = false
const listeners = new Set<() => void>()

function publish(next: SessionState) {
  state = next
  listeners.forEach(listener => listener())
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useSession() {
  return useSyncExternalStore(subscribeSession, () => state)
}

function clearSession(next: SessionState) {
  sessionVersion += 1
  queryClient.clear()
  publish(next)
}

function refreshSession() {
  if (refreshFlight) return refreshFlight
  const version = sessionVersion
  refreshFlight = request<AuthResponse>('/api/auth/refresh', { method: 'POST' })
    .then(session => {
      if (version === sessionVersion) publish({ status: 'authenticated', session })
      return session
    })
    .catch((error: Error) => {
      if (version === sessionVersion) {
        if (error instanceof ApiError && error.status === 401) {
          clearSession({ status: 'anonymous' })
        } else if (state.status === 'loading') {
          publish({ status: 'unavailable', error })
        }
      }
      throw error
    })
    .finally(() => { refreshFlight = undefined })
  return refreshFlight
}

export function restoreSession() {
  if (state.status !== 'loading' && state.status !== 'unavailable') return
  publish({ status: 'loading' })
  return refreshSession().catch(() => undefined)
}

export async function authenticate(
  mode: 'login' | 'register',
  body: LoginRequest | RegisterRequest,
) {
  if (authMutation || state.status !== 'anonymous') throw new Error('Авторизация недоступна.')
  authMutation = true
  try {
    const session = await request<AuthResponse>(`/api/auth/${mode}`, { method: 'POST', body })
    clearSession({ status: 'authenticated', session })
  } finally {
    authMutation = false
  }
}

export async function logout() {
  if (deletingAccount || (state.status !== 'authenticated' && state.status !== 'logoutFailed')) return
  clearSession({ status: 'signingOut' })
  try {
    // Wait for cookie rotation before asking the server to revoke the session.
    await refreshFlight?.catch(() => undefined)
    await request<void>('/api/auth/logout', { method: 'POST' })
    publish({ status: 'anonymous' })
  } catch (error) {
    publish({
      status: 'logoutFailed',
      error: error instanceof Error ? error : new Error('Не удалось завершить сессию.'),
    })
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (state.status !== 'authenticated') throw new ApiError(401, 'Войдите в аккаунт.')
  const initial = state.session
  const version = sessionVersion
  try {
    return await request<T>(path, options, initial.accessToken)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options.signal?.aborted ||
      version !== sessionVersion) throw error
    if (state.session === initial) await refreshSession()
    if (version !== sessionVersion || state.status !== 'authenticated') throw error
    options.signal?.throwIfAborted()
    return request<T>(path, options, state.session.accessToken)
  }
}

export function authenticatedUserId() {
  return state.status === 'authenticated' ? state.session.userId : undefined
}

export async function realtimeAccessToken(userId: string) {
  if (state.status !== 'authenticated' || state.session.userId !== userId) throw new Error('Сессия завершена.')
  const version = sessionVersion
  if (refreshFlight || Date.parse(state.session.expiresAtUtc) <= Date.now() + 30_000) await refreshSession()
  if (version !== sessionVersion || state.status !== 'authenticated') throw new Error('Сессия завершена.')
  return state.session.accessToken
}

export async function deleteAccount() {
  if (deletingAccount || state.status !== 'authenticated') throw new Error('Удаление аккаунта недоступно.')
  const version = sessionVersion
  deletingAccount = true
  try {
    await api<void>('/api/users/me', { method: 'DELETE' })
    if (version === sessionVersion) clearSession({ status: 'anonymous' })
  } finally {
    deletingAccount = false
  }
}
