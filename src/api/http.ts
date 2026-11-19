import type { ErrorResponse } from './contracts'

const origin = new URL(import.meta.env.VITE_API_ORIGIN || 'https://localhost:8443')
if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/') {
  throw new Error('VITE_API_ORIGIN должен содержать HTTPS origin.')
}

export const apiOrigin = origin.origin

type QueryValue = string | number | boolean
type Query = Record<string, QueryValue | readonly QueryValue[] | null | undefined>

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload?: Partial<ErrorResponse>,
    readonly retryAfter?: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const statusMessages: Record<number, string> = {
  400: 'Проверьте введённые данные.',
  401: 'Не удалось подтвердить авторизацию.',
  403: 'Сервер отказал в доступе.',
  404: 'Запрошенные данные не найдены.',
  409: 'Данные конфликтуют с текущим состоянием на сервере.',
  429: 'Слишком много запросов. Попробуйте немного позже.',
  500: 'На сервере произошла ошибка. Попробуйте позже.',
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  body?: object | FormData
  query?: Query
}

export async function request<T>(path: string, options: RequestOptions = {}, token?: string): Promise<T> {
  const url = new URL(path, origin)
  if (url.origin !== origin.origin) throw new Error('Недопустимый адрес API.')

  const { query, body, ...init } = options
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(item))
    }
  }

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  const multipart = body instanceof FormData
  if (body && !multipart) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
      redirect: 'error',
      body: multipart ? body : body && JSON.stringify(body),
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(0, 'Не удалось подключиться к серверу. Попробуйте ещё раз.')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as Partial<ErrorResponse> | undefined
    throw new ApiError(
      response.status,
      statusMessages[response.status] ?? 'Не удалось выполнить запрос.',
      payload,
      response.headers.get('Retry-After'),
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
