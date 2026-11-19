import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('min-h-12 w-full rounded-xl border border-border bg-white px-3.5 text-base text-foreground outline-none transition placeholder:text-[#69738f] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 aria-invalid:border-destructive disabled:bg-muted', className)} {...props} />
}
