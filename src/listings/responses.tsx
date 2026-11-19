import { useState } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessagesSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ApiError } from '@/api/http'
import { api } from '@/auth/session'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Pagination, StudentCard } from '@/discovery/ui'
import { responseMessageLimit, isNonEmptyGuid, type ListingResponseDto, type ResponseDecision } from './contracts'
import { listingActionKey, listingDetail, listingError, listingPath, listingResponses, myResponses, refreshListings, responseConversation } from './queries'
import { DateStamp, ListingField, ListingsNavigation, StatusBadge, textareaClass } from './ui'

function ResponseConversation({ otherUserId }: { otherUserId: string }) {
  const [requested, setRequested] = useState(false)
  const result = useQuery(responseConversation(otherUserId, requested))
  if (requested && !result.isFetching && result.isSuccess && isNonEmptyGuid(result.data ?? undefined)) {
    return <Button asChild variant="outline"><Link to={`/messages/${result.data}`}>К переписке</Link></Button>
  }
  return <div className="space-y-2">
    {requested && result.isSuccess && !result.isFetching && <p className="text-sm text-secondary-ink">Переписка пока недоступна.</p>}
    {requested && result.isError && <p role="alert" className="form-error wrap-anywhere">{listingError(result.error)}</p>}
    <Button variant="outline" disabled={requested && result.isFetching} onClick={() => {
      if (requested) void result.refetch()
      else setRequested(true)
    }}>{!requested ? 'Найти переписку' : result.isFetching ? 'Ищем переписку…' : 'Повторить поиск переписки'}</Button>
  </div>
}

function ResponseMessage({ response }: { response: ListingResponseDto }) {
  return <>
    {response.message ? <p className="whitespace-pre-wrap text-sm wrap-anywhere">{response.message}</p>
      : <p className="text-sm text-secondary-ink">Без сопроводительного сообщения</p>}
    <p className="text-sm text-secondary-ink">Отправлен <DateStamp date={response.createdAtUtc} /></p>
  </>
}

export function RespondForm({ id, canRespond, unavailableReason }: { id: string; canRespond: boolean; unavailableReason: string }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const client = useQueryClient()
  const mutationKey = listingActionKey(id)
  const pending = useIsMutating({ mutationKey, exact: true }) > 0
  const submit = useMutation({
    mutationKey,
    mutationFn: (message: string | null) => api<ListingResponseDto>(`${listingPath(id)}/responses`, {
      method: 'POST', body: { message },
    }),
    onSuccess: async () => {
      setSent(true)
      setText('')
      toast.success('Отклик отправлен')
      await refreshListings(client, id)
    },
    onError: async error => {
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) await refreshListings(client, id)
    },
  })
  const duplicate = submit.error instanceof ApiError && submit.error.payload?.code === 'listing.response.duplicate'
  const invalid = text.trim().length > responseMessageLimit || text.includes('\0')

  return <section className="social-card space-y-3">
    <h2 className="text-lg font-bold">Отклик на объявление</h2>
    {sent || duplicate ? <div className="space-y-2">
      <p role="status">{sent ? 'Отклик отправлен.' : 'Ты уже отправил отклик на это объявление.'}</p>
      <Button asChild variant="outline"><Link to="/responses/my">Мои отклики</Link></Button>
    </div> : <>
      {canRespond ? <form className="space-y-3" onSubmit={event => {
        event.preventDefault()
        if (invalid || client.isMutating({ mutationKey, exact: true })) return
        submit.mutate(text.trim() || null)
      }}>
        <ListingField name="response-message" label="Сообщение автору (необязательно)"
          error={invalid ? 'В сообщении должно быть не более 500 символов без NUL.' : undefined}>
          <textarea id="response-message" className={textareaClass} rows={3} maxLength={responseMessageLimit}
            value={text} disabled={pending} aria-invalid={invalid} aria-describedby={invalid ? 'response-message-error' : undefined}
            onChange={event => setText(event.target.value)} />
        </ListingField>
        <Button disabled={pending || invalid} type="submit">{submit.isPending ? 'Отправляем…' : 'Отправить отклик'}</Button>
      </form> : <p className="text-sm text-secondary-ink">{unavailableReason}</p>}
      {submit.error && <p role="alert" className="form-error wrap-anywhere">{listingError(submit.error)}</p>}
    </>}
  </section>
}

export function AuthorResponses({ id, canAccept, unavailableReason }: { id: string; canAccept: boolean; unavailableReason: string }) {
  const [page, setPage] = useState(1)
  const result = useQuery(listingResponses(id, page))
  const client = useQueryClient()
  const mutationKey = listingActionKey(id)
  const pending = useIsMutating({ mutationKey, exact: true }) > 0
  const review = useMutation({
    mutationKey,
    mutationFn: ({ responseId, decision }: { responseId: string; decision: ResponseDecision }) =>
      api<ListingResponseDto>(`/api/responses/${responseId}`, { method: 'PATCH', body: { decision } }),
    onSuccess: async saved => {
      toast.success(saved.status === 'Accepted' ? 'Отклик принят' : 'Отклик отклонён')
      await refreshListings(client, id)
    },
    onError: async error => {
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) await refreshListings(client, id)
    },
  })

  function decide(responseId: string, decision: ResponseDecision) {
    if (client.isMutating({ mutationKey, exact: true })) return
    review.mutate({ responseId, decision })
  }

  return <section className="space-y-4" aria-labelledby="listing-responses-title">
    <h2 id="listing-responses-title" className="text-xl font-bold">Отклики кандидатов</h2>
    {review.error && <p role="alert" className="form-error wrap-anywhere">{listingError(review.error)}</p>}
    {result.isPending ? <LoadingSkeleton label="Загружаем отклики" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <>
        {result.data.items.length ? <div className="social-grid">
          {result.data.items.map(response => <StudentCard key={response.id} user={response.candidate}
            badge={<StatusBadge status={response.status} />}
            actions={response.status === 'Accepted' ? <ResponseConversation otherUserId={response.candidate.userId} />
              : response.status === 'Pending' && <div className="space-y-2">
              {!canAccept && <p className="text-sm text-secondary-ink">{unavailableReason}</p>}
              <div className="flex flex-wrap gap-2">
                <Button disabled={pending || !canAccept} onClick={() => decide(response.id, 'Accept')}>Принять</Button>
                <Button variant="outline" disabled={pending} onClick={() => decide(response.id, 'Reject')}>Отклонить</Button>
              </div>
              {review.isPending && review.variables?.responseId === response.id && <p role="status" className="text-sm">Сохраняем решение…</p>}
            </div>}>
            <ResponseMessage response={response} />
          </StudentCard>)}
        </div> : <EmptyState icon={<MessagesSquare />} title="Откликов пока нет"
          description="Здесь появятся заявки от студентов, которые откликнутся на объявление." />}
        <Pagination result={result.data} onPage={setPage} />
      </>}
  </section>
}

function MyResponseCard({ response }: { response: ListingResponseDto }) {
  const listing = useQuery(listingDetail(response.listingId))
  const unavailable = listing.error instanceof ApiError && [403, 404].includes(listing.error.status)
  return <article className="social-card flex flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="font-bold wrap-anywhere">
        {listing.isSuccess && (!listing.isFetching || listing.isFetchedAfterMount)
          ? <Link className="hover:underline" to={`/listings/${response.listingId}`}>{listing.data.title}</Link>
          : unavailable ? 'Объявление недоступно' : listing.isError ? 'Объявление' : 'Загружаем объявление…'}
      </h2>
      <StatusBadge status={response.status} />
    </div>
    {listing.isError && !unavailable && <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-secondary-ink">{listingError(listing.error)}</p>
      <Button variant="outline" onClick={() => void listing.refetch()}>Повторить загрузку объявления</Button>
    </div>}
    <ResponseMessage response={response} />
    {response.status === 'Accepted' && listing.isSuccess && (!listing.isFetching || listing.isFetchedAfterMount) &&
      <ResponseConversation otherUserId={listing.data.author.userId} />}
  </article>
}

export function MyResponsesPage() {
  const [page, setPage] = useState(1)
  const result = useQuery(myResponses(page))
  return <div className="space-y-5">
    <h1 className="page-title">Мои отклики</h1>
    <ListingsNavigation />
    {result.isPending ? <LoadingSkeleton label="Загружаем твои отклики" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <>
        {result.data.items.length ? <div className="social-grid">
          {result.data.items.map(response => <MyResponseCard key={response.id} response={response} />)}
        </div> : <EmptyState icon={<MessagesSquare />} title="У тебя пока нет откликов"
          description="Открой объявление и отправь заявку, чтобы она появилась здесь."
          action={<Button asChild variant="outline"><Link to="/listings">К объявлениям</Link></Button>} />}
        <Pagination result={result.data} onPage={setPage} />
      </>}
  </div>
}
