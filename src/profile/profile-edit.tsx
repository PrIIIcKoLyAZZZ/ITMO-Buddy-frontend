import { zodResolver } from '@hookform/resolvers/zod'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useBeforeUnload, useBlocker, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import type { ProfileResponse, UpdateProfileRequest, UploadPhotoResponse } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { api } from '@/auth/session'
import { ConfirmDialog, ErrorState, LoadingSkeleton, UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { myProfile, useProfilePhotoRefresh } from './queries'
import { DictionaryPicker, dictionaryWriteKey, goals, profileName } from './ui'

const item = z.object({ id: z.string().uuid(), name: z.string() })
const items = z.array(item).max(15, 'Можно выбрать до 15 значений.')
  .refine(values => new Set(values.map(value => value.id)).size === values.length, 'Убери повторяющиеся значения.')
const profileSchema = z.object({
  firstName: z.string().trim().max(100, 'До 100 символов.'),
  lastName: z.string().trim().max(100, 'До 100 символов.'),
  facultyId: z.array(item).max(1, 'Выбери один факультет.'),
  course: z.string().trim().refine(value => !value || (
    /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 2147483647
  ), 'Введи положительный целый номер курса.'),
  aboutMe: z.string().trim().max(1000, 'До 1000 символов.'),
  contact: z.string().trim().max(200, 'До 200 символов.'),
  goals: z.array(z.enum(['Studies', 'Projects', 'Events', 'Interests']))
    .refine(values => new Set(values).size === values.length, 'Убери повторяющиеся цели.'),
  interestIds: items,
  skillIds: items,
  isVisible: z.boolean(),
})
type ProfileFields = z.input<typeof profileSchema>
const fieldNames = Object.keys(profileSchema.shape) as (keyof ProfileFields)[]

function defaults(profile: ProfileResponse): ProfileFields {
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    facultyId: profile.faculty ? [profile.faculty] : [],
    course: profile.course?.toString() ?? '',
    aboutMe: profile.aboutMe ?? '',
    contact: profile.contact ?? '',
    goals: profile.goals.filter((goal): goal is ProfileFields['goals'][number] => Object.hasOwn(goals, goal)),
    interestIds: profile.interests,
    skillIds: profile.skills,
    isVisible: profile.isVisible,
  }
}

function Field({ name, label, error, children }: {
  name: string; label: string; error?: string; children: ReactNode
}) {
  return <div className="form-field text-sm">
    <label className="font-semibold" htmlFor={name}>{label}</label>
    {children}
    {error && <p id={`${name}-error`} className="field-error">{error}</p>}
  </div>
}

function ProfileForm({ profile }: { profile: ProfileResponse }) {
  const refreshPhoto = useProfilePhotoRefresh()
  const [selectedPhoto, setSelectedPhoto] = useState<{ file: File; preview: string }>()
  const [photoError, setPhotoError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const savedNavigation = useRef(false)
  const client = useQueryClient()
  const navigate = useNavigate()
  const { register, control, handleSubmit, reset, setError, formState: { errors, isDirty } } =
    useForm<ProfileFields>({ defaultValues: defaults(profile), resolver: zodResolver(profileSchema) })
  const update = useMutation({
    mutationFn: (body: UpdateProfileRequest) => api<ProfileResponse>('/api/profiles/me', { method: 'PUT', body }),
  })
  const upload = useMutation({
    mutationFn: (photo: File) => {
      const body = new FormData()
      body.set('file', photo)
      return api<UploadPhotoResponse>('/api/profiles/me/photo', { method: 'POST', body })
    },
  })
  const dictionaryBusy = useIsMutating({ mutationKey: dictionaryWriteKey }) > 0
  const pending = upload.isPending || update.isPending
  const dirty = isDirty || !!selectedPhoto
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !savedNavigation.current && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(event => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = true
  })

  useEffect(() => {
    if (selectedPhoto) return () => URL.revokeObjectURL(selectedPhoto.preview)
  }, [selectedPhoto])

  function publish(saved: ProfileResponse) {
    void client.cancelQueries({ queryKey: myProfile.queryKey, exact: true })
    client.setQueryData(myProfile.queryKey, saved)
    void client.invalidateQueries({ queryKey: myProfile.queryKey, exact: true, refetchType: 'none' })
    void client.invalidateQueries({ queryKey: ['profile', 'user', saved.userId] })
  }

  function errorProps(name: keyof ProfileFields, hint?: string) {
    return {
      id: name,
      'aria-invalid': !!errors[name],
      'aria-describedby': [hint, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined,
    }
  }

  function submit(values: ProfileFields) {
    if (pending || dictionaryBusy) return
    update.mutate({
      firstName: values.firstName || null,
      lastName: values.lastName || null,
      facultyId: values.facultyId[0]?.id ?? null,
      course: values.course ? Number(values.course) : null,
      aboutMe: values.aboutMe || null,
      contact: values.contact || null,
      goals: values.goals,
      interestIds: values.interestIds.map(value => value.id),
      skillIds: values.skillIds.map(value => value.id),
      isVisible: values.isVisible,
    }, {
      onSuccess: saved => {
        publish(saved)
        reset(defaults(saved))
        toast.success('Профиль сохранён.')
        if (!selectedPhoto) {
          savedNavigation.current = true
          void navigate('/profile')
        }
      },
      onError: error => {
        if (error instanceof ApiError) {
          for (const validation of error.payload?.validationErrors ?? []) {
            const field = fieldNames.find(name => name.toLowerCase() === validation.field.toLowerCase())
            if (field) setError(field, { message: validation.messages.join(' ') })
          }
          const dictionaryErrors: Record<string, [keyof ProfileFields, string]> = {
            'profile.faculty_not_found': ['facultyId', 'Выбранный факультет недоступен.'],
            'profile.interest_not_found': ['interestIds', 'Один из выбранных интересов недоступен.'],
            'profile.skill_not_found': ['skillIds', 'Один из выбранных навыков недоступен.'],
          }
          const mapped = dictionaryErrors[error.payload?.code ?? '']
          if (mapped) setError(mapped[0], { message: mapped[1] })
        }
        setError('root', { message: error.message })
      },
    })
  }

  return <form className="max-w-3xl space-y-5" onSubmit={event => void handleSubmit(submit)(event)} noValidate>
    <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={open => {
      if (!open && blocker.state === 'blocked') blocker.reset()
    }} title="Уйти без сохранения?"
      description="Несохранённые изменения анкеты и выбранное фото будут потеряны."
      confirmLabel="Уйти" destructive onConfirm={() => blocker.proceed?.()} />
    <fieldset disabled={pending} className="social-card space-y-4">
      <legend className="sr-only">Фото профиля</legend>
      <h2 className="text-lg font-bold">Фото профиля</h2>
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={profileName(profile)} photoUrl={selectedPhoto?.preview ?? profile.photoUrl}
          onPhotoError={selectedPhoto ? undefined : refreshPhoto} />
        <Input ref={fileInput} className="h-auto min-w-0 w-full py-2 sm:w-auto" id="photo" type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg" aria-label="Выбрать фото профиля" aria-describedby="photo-help"
          onChange={event => {
            const photo = event.target.files?.[0]
            setSelectedPhoto(undefined)
            setPhotoError('')
            upload.reset()
            if (!photo) return
            if (!['image/png', 'image/jpeg'].includes(photo.type) || photo.size < 1 || photo.size > 5 * 1024 * 1024) {
              event.target.value = ''
              setPhotoError('Выбери фото PNG или JPEG размером до 5 МиБ.')
              return
            }
            setSelectedPhoto({ file: photo, preview: URL.createObjectURL(photo) })
          }} />
        <Button type="button" variant="outline" disabled={!selectedPhoto || pending} onClick={() => {
          if (!selectedPhoto) return
          upload.mutate(selectedPhoto.file, {
            onSuccess: ({ photoUrl }) => {
              const latest = client.getQueryData(myProfile.queryKey) ?? profile
              publish({ ...latest, photoUrl })
              setSelectedPhoto(undefined)
              if (fileInput.current) fileInput.current.value = ''
              toast.success('Фото обновлено.')
            },
          })
        }}>{upload.isPending ? 'Загружаем…' : 'Загрузить фото'}</Button>
      </div>
      <p id="photo-help" className="text-sm text-secondary-ink">PNG или JPEG, до 5 МиБ. Фото сохраняется отдельно от анкеты.</p>
      {(photoError || upload.error) && <p className="form-error" role="alert">
        {photoError || (upload.error instanceof ApiError && [400, 413].includes(upload.error.status)
          ? 'Сервер не принял фото. Проверь формат и размер файла.' : upload.error?.message)}
      </p>}
    </fieldset>
    <fieldset disabled={pending} className="social-card min-w-0 space-y-5">
      <legend className="sr-only">Анкета</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="Имя" error={errors.firstName?.message}>
          <Input {...register('firstName')} {...errorProps('firstName')} />
        </Field>
        <Field name="lastName" label="Фамилия" error={errors.lastName?.message}>
          <Input {...register('lastName')} {...errorProps('lastName')} />
        </Field>
        <Controller name="facultyId" control={control} render={({ field, fieldState }) =>
          <DictionaryPicker type="faculties" label="Факультет" selected={field.value}
            onChange={field.onChange} error={fieldState.error?.message} limit={1} />} />
        <Field name="course" label="Курс" error={errors.course?.message}>
          <Input {...register('course')} {...errorProps('course')} inputMode="numeric" />
        </Field>
      </div>
      <Field name="aboutMe" label="О себе" error={errors.aboutMe?.message}>
        <textarea className="social-field min-h-28 p-3" {...register('aboutMe')} {...errorProps('aboutMe')} />
      </Field>
      <Field name="contact" label="Контакты" error={errors.contact?.message}>
        <Input {...register('contact')} {...errorProps('contact', 'contact-help')} />
        <p id="contact-help" className="text-secondary-ink">Контакты видны только тебе.</p>
      </Field>
      <fieldset aria-describedby={errors.goals ? 'goals-error' : undefined}>
        <legend className="mb-2 text-sm font-semibold">Цели</legend>
        <div className="flex flex-wrap gap-3">{Object.entries(goals).map(([value, label]) =>
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" value={value} {...register('goals')} className="size-4 accent-primary" /> {label}
          </label>)}</div>
        {errors.goals && <p id="goals-error" className="field-error mt-2">{errors.goals.message}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller name="interestIds" control={control} render={({ field, fieldState }) =>
          <DictionaryPicker type="interests" label="Интересы" selected={field.value} onChange={field.onChange}
            error={fieldState.error?.message} limit={15} />} />
        <Controller name="skillIds" control={control} render={({ field, fieldState }) =>
          <DictionaryPicker type="skills" label="Навыки" selected={field.value} onChange={field.onChange}
            error={fieldState.error?.message} limit={15} />} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" {...register('isVisible')} className="size-5 accent-primary" />
        Показывать профиль другим студентам
      </label>
      {errors.root && <p className="form-error" role="alert">{errors.root.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || dictionaryBusy}>{update.isPending ? 'Сохраняем…' : 'Сохранить профиль'}</Button>
        <Button variant="outline" asChild><Link to="/profile">К профилю</Link></Button>
      </div>
    </fieldset>
  </form>
}

export function ProfileEditPage() {
  const profile = useQuery(myProfile)
  return <>
    <h1 className="page-title">Редактирование профиля</h1>
    {profile.data ? <ProfileForm key={profile.data.userId} profile={profile.data} />
      : profile.isError ? <ErrorState error={profile.error} retry={() => void profile.refetch()} />
      : <LoadingSkeleton label="Загружаем анкету" />}
  </>
}
