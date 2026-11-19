import * as Dialog from '@radix-ui/react-alert-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { CircleAlert, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'

export function UserAvatar({ name, photoUrl }: { name?: string; photoUrl?: string | null }) {
  return (
    <Avatar.Root className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7edff] text-primary">
      <Avatar.Image src={photoUrl ?? undefined} alt={name ?? 'Аватар'} className="size-full object-cover" />
      <Avatar.Fallback aria-hidden="true">{name ? name.trim().slice(0, 1).toUpperCase() : <UserRound size={19} />}</Avatar.Fallback>
    </Avatar.Root>
  )
}

export function EmptyState({ title, description, icon, action }: {
  title: string; description: string; icon: ReactNode; action?: ReactNode
}) {
  return (
    <section className="state-card">
      <div className="state-icon" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  )
}

export function ErrorState({ title = 'Что-то пошло не так', error, retry }: {
  title?: string; error: Error; retry?: () => void
}) {
  return <EmptyState icon={<CircleAlert />} title={title} description={error.message}
    action={retry && <Button variant="outline" onClick={retry}>Повторить</Button>} />
}

export function LoadingSkeleton({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div role="status" className="state-card">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="size-12 rounded-xl bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-6 w-48 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-4 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
    </div>
  )
}

export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm, destructive, open, onOpenChange }: {
  trigger?: ReactNode; title: string; description: string; confirmLabel: string;
  onConfirm: () => void; destructive?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#111b42]/45" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-1/2 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
          <Dialog.Description className="text-secondary-ink">{description}</Dialog.Description>
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Cancel asChild><Button variant="outline">Отмена</Button></Dialog.Cancel>
            {open === undefined
              ? <Dialog.Action asChild><Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button></Dialog.Action>
              : <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
