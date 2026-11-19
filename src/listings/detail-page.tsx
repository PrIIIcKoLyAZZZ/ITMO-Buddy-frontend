import { useState } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ApiError } from '@/api/http'
import { api, useSession } from '@/auth/session'
import { ConfirmDialog, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Chips } from '@/profile/ui'
import { isNonEmptyGuid, type ListingResponse } from './contracts'
import { listingActionKey, listingDetail, listingError, listingPath, refreshListings } from './queries'
import { AuthorResponses, RespondForm } from './responses'
import { ListingAuthor, ListingFacts, ListingUnavailable } from './ui'

function OwnerActions({ listing, pending }: { listing: ListingResponse; pending: boolean }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState<'close' | 'delete'>()
  const mutationKey = listingActionKey(listing.id)
  const action = useMutation({
    mutationKey,
    mutationFn: (operation: 'close' | 'delete') => operation === 'close'
      ? api<void>(`${listingPath(listing.id)}/close`, { method: 'POST' })
      : api<void>(listingPath(listing.id), { method: 'DELETE' }),
    onSuccess: (_, operation) => {
      toast.success(operation === 'close' ? 'Объявление закрыто' : 'Объявление удалено')
      void refreshListings(client, listing.id)
    },
    onError: async error => {
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) await refreshListings(client, listing.id)
    },
  })

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {listing.status === 'Open' && <>
        {pending ? <Button disabled variant="outline">Редактировать</Button>
          : <Button asChild variant="outline"><Link to={`/listings/${listing.id}/edit`}>Редактировать</Link></Button>}
        <Button variant="outline" disabled={pending} onClick={() => setConfirmation('close')}>Закрыть</Button>
      </>}
      <Button variant="destructive" disabled={pending} onClick={() => setConfirmation('delete')}>Удалить</Button>
    </div>
    <ConfirmDialog open={!!confirmation} destructive onOpenChange={open => { if (!open) setConfirmation(undefined) }}
      title={confirmation === 'delete' ? 'Удалить объявление?' : 'Закрыть объявление?'}
      description={confirmation === 'delete' ? 'Объявление станет недоступно. Действие нельзя отменить.'
        : 'Объявление исчезнет из общей ленты и перестанет принимать отклики.'}
      confirmLabel={confirmation === 'delete' ? 'Удалить' : 'Закрыть'}
      onConfirm={() => {
        if (!confirmation || client.isMutating({ mutationKey, exact: true })) return
        action.mutate(confirmation, {
          onSuccess: (_, operation) => {
            if (operation === 'delete') void navigate('/listings/my', { replace: true })
          },
        })
        setConfirmation(undefined)
      }} />
    {action.isPending && <p className="text-sm" role="status">{action.variables === 'close' ? 'Закрываем…' : 'Удаляем…'}</p>}
    {action.error && <p className="form-error wrap-anywhere" role="alert">{listingError(action.error)}</p>}
  </div>
}

function unavailableReason(listing: ListingResponse) {
  if (listing.status !== 'Open') return 'Объявление закрыто.'
  if (listing.acceptedParticipantsCount >= listing.requiredParticipantsCount) return 'Свободных мест больше нет.'
  if ([listing.deadlineUtc, listing.eventAtUtc].some(date => date && Date.parse(date) <= Date.now())) {
    return 'Срок приёма откликов закончился.'
  }
  return ''
}

function ListingDetails({ id }: { id: string }) {
  const session = useSession()
  const detail = useQuery(listingDetail(id))
  const pending = useIsMutating({ mutationKey: listingActionKey(id), exact: true }) > 0
  if (detail.error instanceof ApiError && [403, 404].includes(detail.error.status)) return <ListingUnavailable />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => void detail.refetch()} />
  if (!detail.data || (detail.isFetching && !detail.isFetchedAfterMount)) return <LoadingSkeleton label="Загружаем объявление" />
  const listing = detail.data
  const own = session.status === 'authenticated' && session.session.userId === listing.author.userId
  const reason = unavailableReason(listing)
  return <div className="space-y-5">
    <Link className="text-sm font-semibold text-primary hover:underline" to={own ? '/listings/my' : '/listings'}>
      {own ? '← Мои объявления' : '← К объявлениям'}
    </Link>
    <section className="social-card space-y-5">
      <h1 className="page-title wrap-anywhere">{listing.title}</h1>
      <ListingFacts listing={listing} refreshing={own && pending && detail.isFetching} />
      <ListingAuthor author={listing.author} />
      <div className="space-y-2 border-t border-border pt-4">
        <h2 className="font-bold">Описание</h2>
        <p className="whitespace-pre-wrap text-secondary-ink wrap-anywhere">{listing.description}</p>
      </div>
      {listing.requiredSkills.length > 0 && <div className="space-y-2">
        <h2 className="font-bold">Необходимые навыки</h2>
        <Chips values={listing.requiredSkills.map(skill => skill.name)} />
      </div>}
      {own && <OwnerActions listing={listing} pending={pending} />}
    </section>
    {own ? <AuthorResponses id={id} canAccept={!reason} unavailableReason={reason} />
      : <RespondForm id={id} canRespond={!reason} unavailableReason={reason} />}
  </div>
}

export default function ListingDetailPage() {
  const { id } = useParams()
  return isNonEmptyGuid(id) ? <ListingDetails key={id.toLowerCase()} id={id.toLowerCase()} /> : <ListingUnavailable />
}
