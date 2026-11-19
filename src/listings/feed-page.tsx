import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import type { DictionaryItemResponse, GoalCategory, PagedResult } from '@/api/contracts'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/discovery/ui'
import { DictionaryPicker, goals, useDebounced } from '@/profile/ui'
import { listingFormats, listingLimits, type ListingCardResponse, type ListingFormat } from './contracts'
import { listingFeed, myListings } from './queries'
import { formatLabels, ListingCard, ListingsNavigation, selectClass } from './ui'

function ListingResults({ data, onPage, mine }: {
  data: PagedResult<ListingCardResponse>; onPage: (page: number) => void; mine?: boolean
}) {
  return <>
    {data.items.length ? <div className="social-grid">
      {data.items.map(listing => <ListingCard key={listing.id} listing={listing} />)}
    </div> : <EmptyState icon={<ClipboardList />} title={mine ? 'У тебя пока нет объявлений' : 'Объявления не найдены'}
      description={mine ? 'Создай объявление, чтобы набрать команду или пригласить участников.' : 'Попробуй изменить запрос или сбросить фильтры.'} />}
    <Pagination result={data} onPage={onPage} />
  </>
}

export function ListingsPage() {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<GoalCategory | ''>('')
  const [format, setFormat] = useState<ListingFormat | ''>('')
  const [skills, setSkills] = useState<DictionaryItemResponse[]>([])
  const [page, setPage] = useState(1)
  const [resetCount, setResetCount] = useState(0)
  const trimmed = text.trim()
  const searchText = useDebounced(trimmed)
  const invalid = trimmed.length === 1 || trimmed.includes('\0')
  const waiting = trimmed !== searchText
  const result = useQuery(listingFeed({
    SearchText: searchText || undefined, Category: category || undefined, Format: format || undefined,
    SkillIds: skills.map(skill => skill.id).sort(), Page: page,
  }, !invalid && !waiting))

  function reset() {
    setText('')
    setCategory('')
    setFormat('')
    setSkills([])
    setPage(1)
    setResetCount(count => count + 1)
  }

  return <div className="space-y-5">
    <h1 className="page-title">Объявления</h1>
    <ListingsNavigation />
    <section aria-label="Фильтры объявлений" className="social-card space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-52 space-y-2 text-sm font-semibold">
          Поиск по заголовку и описанию
          <Input type="search" placeholder="Найти объявление" value={text} maxLength={200}
            aria-invalid={invalid} aria-describedby={invalid ? 'listing-search-error' : undefined}
            onChange={event => { setText(event.target.value); setPage(1) }} />
        </label>
        <Button variant="outline" onClick={reset}>Сбросить фильтры</Button>
      </div>
      {invalid && <p id="listing-search-error" className="field-error" role="alert">Введи не менее двух символов без NUL.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Категория
          <select className={selectClass} value={category}
            onChange={event => { setCategory(event.target.value as GoalCategory | ''); setPage(1) }}>
            <option value="">Все категории</option>
            {Object.entries(goals).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">Формат
          <select className={selectClass} value={format}
            onChange={event => { setFormat(event.target.value as ListingFormat | ''); setPage(1) }}>
            <option value="">Все форматы</option>
            {listingFormats.map(value => <option key={value} value={value}>{formatLabels[value]}</option>)}
          </select>
        </label>
        <DictionaryPicker key={resetCount} type="skills" label="Необходимые навыки" selected={skills}
          onChange={items => { setSkills(items); setPage(1) }} limit={listingLimits.skills} allowCreate={false} />
      </div>
    </section>
    {!invalid && (waiting || result.isPending ? <LoadingSkeleton label="Ищем объявления" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <ListingResults data={result.data} onPage={setPage} />)}
  </div>
}

export function MyListingsPage() {
  const [page, setPage] = useState(1)
  const result = useQuery(myListings(page))
  return <div className="space-y-5">
    <h1 className="page-title">Мои объявления</h1>
    <ListingsNavigation />
    {result.isPending ? <LoadingSkeleton label="Загружаем объявления" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <ListingResults data={result.data} onPage={setPage} mine />}
  </div>
}
