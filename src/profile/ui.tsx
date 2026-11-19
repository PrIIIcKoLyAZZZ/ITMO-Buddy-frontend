import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { api } from '@/auth/session'
import { ApiError } from '@/api/http'
import type { DictionaryItemResponse, GoalCategory, ProfileCardResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dictionary, type Dictionary } from './queries'

export const goals: Record<GoalCategory, string> = {
  Studies: 'Учёба', Projects: 'Проекты', Events: 'События', Interests: 'Общие интересы',
}

export function goalLabel(value: string) {
  return Object.hasOwn(goals, value) ? goals[value as GoalCategory] : value
}

export function profileName(profile: Pick<ProfileCardResponse, 'firstName' | 'lastName'>) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Студент ИТМО'
}

export function useDebounced(value: string) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), 300)
    return () => window.clearTimeout(timer)
  }, [value])
  return settled
}

export const dictionaryWriteKey = ['dictionary', 'create'] as const

function canonicalName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase()
}

export function DictionaryPicker({ type, label, selected, onChange, limit, error, allowCreate = true }: {
  type: Dictionary; label: string; selected: DictionaryItemResponse[]
  onChange: (items: DictionaryItemResponse[]) => void; limit: number; error?: string; allowCreate?: boolean
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const client = useQueryClient()
  const trimmed = text.trim().replaceAll('\0', '')
  const term = useDebounced(trimmed)
  const results = useQuery(dictionary(type, type === 'faculties' || (!allowCreate && term.length < 2) ? '' : term, open))
  const create = useMutation({
    mutationKey: dictionaryWriteKey,
    mutationFn: async (name: string) => {
      try {
        return await api<DictionaryItemResponse>(`/api/dictionaries/${type}`, { method: 'POST', body: { name } })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        const matches = await api<DictionaryItemResponse[]>(`/api/dictionaries/${type}`, {
          query: { searchText: name, limit: 20 },
        })
        const existing = matches.find(item => canonicalName(item.name) === canonicalName(name))
        if (existing) return existing
        throw error
      }
    },
  })
  const choices = (results.data ?? []).filter(item =>
    item.id !== '00000000-0000-0000-0000-000000000000' && !selected.some(value => value.id === item.id) &&
    (type !== 'faculties' || item.name.toLocaleLowerCase('ru').includes(trimmed.toLocaleLowerCase('ru'))),
  )
  const ready = type === 'faculties' || term === trimmed
  const hasExactMatch = [...(results.data ?? []), ...selected].some(item => canonicalName(item.name) === canonicalName(trimmed))
  const showCreate = allowCreate && type !== 'faculties' && ready && results.isSuccess && !!trimmed && !hasExactMatch
  const id = `picker-${type}`

  function select(item: DictionaryItemResponse) {
    if (limit === 1) onChange([item])
    else if (selected.length < limit && !selected.some(value => value.id === item.id)) onChange([...selected, item])
    setOpen(false)
    setText('')
  }

  return <div className="min-w-0 space-y-2">
    <label className="block text-sm font-semibold" htmlFor={id}>{label}</label>
    {selected.length > 0 && <ul className="flex flex-wrap gap-2">
      {selected.map(item => <li className="max-w-full" key={item.id}>
        <button type="button" className="social-chip hover:bg-[#dee7ff] disabled:opacity-50"
          disabled={create.isPending} onClick={() => onChange(selected.filter(value => value.id !== item.id))}
          aria-label={`Убрать: ${item.name}`}>{item.name}<X className="shrink-0" size={14} /></button>
      </li>)}
    </ul>}
    <Input id={id} value={text} maxLength={200} placeholder={`Найти: ${label.toLowerCase()}`}
      disabled={create.isPending} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      onFocus={() => setOpen(true)} onChange={event => { setText(event.target.value); setCreateError(''); setOpen(true) }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          setOpen(event.key === 'Enter')
        }
      }} />
    {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    {open && <div className="space-y-1 rounded-xl border border-border bg-white p-2">
      <div className="flex items-center justify-between gap-2 px-2 text-sm text-secondary-ink">
        <span>{selected.length} из {limit}</span>
        <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => setOpen(false)}>Свернуть</Button>
      </div>
      {!ready || results.isPending ? <p className="px-2 py-2 text-sm" role="status">Ищем в справочнике…</p>
        : results.isError ? <div className="px-2"><p role="alert">{results.error.message}</p>
          <Button type="button" variant="outline" onClick={() => void results.refetch()}>Повторить</Button></div>
        : choices.length === 0 ? <p className="px-2 py-2 text-sm text-secondary-ink">Подходящих вариантов нет.</p>
        : <ul className="max-h-52 overflow-auto">
          {choices.map(item =>
            <li key={item.id}><Button type="button" variant="ghost"
              className="h-auto w-full justify-start py-2 text-left whitespace-normal wrap-anywhere"
              disabled={create.isPending || (limit !== 1 && selected.length >= limit)} onClick={() => select(item)}>
              {item.name}
            </Button></li>)}
        </ul>
      }
      {showCreate && (trimmed.length > 100 ? <p className="field-error px-2">Название может содержать до 100 символов.</p>
        : <Button type="button" variant="outline" disabled={create.isPending || selected.length >= limit}
          className="w-full justify-start py-2 text-left whitespace-normal wrap-anywhere" onClick={() => {
            setCreateError('')
            create.mutate(trimmed, {
              onSuccess: saved => {
                void client.invalidateQueries({ queryKey: ['dictionary', type] })
                select(saved)
              },
              onError: error => setCreateError(error instanceof ApiError && error.status === 409
                ? 'Это название уже используется. Обнови поиск и выбери значение из списка.'
                : error.message),
            })
          }}><Plus size={16} className="shrink-0" /> {create.isPending ? 'Добавляем…' : `Создать «${trimmed}»`}</Button>)}
      {createError && <p className="form-error" role="alert">{createError}</p>}
    </div>}
  </div>
}

export function Chips({ values }: { values: string[] }) {
  return <ul className="flex flex-wrap gap-2">{values.map((value, index) =>
    <li className="social-chip" key={`${index}-${value}`}>{value}</li>)}</ul>
}
