import { useState } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Heart, SkipForward } from 'lucide-react'
import { generatePath, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { LikeResponse } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { api } from '@/auth/session'
import { ConfirmDialog } from '@/components/states'
import { Button } from '@/components/ui/button'
import { recommendationsKey, searchKey } from '@/discovery/queries'
import { publicProfile } from '@/profile/queries'

type Action = 'like' | 'unlike' | 'block' | 'unblock' | 'skip'
type SocialStatus = { liked?: boolean; blocked?: boolean }
const unknownStatus: SocialStatus = {}

export function useSocialStatus(userId: string) {
  return useQuery({
    queryKey: ['social', 'status', userId],
    queryFn: () => unknownStatus,
    enabled: false,
    gcTime: Infinity,
  })
}

export function SocialActions({ userId, canSkip, onlyUnblock }: {
  userId: string; canSkip?: boolean; onlyUnblock?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const client = useQueryClient()
  const navigate = useNavigate()
  const { data: status } = useSocialStatus(userId)
  const statusKey = ['social', 'status', userId] as const
  const mutationKey = ['social', 'action', userId] as const
  const pending = useIsMutating({ mutationKey }) > 0
  const action = useMutation({
    mutationKey,
    mutationFn: async (kind: Action) => {
      const statusQuery = client.getQueryCache().find({ queryKey: statusKey, exact: true })
      let like: LikeResponse | undefined
      if (kind === 'like' || kind === 'unlike') {
        like = await api<LikeResponse>(`/api/likes/${userId}`, { method: kind === 'like' ? 'POST' : 'DELETE' })
      } else if (kind === 'skip') {
        await api<void>(`/api/recommendations/${userId}/skip`, { method: 'POST' })
      } else {
        await api<void>(`/api/blocks/${userId}`, { method: kind === 'block' ? 'POST' : 'DELETE' })
      }

      // Logout clears the cache, including in-flight actions from that session.
      if (statusQuery !== client.getQueryCache().find({ queryKey: statusKey, exact: true })) return
      if (like) {
        const { isLiked, isMatch, match } = like
        client.setQueryData<SocialStatus>(statusKey, previous => ({ ...previous, liked: isLiked }))
        const conversationId = isMatch ? match?.conversationId : null
        if (isMatch) {
          toast.success(kind === 'like' ? 'У вас взаимный мэтч!' : 'Лайк убран. Мэтч сохранён.', {
            id: kind === 'like' && match ? `match-${match.matchId}` : undefined,
            action: conversationId && conversationId !== '00000000-0000-0000-0000-000000000000' ? {
              label: 'К переписке',
              onClick: () => navigate(generatePath('/messages/:conversationId', { conversationId })),
            } : undefined,
          })
        } else {
          toast.success(isLiked ? 'Лайк поставлен' : 'Лайк убран')
        }
      } else if (kind === 'block' || kind === 'unblock') {
        client.setQueryData<SocialStatus>(statusKey, previous => ({ ...previous, blocked: kind === 'block' }))
        if (kind === 'block') {
          toast.success('Пользователь заблокирован', {
            action: { label: 'Управление блокировкой', onClick: () => navigate(`/users/${userId}`) },
          })
        } else toast.success('Пользователь разблокирован')
      } else toast.success('Рекомендация пропущена')

      const refresh = [client.invalidateQueries({ queryKey: recommendationsKey })]
      if (kind !== 'skip') {
        refresh.push(client.invalidateQueries({ queryKey: searchKey }))
        refresh.push(client.invalidateQueries({ queryKey: publicProfile(userId).queryKey, exact: true }))
      }
      if (kind === 'block' || kind === 'unblock') {
        refresh.push(client.invalidateQueries({ queryKey: ['conversations'] }))
        refresh.push(client.invalidateQueries({ queryKey: ['messages', 'history'] }))
      }
      await Promise.all(refresh)
    },
    onError: failure => setError(failure instanceof ApiError
      ? failure.payload?.message || failure.message : failure.message),
  })

  function run(kind: Action) {
    if (client.isMutating({ mutationKey }) > 0) return
    setError('')
    action.mutate(kind)
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {status?.blocked ? <Button variant="outline" disabled={pending} onClick={() => run('unblock')}>
        Разблокировать
      </Button> : !onlyUnblock && <>
        <Button disabled={pending} onClick={() => run(status?.liked ? 'unlike' : 'like')}>
          <Heart size={16} fill={status?.liked ? 'currentColor' : 'none'} /> {status?.liked ? 'Убрать лайк' : 'Нравится'}
        </Button>
        {canSkip && <Button variant="outline" disabled={pending} onClick={() => run('skip')}>
          <SkipForward size={16} /> Пропустить
        </Button>}
        <ConfirmDialog open={confirming} onOpenChange={setConfirming} destructive
          trigger={<Button variant="ghost" disabled={pending}><Ban size={16} /> Заблокировать</Button>}
          title="Заблокировать пользователя?" confirmLabel="Заблокировать"
          description="Профили станут недоступны друг другу, а обмен сообщениями будет ограничен."
          onConfirm={() => { setConfirming(false); run('block') }} />
      </>}
    </div>
    {error && <p role="alert" className="form-error wrap-anywhere">{error}</p>}
  </div>
}
