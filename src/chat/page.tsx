import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { Link, NavLink, useParams } from 'react-router-dom'
import type { ConversationResponse, MessageResponse } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { api, useSession } from '@/auth/session'
import { EmptyState, ErrorState, LoadingSkeleton, UserAvatar } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/discovery/ui'
import { isNonEmptyGuid } from '@/listings/contracts'
import { DateStamp } from '@/listings/ui'
import { notificationsKey } from '@/notifications/queries'
import { profileName } from '@/profile/ui'
import { useRealtimeConnected } from '@/realtime/status'
import { cachedConversation, conversationHistory, conversationInfo, conversationPath,
  conversations, conversationsKey, historyKey, mergeMessage } from './queries'

function ConversationCard({ conversation }: { conversation: ConversationResponse }) {
  const name = profileName(conversation.otherParticipant)
  return <NavLink to={`/messages/${conversation.conversationId}`}
    className="nav-link items-start border border-transparent p-3 aria-[current=page]:border-primary/20">
    <UserAvatar name={name} photoUrl={conversation.otherParticipant.photoUrl} />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold wrap-anywhere">{name}</span>
        {conversation.unreadCount > 0 && <span aria-label={`Непрочитанных сообщений: ${conversation.unreadCount}`}
          className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-white">{conversation.unreadCount}</span>}
      </div>
      <p className="line-clamp-2 font-normal wrap-anywhere">{conversation.lastMessage?.text ?? 'Начни переписку'}</p>
      {conversation.lastMessageAtUtc && <p className="text-xs font-normal text-secondary-ink">
        <DateStamp date={conversation.lastMessageAtUtc} />
      </p>}
    </div>
  </NavLink>
}

function ConversationList({ activeId, onConversation }: {
  activeId?: string; onConversation: (conversation: ConversationResponse | undefined) => void
}) {
  const [page, setPage] = useState(1)
  const connected = useRealtimeConnected()
  const list = useQuery({ ...conversations(page), refetchInterval: connected ? false : 20_000 })
  const active = list.data?.items.find(item => item.conversationId === activeId)
  useEffect(() => { onConversation(active) }, [active, onConversation])

  return <aside aria-label="Список диалогов" className={`min-w-0 overflow-y-auto lg:block ${activeId ? 'hidden' : ''}`}>
    <div className="p-4">
      {activeId ? <h2 className="mb-4 text-2xl font-extrabold">Сообщения</h2>
        : <h1 className="mb-4 text-2xl font-extrabold">Сообщения</h1>}
      {list.isPending ? <LoadingSkeleton label="Загружаем диалоги" />
        : list.isError ? <ErrorState error={list.error} retry={() => void list.refetch()} />
        : <>
          {list.data.items.length ? <nav aria-label="Диалоги" className="mb-4 space-y-1">
            {list.data.items.map(item => <ConversationCard key={item.conversationId} conversation={item} />)}
          </nav> : <EmptyState icon={<MessageCircle />} title="Диалогов пока нет"
            description="Диалог появляется после взаимного мэтча или принятия отклика." />}
          <Pagination result={list.data} onPage={setPage} />
        </>}
    </div>
  </aside>
}

function MessageBubble({ message, own }: { message: MessageResponse; own: boolean }) {
  return <li data-message-id={message.id} className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[75%] ${own
    ? 'ml-auto rounded-br-sm bg-primary text-white' : 'rounded-bl-sm border border-border bg-white'}`}>
    <p className="whitespace-pre-wrap text-sm wrap-anywhere">{message.text}</p>
    <p className={`mt-1 text-right text-xs ${own ? 'text-white/90' : 'text-secondary-ink'}`}>
      <DateStamp date={message.sentAtUtc} />
    </p>
  </li>
}

type ScrollPosition = { atEnd: boolean; anchorId?: string; offset: number }

function MessageThread({ id, userId, known }: { id: string; userId: string; known?: ConversationResponse }) {
  const client = useQueryClient()
  const connected = useRealtimeConnected()
  const history = useInfiniteQuery({ ...conversationHistory(id), refetchInterval: connected ? false : 20_000 })
  const listed = known ?? cachedConversation(client, id)
  const info = useQuery(conversationInfo(id, history.isSuccess && !listed))
  const partner = (listed ?? info.data)?.otherParticipant
  const name = partner ? profileName(partner) : 'Переписка'
  const viewport = useRef<HTMLDivElement>(null)
  const position = useRef<ScrollPosition>({ atEnd: true, offset: 0 })
  const lastMessage = useRef<string>(undefined)
  const loadingOlder = useRef(false)
  const [newMessages, setNewMessages] = useState(false)
  const [text, setText] = useState('')
  const mutationKey = ['messages', 'send', id]
  const send = useMutation({
    mutationKey,
    mutationFn: (message: string) => api<MessageResponse>(conversationPath(id), { method: 'POST', body: { text: message } }),
    onSuccess: async saved => {
      mergeMessage(client, saved)
      await Promise.all([
        client.invalidateQueries({ queryKey: [...historyKey, id] }),
        client.invalidateQueries({ queryKey: conversationsKey }),
      ])
    },
    onError: async error => {
      if (error instanceof ApiError && [403, 404].includes(error.status)) {
        await client.invalidateQueries({ queryKey: conversationsKey })
      }
    },
  })

  const [displayedHistory, setDisplayedHistory] = useState({
    source: undefined as typeof history.data,
    messages: [] as MessageResponse[],
  })
  const messages = displayedHistory.messages
  if (displayedHistory.source !== history.data) {
    const messages = new Map<string, MessageResponse>()
    for (const page of history.data?.pages ?? []) {
      for (const message of page.items) if (!messages.has(message.id)) messages.set(message.id, message)
    }
    // A refetch shifts the server's offset window as new messages arrive. Keep the
    // loaded tail only when both windows overlap, so a reconnect cannot hide a gap.
    const previous = displayedHistory.messages
    if (previous.some(message => messages.has(message.id))) {
      for (const message of previous) if (!messages.has(message.id)) messages.set(message.id, message)
    }
    const sorted = [...messages.values()].sort((left, right) => {
      const leftTime = left.sentAtUtc.replace(/Z$/, '+00:00')
      const rightTime = right.sentAtUtc.replace(/Z$/, '+00:00')
      if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1
      return left.id.localeCompare(right.id)
    })
    setDisplayedHistory({ source: history.data, messages: sorted })
  }
  const newest = messages.at(-1)?.id

  function readPosition() {
    const element = viewport.current
    if (!element) return
    const top = element.getBoundingClientRect().top
    const anchor = [...element.querySelectorAll<HTMLElement>('[data-message-id]')]
      .find(row => row.getBoundingClientRect().bottom > top)
    position.current = {
      atEnd: element.scrollHeight - element.clientHeight - element.scrollTop <= 72,
      anchorId: anchor?.dataset.messageId,
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
    }
    if (position.current.atEnd) setNewMessages(false)
  }

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const saved = position.current
    if (saved.atEnd) {
      element.scrollTop = element.scrollHeight
    } else if (saved.anchorId) {
      const row = element.querySelector(`[data-message-id="${saved.anchorId}"]`)
      if (row) element.scrollTop += row.getBoundingClientRect().top - element.getBoundingClientRect().top - saved.offset
    }
  }, [messages])

  useEffect(() => {
    if (newest && lastMessage.current && newest !== lastMessage.current && !position.current.atEnd) setNewMessages(true)
    lastMessage.current = newest
  }, [newest])

  useEffect(() => {
    if (!history.isSuccess || history.isFetching) return
    void client.invalidateQueries({ queryKey: conversationsKey })
    void client.invalidateQueries({ queryKey: notificationsKey })
  }, [client, history.dataUpdatedAt, history.isFetching, history.isSuccess])

  async function older() {
    if (loadingOlder.current || !history.hasNextPage || history.isFetching) return
    readPosition()
    if (messages.length) position.current.atEnd = false
    loadingOlder.current = true
    try {
      const result = await history.fetchNextPage({ cancelRefetch: false })
      const pages = result.data?.pages
      // A message can reach the server between offset requests even when no event reaches this tab.
      if (result.isSuccess && pages && pages[0]?.totalCount !== pages.at(-1)?.totalCount) {
        await history.refetch()
      }
    } finally {
      loadingOlder.current = false
    }
  }

  function sendMessage() {
    const value = text.trim()
    if (!value || value.length > 2000 || value.includes('\0') || client.isMutating({ mutationKey })) return
    send.mutate(value, { onSuccess: () => setText(current => current.trim() === value ? '' : current) })
  }

  const error = send.error ?? history.error
  const unavailable = error instanceof ApiError && [403, 404].includes(error.status)
  return <section aria-label="Переписка" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f9fe]">
    <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border bg-white px-3 sm:px-4">
      <Button variant="ghost" asChild className="px-2 lg:hidden">
        <Link to="/messages" aria-label="К списку диалогов"><ArrowLeft size={20} /></Link>
      </Button>
      <UserAvatar name={partner ? name : undefined} photoUrl={partner?.photoUrl} />
      <div className="min-w-0">
        <h1 className="font-bold wrap-anywhere">
          {partner ? <Link to={`/users/${partner.userId}`} className="hover:underline">{name}</Link> : name}
        </h1>
        {!connected && <p className="text-xs text-secondary-ink">Обновляем через сервер</p>}
      </div>
    </header>
    {unavailable ? <div className="p-3">
      <EmptyState icon={<MessageCircle />} title="Диалог недоступен" description="Переписка больше недоступна для этого аккаунта."
        action={<Button asChild variant="outline"><Link to="/messages">К диалогам</Link></Button>} />
    </div> : <>
      <div ref={viewport} onScroll={readPosition} aria-label="История сообщений"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 [overflow-anchor:none] sm:p-5">
        {history.isPending ? <LoadingSkeleton label="Загружаем историю" />
          : history.isError && !history.data ? <ErrorState error={history.error} retry={() => void history.refetch()} />
          : <>
            {(history.hasNextPage || history.isFetchNextPageError) && <div className="text-center">
              <Button variant="outline" disabled={history.isFetching} onClick={() => void older()}>
                {history.isFetchingNextPage ? 'Загружаем…' : history.isFetchNextPageError ? 'Повторить загрузку истории' : 'Загрузить предыдущие'}
              </Button>
            </div>}
            {history.isRefetchError && !history.isFetchNextPageError && <div className="space-y-2">
              <p className="form-error" role="alert">{history.error?.message}</p>
              <Button variant="outline" onClick={() => void history.refetch()}>Повторить обновление</Button>
            </div>}
            {messages.length ? <ol className="space-y-2" aria-label="Сообщения">
              {messages.map(message => <MessageBubble key={message.id} message={message} own={message.senderId === userId} />)}
            </ol> : <EmptyState icon={<MessageCircle />} title="Сообщений пока нет" description="Напиши первое сообщение." />}
          </>}
      </div>
      {newMessages && <Button variant="outline" className="m-2 min-h-8 self-center" onClick={() => {
        if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
        readPosition()
      }}><ArrowDown size={16} /> Новые сообщения</Button>}
      {history.data && <form className="shrink-0 space-y-2 border-t border-border bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        onSubmit={event => { event.preventDefault(); sendMessage() }}>
        {send.error && <p role="alert" className="form-error">{send.error.message}</p>}
        <div className="flex min-w-0 items-end gap-2">
          <textarea aria-label="Сообщение" placeholder="Сообщение" rows={2} maxLength={2000} value={text}
            className="social-field min-w-0 flex-1 resize-none p-2" onChange={event => setText(event.target.value)} />
          <Button type="submit" aria-label="Отправить сообщение" disabled={!text.trim() || text.includes('\0') || send.isPending}>
            <Send size={17} aria-hidden="true" /> <span className="hidden sm:inline">{send.isPending ? 'Отправляем…' : 'Отправить'}</span>
          </Button>
        </div>
        {send.isPending && <span role="status" className="sr-only">Отправляем сообщение</span>}
      </form>}
    </>}
  </section>
}

export default function MessagesPage() {
  const { conversationId } = useParams()
  const session = useSession()
  const id = isNonEmptyGuid(conversationId) ? conversationId.toLowerCase() : undefined
  const [active, setActive] = useState<ConversationResponse>()
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!conversationId) return
    const viewport = window.visualViewport
    const element = wrapper.current
    if (!viewport || !element) return
    const resize = () => element.style.setProperty('--visible-chat-height', `${viewport.height}px`)
    resize()
    viewport.addEventListener('resize', resize)
    return () => viewport.removeEventListener('resize', resize)
  }, [conversationId])

  return <div ref={wrapper} className={`chat-layout rounded-2xl border-border bg-white lg:grid lg:grid-cols-[minmax(14rem,32%)_minmax(0,1fr)] lg:divide-x lg:overflow-hidden lg:border
    ${conversationId ? 'chat-detail flex min-h-0' : ''}`}>
    <ConversationList activeId={conversationId ? id ?? conversationId : undefined} onConversation={setActive} />
    {id && session.status === 'authenticated'
      ? <MessageThread key={id} id={id} userId={session.session.userId} known={active?.conversationId === id ? active : undefined} />
      : <div className={`min-w-0 p-4 ${conversationId ? 'block' : 'hidden lg:block'}`}>
        <EmptyState icon={<MessageCircle />} title={conversationId ? 'Диалог недоступен' : 'Выбери диалог'}
          description={conversationId ? 'Проверь ссылку на переписку.' : 'Выбери собеседника, чтобы открыть историю сообщений.'}
          action={conversationId && <Button variant="outline" asChild><Link to="/messages">К диалогам</Link></Button>} />
      </div>}
  </div>
}
