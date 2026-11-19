import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import type { DictionaryItemResponse, GoalCategory } from '@/api/contracts'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DictionaryPicker, goals, useDebounced } from '@/profile/ui'
import { maxFilterItems, searchUsers } from './queries'
import { Pagination, StudentCard } from './ui'

const dictionaries = { faculties: 'Факультеты', interests: 'Интересы', skills: 'Навыки' } as const
const emptyDictionaries: Record<keyof typeof dictionaries, DictionaryItemResponse[]> = {
  faculties: [], interests: [], skills: [],
}
const categories = Object.keys(goals) as GoalCategory[]

function Courses({ selected, onChange }: { selected: number[]; onChange: (values: number[]) => void }) {
  const [text, setText] = useState('')
  const course = Number(text)
  const canAdd = /^\d+$/.test(text) && course > 0 && course <= 2_147_483_647 &&
    selected.length < maxFilterItems && !selected.includes(course)

  return <form className="min-w-0 space-y-2" onSubmit={event => {
    event.preventDefault()
    if (!canAdd) return
    onChange([...selected, course])
    setText('')
  }}>
    <label className="block text-sm font-semibold" htmlFor="search-course">Курсы</label>
    {selected.length > 0 && <ul className="flex flex-wrap gap-2">{selected.map(value =>
      <li key={value}><button type="button" className="social-chip" aria-label={`Убрать ${value} курс`}
        onClick={() => onChange(selected.filter(item => item !== value))}>{value} курс <X size={14} /></button></li>
    )}</ul>}
    <div className="flex gap-2">
      <Input id="search-course" inputMode="numeric" maxLength={10} value={text} placeholder="Номер курса"
        onChange={event => setText(event.target.value)} />
      <Button type="submit" variant="outline" disabled={!canAdd}>Добавить</Button>
    </div>
  </form>
}

export default function SearchPage() {
  const [text, setText] = useState('')
  const [goalCategories, setGoals] = useState<GoalCategory[]>([])
  const [selected, setSelected] = useState(emptyDictionaries)
  const [courses, setCourses] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [resetCount, setResetCount] = useState(0)
  const trimmed = text.trim()
  const term = useDebounced(trimmed)
  const invalid = trimmed.length === 1 || trimmed.includes('\0')
  const waiting = trimmed !== term
  const result = useQuery(searchUsers({
    SearchText: term || undefined,
    GoalCategories: goalCategories,
    InterestIds: selected.interests.map(item => item.id),
    SkillIds: selected.skills.map(item => item.id),
    FacultyIds: selected.faculties.map(item => item.id),
    Courses: courses,
    Page: page,
  }, !invalid && !waiting))

  function reset() {
    setText('')
    setGoals([])
    setSelected(emptyDictionaries)
    setCourses([])
    setPage(1)
    setResetCount(count => count + 1)
  }

  return <div className="space-y-5">
    <h1 className="page-title">Поиск студентов</h1>
    <section className="social-card space-y-4" aria-label="Фильтры поиска">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-52 space-y-2 text-sm font-semibold">
          Имя или ключевые слова
          <Input type="search" value={text} maxLength={200} aria-invalid={invalid}
            aria-describedby={invalid ? 'search-text-warning' : undefined} placeholder="Найти студента"
            onChange={event => { setText(event.target.value); setPage(1) }} />
        </label>
        <Button variant="outline" onClick={reset}>Сбросить фильтры</Button>
      </div>
      {invalid && <p id="search-text-warning" role="alert" className="field-error">
        Введи не менее двух символов без управляющего символа NUL.
      </p>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Цели</legend>
        <div className="flex flex-wrap gap-2">{categories.map(goal => <label key={goal} className="social-chip cursor-pointer">
          <input type="checkbox" checked={goalCategories.includes(goal)} onChange={event => {
            setGoals(event.target.checked ? [...goalCategories, goal] : goalCategories.filter(item => item !== goal))
            setPage(1)
          }} /> {goals[goal]}
        </label>)}</div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2" key={resetCount}>
        {(Object.keys(dictionaries) as (keyof typeof dictionaries)[]).map(type =>
          <DictionaryPicker key={type} type={type} label={dictionaries[type]} selected={selected[type]}
            onChange={items => { setSelected(current => ({ ...current, [type]: items })); setPage(1) }}
            limit={maxFilterItems} allowCreate={false} />
        )}
        <Courses selected={courses} onChange={values => { setCourses(values); setPage(1) }} />
      </div>
    </section>

    {!invalid && (waiting || result.isPending ? <LoadingSkeleton label="Ищем студентов" />
      : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} />
      : <>
        {result.data.items.length > 0 ? <div className="social-grid">{result.data.items.map(user =>
          <StudentCard key={user.userId} user={user} />)}</div>
          : <EmptyState icon={<Search />} title="Студенты не найдены" description="Попробуй изменить запрос или фильтры." />}
        <Pagination result={result.data} onPage={setPage} />
      </>)}
  </div>
}
