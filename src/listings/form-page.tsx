import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiError } from '@/api/http'
import { api, useSession } from '@/auth/session'
import { ConfirmDialog, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DictionaryPicker, goals } from '@/profile/ui'
import { listingCategories, listingFormats, listingLimits, isNonEmptyGuid,
  type CreateListingRequest, type ListingResponse, type UpdateListingRequest } from './contracts'
import { listingActionKey, listingDetail, listingError, listingPath, refreshListings } from './queries'
import { formatLabels, ListingField, ListingUnavailable, selectClass, textareaClass } from './ui'

function listingText(limit: number) {
  return z.string().trim().min(1, 'Заполни это поле.').max(limit, `Не более ${limit} символов.`)
    .refine(text => !text.includes('\0'), 'Удали недопустимый символ из текста.')
}

function utcDate(value: string) {
  return new Date(value + 'Z')
}

const listingDate = z.string().refine(value => !value || utcDate(value).getTime() > Date.now(),
  'Укажи будущую дату и время в UTC.')
const listingFormSchema = z.object({
  title: listingText(listingLimits.title),
  description: listingText(listingLimits.description),
  category: z.enum(listingCategories),
  format: z.enum(listingFormats),
  requiredParticipantsCount: z.number().int('Введи целое число.')
    .min(listingLimits.minParticipants, 'Нужно хотя бы одно место.')
    .max(listingLimits.maxParticipants, `Не более ${listingLimits.maxParticipants} мест.`),
  requiredSkillIds: z.array(z.object({ id: z.string().refine(isNonEmptyGuid), name: z.string() }))
    .max(listingLimits.skills).refine(items => new Set(items.map(item => item.id.toLowerCase())).size === items.length,
      'Выбери каждый навык только один раз.'),
  deadlineUtc: listingDate,
  eventAtUtc: listingDate,
}).refine(data => !data.deadlineUtc || !data.eventAtUtc || utcDate(data.deadlineUtc) <= utcDate(data.eventAtUtc), {
  path: ['deadlineUtc'], message: 'Дедлайн должен быть не позже мероприятия.',
})

type ListingFields = z.infer<typeof listingFormSchema>
const fields = Object.keys(listingFormSchema.shape) as (keyof ListingFields)[]

function dateInputValue(date?: string | null) {
  return date ? new Date(date).toISOString().slice(0, -1) : ''
}

function ListingForm({ listing }: { listing?: ListingResponse }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const allowNavigation = useRef(false)
  const { register, control, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<ListingFields>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      title: listing?.title ?? '', description: listing?.description ?? '', category: listing?.category ?? 'Projects',
      format: listing?.format ?? 'Online', requiredParticipantsCount: listing?.requiredParticipantsCount ?? 1,
      requiredSkillIds: listing?.requiredSkills ?? [], deadlineUtc: dateInputValue(listing?.deadlineUtc),
      eventAtUtc: dateInputValue(listing?.eventAtUtc),
    },
  })

  const mutationKey = listingActionKey(listing?.id ?? 'new')
  const save = useMutation({
    mutationKey,
    mutationFn: (body: CreateListingRequest | UpdateListingRequest) => listing
      ? api<ListingResponse>(listingPath(listing.id), { method: 'PUT', body })
      : api<ListingResponse>('/api/listings', { method: 'POST', body }),
    onSuccess: saved => { void refreshListings(client, saved.id) },
    onError: error => {
      if (error instanceof ApiError) {
        for (const validation of error.payload?.validationErrors ?? []) {
          const field = fields.find(name => name.toLowerCase() === validation.field.toLowerCase())
          if (field) setError(field, { message: validation.messages.join(' ') })
        }
        if (listing && [404, 409].includes(error.status)) void refreshListings(client, listing.id)
      }
      setError('root', { message: listingError(error) })
    },
  })

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (isDirty || save.isPending) && !allowNavigation.current && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(event => {
    if (!isDirty && !save.isPending) return
    event.preventDefault()
    event.returnValue = true
  })

  function submit(values: ListingFields) {
    if (client.isMutating({ mutationKey, exact: true })) return
    save.mutate({
      ...values,
      requiredSkillIds: values.requiredSkillIds.map(skill => skill.id),
      deadlineUtc: values.deadlineUtc ? utcDate(values.deadlineUtc).toISOString() : null,
      eventAtUtc: values.eventAtUtc ? utcDate(values.eventAtUtc).toISOString() : null,
    }, {
      onSuccess: saved => {
        reset({ ...values, requiredSkillIds: saved.requiredSkills,
          deadlineUtc: dateInputValue(saved.deadlineUtc), eventAtUtc: dateInputValue(saved.eventAtUtc) })
        allowNavigation.current = true
        toast.success(listing ? 'Изменения сохранены' : 'Объявление создано')
        void navigate(`/listings/${saved.id}`, { replace: true })
      },
    })
  }

  function inputProps(name: keyof ListingFields) {
    return { id: name, 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : undefined }
  }

  return <form className="social-card max-w-3xl space-y-4" noValidate onSubmit={event => void handleSubmit(submit)(event)}>
    <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={open => {
      if (!open && blocker.state === 'blocked') blocker.reset()
    }} title="Уйти без сохранения?" description="Несохранённые изменения объявления будут потеряны."
      confirmLabel="Уйти" onConfirm={() => blocker.proceed?.()} destructive />
    <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
      <ListingField name="title" label="Заголовок" error={errors.title?.message}>
        <Input {...register('title')} {...inputProps('title')} maxLength={listingLimits.title} required />
      </ListingField>
      <ListingField name="description" label="Описание" error={errors.description?.message}>
        <textarea {...register('description')} {...inputProps('description')} className={textareaClass}
          rows={5} maxLength={listingLimits.description} required />
      </ListingField>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListingField name="category" label="Категория" error={errors.category?.message}>
          <select {...register('category')} {...inputProps('category')} className={selectClass}>
            {listingCategories.map(value => <option key={value} value={value}>{goals[value]}</option>)}
          </select>
        </ListingField>
        <ListingField name="format" label="Формат участия" error={errors.format?.message}>
          <select {...register('format')} {...inputProps('format')} className={selectClass}>
            {listingFormats.map(value => <option key={value} value={value}>{formatLabels[value]}</option>)}
          </select>
        </ListingField>
        <ListingField name="requiredParticipantsCount" label="Сколько участников нужно" error={errors.requiredParticipantsCount?.message}>
          <Input {...register('requiredParticipantsCount', { valueAsNumber: true })} {...inputProps('requiredParticipantsCount')}
            type="number" min={listingLimits.minParticipants} max={listingLimits.maxParticipants} required />
        </ListingField>
        <Controller control={control} name="requiredSkillIds" render={({ field, fieldState }) =>
          <DictionaryPicker type="skills" label="Необходимые навыки" limit={listingLimits.skills}
            allowCreate={false} selected={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
        <ListingField name="deadlineUtc" label="Дедлайн (UTC)" error={errors.deadlineUtc?.message}>
          <Input {...register('deadlineUtc')} {...inputProps('deadlineUtc')} type="datetime-local" step="any" />
        </ListingField>
        <ListingField name="eventAtUtc" label="Дата мероприятия (UTC)" error={errors.eventAtUtc?.message}>
          <Input {...register('eventAtUtc')} {...inputProps('eventAtUtc')} type="datetime-local" step="any" />
        </ListingField>
      </div>
      {errors.root?.message && <p className="form-error wrap-anywhere" role="alert">{errors.root.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{save.isPending ? 'Сохраняем…' : listing ? 'Сохранить изменения' : 'Опубликовать'}</Button>
        <Button variant="outline" asChild><Link to={listing ? `/listings/${listing.id}` : '/listings'}>Отмена</Link></Button>
      </div>
    </fieldset>
  </form>
}

export function NewListingPage() {
  return <div className="space-y-5"><h1 className="page-title">Новое объявление</h1><ListingForm /></div>
}

function EditListing({ id }: { id: string }) {
  const session = useSession()
  const listing = useQuery(listingDetail(id))
  if (listing.error instanceof ApiError && [403, 404].includes(listing.error.status)) return <ListingUnavailable />
  if (!listing.data && listing.isError) return <ErrorState error={listing.error} retry={() => void listing.refetch()} />
  if ((!listing.isFetchedAfterMount && listing.isFetching) || !listing.data) return <LoadingSkeleton label="Загружаем объявление" />
  if (session.status !== 'authenticated' || session.session.userId !== listing.data.author.userId) return <ListingUnavailable forbidden />
  if (listing.data.status === 'Closed') return <ListingUnavailable closed />
  return <div className="space-y-5">
    <h1 className="page-title">Редактирование объявления</h1>
    <ListingForm key={id} listing={listing.data} />
  </div>
}

export function EditListingPage() {
  const { id } = useParams()
  return isNonEmptyGuid(id) ? <EditListing key={id.toLowerCase()} id={id.toLowerCase()} /> : <ListingUnavailable />
}
